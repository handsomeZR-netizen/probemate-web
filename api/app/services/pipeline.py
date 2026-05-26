from datetime import datetime, timezone
from time import perf_counter

from app.schemas.models import (
    AnalyzeResponseResult,
    CandidateOutput,
    CheckpointRead,
    CurrentActivity,
    EvidenceState,
    GateDecision,
    GateMove,
    InputPack,
    LessonPhase,
    StudentResponseRead,
    TeacherCard,
)
from app.services.candidate_generators import get_candidate_generator, mock_candidate_generator
from app.services.evidence_audit import quote_exists
from app.services.store import new_id, store


BAD_TIMING_ACTIVITIES = {
    CurrentActivity.PEER_DISCUSSION,
    CurrentActivity.EXPERIMENT_OBSERVATION,
    CurrentActivity.TEACHER_WRAP_UP,
}


def build_input_pack(checkpoint: CheckpointRead, response: StudentResponseRead) -> InputPack:
    return InputPack(
        episode_id=response.id,
        question=checkpoint.question,
        student_answer=response.answer_text,
        target_concept=checkpoint.target_concept,
        lesson_phase=checkpoint.lesson_phase,
        current_activity=checkpoint.current_activity,
        visibility_policy=checkpoint.visibility_policy,
        prior_context={
            "has_practiced_deceleration": checkpoint.lesson_phase
            in {LessonPhase.PRACTICE, LessonPhase.REVIEW},
            "is_peer_discussion_active": checkpoint.current_activity == CurrentActivity.PEER_DISCUSSION,
            "is_teacher_wrapping_up": checkpoint.current_activity == CurrentActivity.TEACHER_WRAP_UP,
        },
    )


def decide_gate(input_pack: InputPack, candidate_output: CandidateOutput) -> GateDecision:
    suggested = candidate_output.suggested_teacher_moves[0]
    has_quote = quote_exists(input_pack, candidate_output)
    answer_leakage_risk = suggested.answer_leakage_risk.strip().lower()

    if input_pack.current_activity in BAD_TIMING_ACTIVITIES:
        return GateDecision(
            move=GateMove.HOLD,
            why_this_move="当前课堂活动不适合插入新的教师追问，系统先保留该回答供讨论后回看。",
            teacher_move="暂不打断当前活动。已加入讨论后回看队列。",
            gate_reasons=["bad_timing", "protect_classroom_flow"],
            fallback_reason="bad_timing",
            downgrade_reason="bad_timing",
            blocked_actions=[GateMove.ASK_FOR_EVIDENCE, GateMove.DIAGNOSTIC_PROBE],
        )

    if not has_quote:
        return GateDecision(
            move=GateMove.ASK_FOR_EVIDENCE,
            why_this_move="系统无法把候选解释绑定到可指认的学生原话，因此不能给出诊断探针。",
            teacher_move="先请学生补一句理由或画出关键表征。",
            gate_reasons=["no_valid_quote", "downgrade_to_evidence"],
            fallback_reason="no_quote",
            downgrade_reason="no_valid_quote",
            blocked_actions=[GateMove.DIAGNOSTIC_PROBE],
        )

    if candidate_output.evidence_state in {EvidenceState.NONE, EvidenceState.AMBIGUOUS}:
        return GateDecision(
            move=GateMove.ASK_FOR_EVIDENCE,
            why_this_move="学生回答可疑，但证据还不足以支持诊断；需要先补一个可判断证据。",
            teacher_move=suggested.text,
            gate_reasons=["student_quote_exists", "evidence_ambiguous", "short_probe_can_add_evidence"],
            downgrade_reason="evidence_ambiguous",
            blocked_actions=[GateMove.DIAGNOSTIC_PROBE],
        )

    if answer_leakage_risk == "high":
        return GateDecision(
            move=GateMove.ASK_FOR_EVIDENCE,
            why_this_move="建议话术有较高答案泄露风险，因此先改为要求学生补证据。",
            teacher_move="请先说明你依据哪一部分现象或表征作出判断。",
            gate_reasons=["student_quote_exists", "answer_leakage_risk", "downgrade_to_evidence"],
            downgrade_reason="answer_leakage_risk",
            blocked_actions=[GateMove.DIAGNOSTIC_PROBE],
        )

    return GateDecision(
        move=GateMove.DIAGNOSTIC_PROBE,
        why_this_move="学生原话已经提供足够诊断线索，且当前时机适合用短探针推动学生继续推理。",
        teacher_move=suggested.text,
        gate_reasons=["student_quote_exists", "evidence_sufficient", "timing_appropriate"],
    )


def analyze_student_response(
    checkpoint: CheckpointRead, response: StudentResponseRead, force_rerun: bool = False
) -> AnalyzeResponseResult:
    started = perf_counter()
    if not force_rerun:
        cached_card = store.get_latest_card_for_response(response.id)
        if cached_card is not None:
            return AnalyzeResponseResult(
                ai_run_id=new_id("run"),
                card=cached_card,
                latency_ms=0,
                cached=True,
                ai_provider=cached_card.ai_provider,
                model_name=cached_card.model_name,
                raw_llm_valid=cached_card.raw_llm_valid,
                fallback_used=cached_card.fallback_used,
            )

    input_pack = build_input_pack(checkpoint, response)
    generation_result = get_candidate_generator().generate(input_pack)
    if generation_result.candidate_output is None:
        raise RuntimeError("Candidate generator returned no candidate output")
    candidate_output = generation_result.candidate_output
    gate_decision = decide_gate(input_pack, candidate_output)
    downgrade_reason = gate_decision.downgrade_reason
    if generation_result.downgrade_reason and gate_decision.downgrade_reason in {None, "evidence_ambiguous"}:
        downgrade_reason = generation_result.downgrade_reason
        gate_decision = gate_decision.model_copy(update={"downgrade_reason": downgrade_reason})
    ai_run_id = new_id("run")
    card = TeacherCard(
        id=new_id("card"),
        response_id=response.id,
        response_revision=response.revision,
        gate_decision=gate_decision,
        candidate_output=candidate_output,
        ai_provider=generation_result.ai_provider,
        model_name=generation_result.model_name,
        prompt_version=generation_result.prompt_version,
        ai_schema_version=generation_result.ai_schema_version,
        raw_llm_valid=generation_result.raw_llm_valid,
        validation_error=generation_result.validation_error,
        provider_error=generation_result.provider_error,
        downgrade_reason=downgrade_reason,
        fallback_used=generation_result.fallback_used,
        shown_at=datetime.now(timezone.utc),
    )
    latency_ms = int((perf_counter() - started) * 1000)
    saved_card = store.save_card(
        card,
        force_rerun=force_rerun,
        ai_run_id=ai_run_id,
        latency_ms=latency_ms,
        analysis_cached=False,
    )
    was_cached_during_save = saved_card.id != card.id
    return AnalyzeResponseResult(
        ai_run_id=ai_run_id,
        card=saved_card,
        latency_ms=latency_ms,
        cached=was_cached_during_save,
        ai_provider=saved_card.ai_provider,
        model_name=saved_card.model_name,
        raw_llm_valid=saved_card.raw_llm_valid,
        fallback_used=saved_card.fallback_used,
    )
