from app.schemas.models import (
    CandidateOutput,
    CheckpointRead,
    CheckpointStatus,
    CurrentActivity,
    EvidenceState,
    GateMove,
    InputPack,
    LessonPhase,
    StudentResponseRead,
    VisibilityPolicy,
)
from app.services.pipeline import build_input_pack, decide_gate, mock_candidate_generator
from app.services.store import utc_now


def checkpoint(activity: CurrentActivity, phase: LessonPhase = LessonPhase.PRACTICE) -> CheckpointRead:
    return CheckpointRead(
        id="ckpt_test",
        code="ABC123",
        question="箱子上放一本书，箱子被推着匀速前进。书受到的摩擦力方向是什么？",
        target_concept="摩擦力方向",
        lesson_phase=phase,
        current_activity=activity,
        visibility_policy=VisibilityPolicy.TEACHER_ONLY,
        status=CheckpointStatus.OPEN,
        created_at=utc_now(),
    )


def response(text: str) -> StudentResponseRead:
    return StudentResponseRead(
        id="resp_test",
        checkpoint_id="ckpt_test",
        anonymous_student_id="S01",
        answer_text=text,
        submitted_at=utc_now(),
    )


def test_bad_timing_returns_hold() -> None:
    input_pack = build_input_pack(
        checkpoint(CurrentActivity.PEER_DISCUSSION),
        response("向后，因为摩擦力总是阻碍运动。"),
    )
    candidate_output = mock_candidate_generator(input_pack)
    decision = decide_gate(input_pack, candidate_output)
    assert decision.move == GateMove.HOLD
    assert decision.fallback_reason == "bad_timing"


def test_ambiguous_velocity_answer_returns_ask() -> None:
    ckpt = CheckpointRead(
        id="ckpt_velocity",
        code="ABC123",
        question="汽车向前运动，但速度越来越小，它的加速度方向是什么？",
        target_concept="加速度方向",
        lesson_phase=LessonPhase.INTRODUCE,
        current_activity=CurrentActivity.WHOLE_CLASS,
        visibility_policy=VisibilityPolicy.TEACHER_ONLY,
        status=CheckpointStatus.OPEN,
        created_at=utc_now(),
    )
    input_pack = build_input_pack(ckpt, response("向前，因为车还在往前走。"))
    decision = decide_gate(input_pack, mock_candidate_generator(input_pack))
    assert decision.move == GateMove.ASK_FOR_EVIDENCE
    assert GateMove.DIAGNOSTIC_PROBE in decision.blocked_actions


def test_sufficient_friction_answer_returns_probe() -> None:
    input_pack = build_input_pack(
        checkpoint(CurrentActivity.WHOLE_CLASS),
        response("向后，因为摩擦力总是阻碍运动。"),
    )
    decision = decide_gate(input_pack, mock_candidate_generator(input_pack))
    assert decision.move == GateMove.DIAGNOSTIC_PROBE
    assert "什么让书跟着箱子" in decision.teacher_move


def test_missing_quote_downgrades_to_ask() -> None:
    input_pack = InputPack(
        episode_id="resp_quote",
        question="汽车向前运动，但速度越来越小，它的加速度方向是什么？",
        student_answer="向前。",
        target_concept="加速度方向",
        lesson_phase=LessonPhase.PRACTICE,
        current_activity=CurrentActivity.WHOLE_CLASS,
        visibility_policy=VisibilityPolicy.TEACHER_ONLY,
    )
    candidate_output = CandidateOutput.model_validate(
        {
            "candidate_explanations": [
                {
                    "label": "invalid_quote",
                    "student_quotes": ["还在往前走"],
                    "interpretation": "学生可能关注运动方向。",
                    "missing_evidence": "缺少速度变化量。",
                    "risk_if_overdiagnosed": "过早诊断。",
                }
            ],
            "evidence_state": EvidenceState.SUFFICIENT,
            "distinguishability": "short_probe_can_distinguish",
            "suggested_teacher_moves": [
                {
                    "move_type_hint": GateMove.DIAGNOSTIC_PROBE,
                    "text": "如果速度箭头在变短，速度变化量指向哪里？",
                    "answer_leakage_risk": "low",
                }
            ],
        }
    )
    decision = decide_gate(input_pack, candidate_output)
    assert decision.move == GateMove.ASK_FOR_EVIDENCE
    assert decision.fallback_reason == "no_quote"
    assert decision.downgrade_reason == "no_valid_quote"


def test_answer_leakage_risk_downgrades_to_ask() -> None:
    input_pack = InputPack(
        episode_id="resp_leakage",
        question="汽车向前运动，但速度越来越小，它的加速度方向是什么？",
        student_answer="向后，因为速度变小。",
        target_concept="加速度方向",
        lesson_phase=LessonPhase.PRACTICE,
        current_activity=CurrentActivity.WHOLE_CLASS,
        visibility_policy=VisibilityPolicy.TEACHER_ONLY,
    )
    candidate_output = CandidateOutput.model_validate(
        {
            "candidate_explanations": [
                {
                    "label": "velocity_change_direction",
                    "student_quotes": ["速度变小"],
                    "interpretation": "学生提到速度变小，可以追问速度变化量方向。",
                    "missing_evidence": "还没有画出速度变化量。",
                    "risk_if_overdiagnosed": "不能直接公布答案。",
                }
            ],
            "evidence_state": EvidenceState.SUFFICIENT,
            "distinguishability": "short_probe_can_distinguish",
            "suggested_teacher_moves": [
                {
                    "move_type_hint": GateMove.DIAGNOSTIC_PROBE,
                    "text": "答案是向后，你能解释为什么吗？",
                    "answer_leakage_risk": "high",
                }
            ],
        }
    )

    decision = decide_gate(input_pack, candidate_output)

    assert decision.move == GateMove.ASK_FOR_EVIDENCE
    assert decision.downgrade_reason == "answer_leakage_risk"
