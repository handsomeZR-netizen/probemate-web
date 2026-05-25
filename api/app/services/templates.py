from app.schemas.models import (
    CheckpointTemplate,
    CurrentActivity,
    LessonPhase,
    VisibilityPolicy,
)


CHECKPOINT_TEMPLATES = [
    CheckpointTemplate(
        id="acceleration-direction",
        title="减速运动中的加速度方向",
        description="适合刚引入速度变化量时收集学生短答。",
        question="汽车向前运动，但速度越来越小，它的加速度方向是什么？",
        target_concept="加速度方向",
        lesson_phase=LessonPhase.INTRODUCE,
        current_activity=CurrentActivity.WHOLE_CLASS,
        visibility_policy=VisibilityPolicy.TEACHER_ONLY,
    ),
    CheckpointTemplate(
        id="free-fall-weight",
        title="重物是否下落更快",
        description="适合实验前预测，保留学生直觉并追证据。",
        question="铁球和木球同时释放，哪个会先落地？请写一句理由。",
        target_concept="自由落体",
        lesson_phase=LessonPhase.EXPERIMENT,
        current_activity=CurrentActivity.WHOLE_CLASS,
        visibility_policy=VisibilityPolicy.ANONYMOUS_REPRESENTATIVE,
    ),
    CheckpointTemplate(
        id="friction-direction",
        title="摩擦力方向判断",
        description="适合练习阶段区分运动方向与相对运动趋势。",
        question="箱子上放一本书，箱子被推着匀速前进。书受到的摩擦力方向是什么？",
        target_concept="摩擦力方向",
        lesson_phase=LessonPhase.PRACTICE,
        current_activity=CurrentActivity.WHOLE_CLASS,
        visibility_policy=VisibilityPolicy.TEACHER_ONLY,
    ),
]


def list_checkpoint_templates() -> list[CheckpointTemplate]:
    return CHECKPOINT_TEMPLATES
