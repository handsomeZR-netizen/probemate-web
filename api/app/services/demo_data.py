from app.schemas.models import (
    AppMode,
    CheckpointCreate,
    CurrentActivity,
    DemoDataResult,
    ExperimentCondition,
    LessonPhase,
    ResponseSource,
    StudentResponseCreate,
    StudentResponseUpdate,
    TeacherAction,
    TeacherActionCreate,
    VisibilityPolicy,
)
from app.services.app_state import get_app_mode, set_app_mode
from app.services.experimental import generate_experimental_condition
from app.services.pipeline import analyze_student_response
from app.services.store import store


def clear_demo_data() -> DemoDataResult:
    store.clear_all()
    return _result()


def reset_standard_demo_data() -> DemoDataResult:
    store.clear_all()
    set_app_mode(AppMode.DEMO)

    acceleration = store.create_checkpoint(
        CheckpointCreate(
            question="汽车向前运动，但速度越来越小，它的加速度方向是什么？",
            target_concept="加速度方向",
            lesson_phase=LessonPhase.PRACTICE,
            current_activity=CurrentActivity.WHOLE_CLASS,
            visibility_policy=VisibilityPolicy.TEACHER_ONLY,
            class_name="Demo：加速度方向 checkpoint",
        )
    )
    resp_motion = store.create_response(
        acceleration.id,
        StudentResponseCreate(
            answer_text="向前，因为车还在往前走。",
            anonymous_student_id="Demo-S01",
            confidence_level="low",
        ),
    )
    store.create_response(
        acceleration.id,
        StudentResponseCreate(
            answer_text="向后，因为速度变小了。",
            anonymous_student_id="Demo-S02",
            confidence_level="medium",
        ),
    )
    store.create_response(
        acceleration.id,
        StudentResponseCreate(
            answer_text="不知道，我只看出来车还在动。",
            anonymous_student_id="Demo-S03",
            confidence_level="unsure",
        ),
    )
    resp_motion = store.update_response(
        resp_motion.id,
        StudentResponseUpdate(is_representative=True, selection_reason="standard_demo_motion_direction"),
    ) or resp_motion
    analysis = analyze_student_response(acceleration, resp_motion, force_rerun=True)
    store.create_teacher_action(
        TeacherActionCreate(
            card_id=analysis.card.id,
            action=TeacherAction.DELAY,
            final_turn=analysis.card.gate_decision.teacher_move,
            decision_time_ms=9000,
            teacher_feedback="先让学生画速度箭头，再决定是否进入探针。",
            queue_note="全班练习后回看这类运动方向回答。",
        )
    )
    for condition in [
        ExperimentCondition.NO_AI,
        ExperimentCondition.STANDARD_LLM,
        ExperimentCondition.OVER_COMMITTED,
        ExperimentCondition.EVIDENCE_ONLY,
    ]:
        generate_experimental_condition(acceleration, resp_motion, condition)

    friction = store.create_checkpoint(
        CheckpointCreate(
            question="箱子上放一本书，箱子被推着匀速前进。书受到的摩擦力方向是什么？",
            target_concept="摩擦力方向",
            lesson_phase=LessonPhase.PRACTICE,
            current_activity=CurrentActivity.WHOLE_CLASS,
            visibility_policy=VisibilityPolicy.TEACHER_ONLY,
            class_name="Demo：摩擦力相对运动趋势",
        )
    )
    resp_friction = store.create_response(
        friction.id,
        StudentResponseCreate(
            answer_text="向后，因为摩擦力总是阻碍运动。",
            anonymous_student_id="Demo-S04",
            response_source=ResponseSource.TEACHER_REPRESENTATIVE,
        ),
    )
    analyze_student_response(friction, resp_friction, force_rerun=True)

    free_fall = store.create_checkpoint(
        CheckpointCreate(
            question="铁球和木球同时释放，哪个先落地？",
            target_concept="自由落体",
            lesson_phase=LessonPhase.EXPERIMENT,
            current_activity=CurrentActivity.EXPERIMENT_OBSERVATION,
            visibility_policy=VisibilityPolicy.TEACHER_ONLY,
            class_name="Demo：探究前直觉",
        )
    )
    resp_fall = store.create_response(
        free_fall.id,
        StudentResponseCreate(
            answer_text="铁球，因为更重。",
            anonymous_student_id="Demo-S05",
            response_source=ResponseSource.TEACHER_REPRESENTATIVE,
        ),
    )
    analyze_student_response(free_fall, resp_fall, force_rerun=True)

    return _result()


def _result() -> DemoDataResult:
    return DemoDataResult(
        app_mode=get_app_mode(),
        checkpoints=len(store.list_checkpoints()),
        responses=sum(len(store.list_responses(checkpoint.id)) for checkpoint in store.list_checkpoints()),
        episode_logs=len(store.list_episode_logs()),
    )
