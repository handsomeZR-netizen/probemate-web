from datetime import datetime, timezone

from app.schemas.models import (
    CheckpointRead,
    CheckpointStatus,
    CurrentActivity,
    EpisodeLog,
    ExperimentCondition,
    ExperimentalConditionResult,
    GateMove,
    PhaseManipulationRequest,
    PhaseManipulationResult,
    StudentResponseRead,
    VisibilityPolicy,
)
from app.services.pipeline import analyze_student_response, build_input_pack, decide_gate
from app.services.candidate_generators import mock_candidate_generator
from app.services.store import new_id, store


def condition_text(condition: ExperimentCondition, response: StudentResponseRead) -> tuple[str, GateMove | None]:
    if condition == ExperimentCondition.NO_AI:
        return "No-AI 条件：不显示系统建议，请教师独立写出下一句课堂回应。", None
    if condition == ExperimentCondition.STANDARD_LLM:
        return "你能再解释一下速度和加速度有什么区别，以及你为什么这样判断吗？", GateMove.ASK_FOR_EVIDENCE
    if condition == ExperimentCondition.OVER_COMMITTED:
        return "学生混淆了运动方向和加速度方向。请直接追问为什么减速时加速度方向与运动方向相反。", GateMove.DIAGNOSTIC_PROBE
    if condition == ExperimentCondition.EVIDENCE_ONLY:
        return "请先让学生画出此刻速度箭头和下一秒速度箭头，再比较速度变化量方向。", GateMove.ASK_FOR_EVIDENCE
    raise ValueError(f"Unsupported baseline condition for text generation: {condition}")


def generate_experimental_condition(
    checkpoint: CheckpointRead,
    response: StudentResponseRead,
    condition: ExperimentCondition,
) -> ExperimentalConditionResult:
    if condition == ExperimentCondition.PROBEMATE:
        analysis = analyze_student_response(checkpoint, response, force_rerun=True)
        return ExperimentalConditionResult(
            condition=condition,
            response_id=response.id,
            teacher_card=analysis.card.gate_decision.teacher_move,
            move=analysis.card.gate_decision.move,
            ai_provider=analysis.card.ai_provider,
            model_name=analysis.card.model_name,
            raw_llm_valid=analysis.card.raw_llm_valid,
            fallback_used=analysis.card.fallback_used,
            downgrade_reason=analysis.card.downgrade_reason,
        )

    text, move = condition_text(condition, response)
    log = EpisodeLog(
        id=new_id("elog"),
        source="experimental_condition",
        condition=condition.value,
        checkpoint_id=checkpoint.id,
        response_id=response.id,
        response_revision=response.revision,
        question=checkpoint.question,
        student_answer=response.answer_text,
        target_concept=checkpoint.target_concept,
        lesson_phase=checkpoint.lesson_phase,
        current_activity=checkpoint.current_activity,
        visibility_policy=checkpoint.visibility_policy,
        class_name=checkpoint.class_name,
        response_source=response.response_source,
        confidence_level=response.confidence_level,
        system_move=move,
        shown_teacher_move=text,
        ai_provider="baseline",
        model_name=None,
        raw_llm_valid=True,
        fallback_used=False,
        created_at=datetime.now(timezone.utc),
    )
    store.save_episode_log(log)
    return ExperimentalConditionResult(
        condition=condition,
        response_id=response.id,
        teacher_card=text,
        move=move,
        ai_provider="baseline",
    )


def run_phase_manipulation(payload: PhaseManipulationRequest) -> PhaseManipulationResult:
    checkpoint = CheckpointRead(
        id="demo_phase_ckpt",
        code="DEMO",
        question=payload.question,
        target_concept=payload.target_concept,
        lesson_phase=payload.lesson_phase,
        current_activity=payload.current_activity,
        visibility_policy=VisibilityPolicy.TEACHER_ONLY,
        status=CheckpointStatus.OPEN,
        created_at=datetime.now(timezone.utc),
    )
    response = StudentResponseRead(
        id="demo_phase_resp",
        checkpoint_id=checkpoint.id,
        anonymous_student_id="demo",
        answer_text=payload.answer_text,
        submitted_at=datetime.now(timezone.utc),
    )
    input_pack = build_input_pack(checkpoint, response)
    decision = decide_gate(input_pack, mock_candidate_generator(input_pack))
    return PhaseManipulationResult(
        lesson_phase=payload.lesson_phase,
        current_activity=payload.current_activity,
        move=decision.move,
        teacher_move=decision.teacher_move,
        why_this_move=decision.why_this_move,
        downgrade_reason=decision.downgrade_reason,
    )
