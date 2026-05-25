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


def mock_candidate_generator(input_pack: InputPack) -> CandidateOutput:
    answer = input_pack.student_answer
    concept = input_pack.target_concept

    if "摩擦" in concept or "摩擦" in input_pack.question or "摩擦" in answer:
        return CandidateOutput.model_validate(
            {
                "candidate_explanations": [
                    {
                        "label": "friction_opposes_motion_overgeneralization",
                        "student_quotes": ["摩擦力总是阻碍运动"] if "摩擦力总是阻碍运动" in answer else [answer],
                        "interpretation": "学生可能把摩擦力概括为总是与运动方向相反。",
                        "missing_evidence": "需要确认学生是否区分相对运动趋势和实际运动方向。",
                        "risk_if_overdiagnosed": "如果学生只是口语化表达，直接贴标签会过强。",
                    }
                ],
                "evidence_state": "sufficient",
                "distinguishability": "short_probe_can_distinguish",
                "suggested_teacher_moves": [
                    {
                        "move_type_hint": "diagnostic_probe",
                        "text": "如果书受到向后的摩擦力，是什么让书跟着箱子一起向前运动？",
                        "answer_leakage_risk": "low",
                    }
                ],
                "safety_notes": ["不要用“你混淆了”作为开头。"],
            }
        )

    if "更重" in answer or "铁球" in input_pack.question:
        return CandidateOutput.model_validate(
            {
                "candidate_explanations": [
                    {
                        "label": "heavier_object_falls_faster",
                        "student_quotes": ["更重"] if "更重" in answer else [answer],
                        "interpretation": "学生可能持有重物下落更快的直觉。",
                        "missing_evidence": "需要确认这是探究前预测还是演示后的解释。",
                        "risk_if_overdiagnosed": "探究开始前保留直觉可能比立即纠正更合适。",
                    }
                ],
                "evidence_state": "ambiguous",
                "distinguishability": "needs_observation_or_reason",
                "suggested_teacher_moves": [
                    {
                        "move_type_hint": "ask_for_evidence",
                        "text": "你说更重会先落地，能补一句你认为更重会怎样影响下落过程吗？",
                        "answer_leakage_risk": "low",
                    }
                ],
                "safety_notes": ["探究开始前不要过早纠正。"],
            }
        )

    quote = "还在往前走" if "还在往前走" in answer else answer
    evidence_state = "sufficient" if ("速度变小" in answer or "变化量" in answer) else "ambiguous"
    hint = "diagnostic_probe" if evidence_state == "sufficient" else "ask_for_evidence"
    text = (
        "如果速度箭头在变短，速度变化量指向哪里？"
        if evidence_state == "sufficient"
        else "请画出此刻速度箭头和下一秒速度箭头，比较速度变化量方向。"
    )
    return CandidateOutput.model_validate(
        {
            "candidate_explanations": [
                {
                    "label": "possible_velocity_acceleration_confusion",
                    "student_quotes": [quote],
                    "interpretation": "学生可能把运动方向当作加速度方向，也可能只是没有表达速度变化量。",
                    "missing_evidence": "尚未稳定说明速度变化量方向。",
                    "risk_if_overdiagnosed": "可能把表达不完整误判为稳定误概念。",
                }
            ],
            "evidence_state": evidence_state,
            "distinguishability": "needs_representation",
            "suggested_teacher_moves": [
                {
                    "move_type_hint": hint,
                    "text": text,
                    "answer_leakage_risk": "low",
                }
            ],
            "safety_notes": ["先追证据，不要直接说学生混淆速度和加速度。"],
        }
    )


def quote_exists(input_pack: InputPack, candidate_output: CandidateOutput) -> bool:
    for candidate in candidate_output.candidate_explanations:
        for quote in candidate.student_quotes:
            if quote and quote in input_pack.student_answer:
                return True
    return False


def decide_gate(input_pack: InputPack, candidate_output: CandidateOutput) -> GateDecision:
    suggested = candidate_output.suggested_teacher_moves[0]
    has_quote = quote_exists(input_pack, candidate_output)

    if input_pack.current_activity in BAD_TIMING_ACTIVITIES:
        return GateDecision(
            move=GateMove.HOLD,
            why_this_move="当前课堂活动不适合插入新的教师追问，系统先保留该回答供讨论后回看。",
            teacher_move="暂不打断当前活动。已加入讨论后回看队列。",
            gate_reasons=["bad_timing", "protect_classroom_flow"],
            fallback_reason="bad_timing",
            blocked_actions=[GateMove.ASK_FOR_EVIDENCE, GateMove.DIAGNOSTIC_PROBE],
        )

    if not has_quote:
        return GateDecision(
            move=GateMove.ASK_FOR_EVIDENCE,
            why_this_move="系统无法把候选解释绑定到可指认的学生原话，因此不能给出诊断探针。",
            teacher_move="先请学生补一句理由或画出关键表征。",
            gate_reasons=["no_valid_quote", "downgrade_to_evidence"],
            fallback_reason="no_quote",
            blocked_actions=[GateMove.DIAGNOSTIC_PROBE],
        )

    if candidate_output.evidence_state in {EvidenceState.NONE, EvidenceState.AMBIGUOUS}:
        return GateDecision(
            move=GateMove.ASK_FOR_EVIDENCE,
            why_this_move="学生回答可疑，但证据还不足以支持诊断；需要先补一个可判断证据。",
            teacher_move=suggested.text,
            gate_reasons=["student_quote_exists", "evidence_ambiguous", "short_probe_can_add_evidence"],
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
            )

    input_pack = build_input_pack(checkpoint, response)
    candidate_output = mock_candidate_generator(input_pack)
    gate_decision = decide_gate(input_pack, candidate_output)
    ai_run_id = new_id("run")
    card = TeacherCard(
        id=new_id("card"),
        response_id=response.id,
        response_revision=response.revision,
        gate_decision=gate_decision,
        candidate_output=candidate_output,
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
    )
