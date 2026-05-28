from datetime import datetime, timezone
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class LessonPhase(StrEnum):
    INTRODUCE = "introduce"
    PRACTICE = "practice"
    REVIEW = "review"
    GROUP_DISCUSSION = "group_discussion"
    EXPERIMENT = "experiment"
    WRAP_UP = "wrap_up"
    AFTER_CLASS = "after_class"


class CurrentActivity(StrEnum):
    WHOLE_CLASS = "whole_class"
    PEER_DISCUSSION = "peer_discussion"
    DEMO = "demo"
    WORKSHEET = "worksheet"
    EXPERIMENT_OBSERVATION = "experiment_observation"
    TEACHER_WRAP_UP = "teacher_wrap_up"


class VisibilityPolicy(StrEnum):
    TEACHER_ONLY = "teacher_only"
    ANONYMOUS_REPRESENTATIVE = "anonymous_representative"
    ALLOW_PUBLIC_DISPLAY = "allow_public_display"


class CheckpointStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"


class GateMove(StrEnum):
    HOLD = "hold"
    ASK_FOR_EVIDENCE = "ask_for_evidence"
    DIAGNOSTIC_PROBE = "diagnostic_probe"


class TeacherAction(StrEnum):
    USE = "use"
    EDIT = "edit"
    DELAY = "delay"
    SKIP = "skip"


class EvidenceState(StrEnum):
    NONE = "none"
    AMBIGUOUS = "ambiguous"
    SUFFICIENT = "sufficient"


class ResponseSource(StrEnum):
    STUDENT_QR = "student_qr"
    TEACHER_REPRESENTATIVE = "teacher_representative"
    IMPORTED_EPISODE = "imported_episode"


class QueueState(StrEnum):
    NONE = "none"
    QUEUED = "queued"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class StudentConfidence(StrEnum):
    UNSURE = "unsure"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ExperimentCondition(StrEnum):
    NO_AI = "no_ai"
    STANDARD_LLM = "standard_llm"
    OVER_COMMITTED = "over_committed"
    EVIDENCE_ONLY = "evidence_only"
    PROBEMATE = "probemate"


class ProviderRunMode(StrEnum):
    MOCK = "mock"
    CURRENT = "current"


class AppMode(StrEnum):
    DEMO = "demo"
    RESEARCH = "research"
    CLASSROOM_PILOT = "classroom_pilot"


class CheckpointCreate(BaseModel):
    question: str = Field(min_length=4, max_length=500)
    target_concept: str = Field(min_length=2, max_length=120)
    lesson_phase: LessonPhase
    current_activity: CurrentActivity = CurrentActivity.WHOLE_CLASS
    visibility_policy: VisibilityPolicy = VisibilityPolicy.TEACHER_ONLY
    class_name: str | None = Field(default=None, max_length=120)


class CheckpointUpdate(BaseModel):
    status: CheckpointStatus | None = None
    lesson_phase: LessonPhase | None = None
    current_activity: CurrentActivity | None = None
    visibility_policy: VisibilityPolicy | None = None


class CheckpointRead(CheckpointCreate):
    id: str
    code: str
    status: CheckpointStatus
    created_at: datetime


class CheckpointTemplate(BaseModel):
    id: str
    title: str
    description: str
    question: str
    target_concept: str
    lesson_phase: LessonPhase
    current_activity: CurrentActivity
    visibility_policy: VisibilityPolicy = VisibilityPolicy.TEACHER_ONLY


class StudentResponseCreate(BaseModel):
    answer_text: str = Field(min_length=1, max_length=200)
    anonymous_student_id: str | None = Field(default=None, max_length=40)
    response_source: ResponseSource = ResponseSource.STUDENT_QR
    confidence_level: StudentConfidence | None = None

    @field_validator("answer_text")
    @classmethod
    def strip_answer(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("answer_text cannot be blank")
        return stripped


class StudentResponseRead(BaseModel):
    id: str
    checkpoint_id: str
    anonymous_student_id: str
    answer_text: str
    submitted_at: datetime
    updated_at: datetime | None = None
    revision: int = 1
    is_representative: bool = False
    response_source: ResponseSource = ResponseSource.STUDENT_QR
    confidence_level: StudentConfidence | None = None
    selected_for_analysis_at: datetime | None = None
    selection_reason: str | None = None
    selected_by_role: str | None = None


class StudentResponseUpdate(BaseModel):
    answer_text: str | None = Field(default=None, min_length=1, max_length=200)
    anonymous_student_id: str | None = Field(default=None, max_length=40)
    confidence_level: StudentConfidence | None = None
    is_representative: bool | None = None
    selection_reason: str | None = Field(default=None, max_length=200)
    selected_by_role: str | None = Field(default="teacher", max_length=40)

    @field_validator("answer_text")
    @classmethod
    def strip_answer(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("answer_text cannot be blank")
        return stripped


class CandidateExplanation(BaseModel):
    label: str
    student_quotes: list[str] = Field(min_length=1)
    interpretation: str
    missing_evidence: str
    risk_if_overdiagnosed: str


class SuggestedTeacherMove(BaseModel):
    move_type_hint: GateMove
    text: str
    answer_leakage_risk: str = "low"


class CandidateOutput(BaseModel):
    candidate_explanations: list[CandidateExplanation] = Field(min_length=1)
    evidence_state: EvidenceState
    distinguishability: str
    suggested_teacher_moves: list[SuggestedTeacherMove] = Field(min_length=1)
    safety_notes: list[str] = Field(default_factory=list)


class CandidateGenerationResult(BaseModel):
    candidate_output: CandidateOutput | None = None
    ai_provider: str = "mock"
    model_name: str | None = None
    prompt_version: str = "mock-v0.1"
    ai_schema_version: str = "candidate-output-v0.1"
    raw_llm_valid: bool = True
    validation_error: str | None = None
    provider_error: str | None = None
    fallback_used: bool = False
    downgrade_reason: str | None = None


class AIProviderStatus(BaseModel):
    ai_provider: str
    model_name: str | None = None
    configured: bool
    fallback_available: bool = True


class SystemStatus(BaseModel):
    app_mode: AppMode = AppMode.DEMO
    ai_provider: str
    model_name: str | None = None
    ai_configured: bool
    fallback_available: bool = True
    storage_backend: str
    auth_required: bool
    total_checkpoints: int
    total_episodes: int
    real_llm_runs: int
    mock_runs: int
    baseline_runs: int
    last_ai_run_at: datetime | None = None
    last_ai_run_provider: str | None = None
    last_ai_run_model: str | None = None


class DataGovernancePolicy(BaseModel):
    student_notice: str
    retention_days: int
    deidentify_exports_by_default: bool = True
    student_misconception_labels_hidden: bool = True
    raw_answer_access: str = "teacher_and_authorized_researcher"


class AuthLoginRequest(BaseModel):
    role: str = Field(pattern="^(teacher|researcher)$")
    access_code: str = Field(min_length=1, max_length=200)


class AuthSession(BaseModel):
    role: str
    access_token: str
    auth_required: bool


class InputPack(BaseModel):
    episode_id: str
    question: str
    student_answer: str
    target_concept: str
    lesson_phase: LessonPhase
    current_activity: CurrentActivity
    visibility_policy: VisibilityPolicy
    teacher_notes: str = ""
    prior_context: dict[str, Any] = Field(default_factory=dict)


class GateDecision(BaseModel):
    move: GateMove
    why_this_move: str
    teacher_move: str
    gate_reasons: list[str]
    fallback_reason: str | None = None
    downgrade_reason: str | None = None
    blocked_actions: list[GateMove] = Field(default_factory=list)


class TeacherCard(BaseModel):
    id: str
    response_id: str
    response_revision: int = 1
    gate_decision: GateDecision
    candidate_output: CandidateOutput
    ai_provider: str = "mock"
    model_name: str | None = None
    prompt_version: str = "mock-v0.1"
    ai_schema_version: str = "candidate-output-v0.1"
    raw_llm_valid: bool = True
    validation_error: str | None = None
    provider_error: str | None = None
    downgrade_reason: str | None = None
    fallback_used: bool = False
    shown_at: datetime


class AnalyzeResponseResult(BaseModel):
    ai_run_id: str
    card: TeacherCard
    latency_ms: int
    cached: bool = False
    ai_provider: str = "mock"
    model_name: str | None = None
    raw_llm_valid: bool = True
    fallback_used: bool = False


class AnalysisCacheClearResult(BaseModel):
    response_id: str
    cleared_cards: int


class AIProviderSmokeTestRequest(BaseModel):
    question: str = Field(
        default="汽车向前运动，但速度越来越小，它的加速度方向是什么？",
        min_length=4,
        max_length=500,
    )
    answer_text: str = Field(default="向前，因为车还在往前走。", min_length=1, max_length=200)
    target_concept: str = Field(default="加速度方向", min_length=2, max_length=120)
    lesson_phase: LessonPhase = LessonPhase.PRACTICE
    current_activity: CurrentActivity = CurrentActivity.WHOLE_CLASS
    visibility_policy: VisibilityPolicy = VisibilityPolicy.TEACHER_ONLY


class AIProviderSmokeTestResult(BaseModel):
    ai_provider: str
    model_name: str | None = None
    configured: bool
    latency_ms: int
    raw_llm_valid: bool
    fallback_used: bool
    quote_audit_passed: bool
    validation_error: str | None = None
    provider_error: str | None = None
    downgrade_reason: str | None = None
    gate_decision: GateDecision
    candidate_output: CandidateOutput


class ExperimentalConditionRequest(BaseModel):
    response_id: str
    condition: ExperimentCondition


class ExperimentalConditionResult(BaseModel):
    condition: ExperimentCondition
    response_id: str
    episode_log_id: str | None = None
    teacher_card: str
    move: GateMove | None = None
    ai_provider: str = "rule"
    model_name: str | None = None
    raw_llm_valid: bool = True
    fallback_used: bool = False
    downgrade_reason: str | None = None


class StudyMaterialRequest(BaseModel):
    response_id: str
    conditions: list[ExperimentCondition] = Field(
        default_factory=lambda: [
            ExperimentCondition.NO_AI,
            ExperimentCondition.STANDARD_LLM,
            ExperimentCondition.OVER_COMMITTED,
            ExperimentCondition.EVIDENCE_ONLY,
            ExperimentCondition.PROBEMATE,
        ],
        min_length=1,
    )
    blind_labels: bool = True
    randomize_order: bool = False


class StudyMaterialRow(BaseModel):
    material_id: str
    episode_log_id: str | None = None
    assistant_label: str
    condition: ExperimentCondition
    response_id: str
    question: str
    student_answer: str
    target_concept: str | None = None
    lesson_phase: LessonPhase | None = None
    current_activity: CurrentActivity | None = None
    teacher_card: str
    move: GateMove | None = None
    ai_provider: str
    model_name: str | None = None
    raw_llm_valid: bool = True
    fallback_used: bool = False
    downgrade_reason: str | None = None


class StudyMaterialResult(BaseModel):
    response_id: str
    rows: list[StudyMaterialRow]


class StudyNextTurnRequest(BaseModel):
    episode_log_id: str
    teacher_next_turn: str = Field(min_length=1, max_length=500)
    decision_time_ms: int = Field(ge=0)
    perceived_load: int | None = Field(default=None, ge=1, le=7)
    note: str | None = Field(default=None, max_length=500)


class PhaseManipulationRequest(BaseModel):
    lesson_phase: LessonPhase
    current_activity: CurrentActivity
    provider_mode: ProviderRunMode = ProviderRunMode.MOCK
    answer_text: str = "向前，因为车还在往前走。"
    question: str = "汽车向前运动，但速度越来越小，它的加速度方向是什么？"
    target_concept: str = "加速度方向"


class PhaseManipulationResult(BaseModel):
    lesson_phase: LessonPhase
    current_activity: CurrentActivity
    provider_mode: ProviderRunMode = ProviderRunMode.MOCK
    ai_provider: str = "mock"
    model_name: str | None = None
    raw_llm_valid: bool = True
    fallback_used: bool = False
    quote_audit_passed: bool = True
    move: GateMove
    teacher_move: str
    why_this_move: str
    downgrade_reason: str | None = None


class TeacherActionCreate(BaseModel):
    card_id: str
    action: TeacherAction
    edited_text: str | None = Field(default=None, max_length=500)
    final_turn: str | None = Field(default=None, max_length=500)
    decision_time_ms: int | None = Field(default=None, ge=0)
    teacher_feedback: str | None = Field(default=None, max_length=500)
    queue_note: str | None = Field(default=None, max_length=500)


class TeacherActionRead(TeacherActionCreate):
    id: str
    created_at: datetime
    edit_distance: int | None = None


class EpisodeLog(BaseModel):
    id: str
    source: str
    condition: str
    checkpoint_id: str
    response_id: str
    response_revision: int = 1
    question: str
    student_answer: str
    target_concept: str | None = None
    lesson_phase: LessonPhase | None = None
    current_activity: CurrentActivity | None = None
    visibility_policy: VisibilityPolicy | None = None
    class_name: str | None = None
    response_source: ResponseSource | None = None
    confidence_level: StudentConfidence | None = None
    card_id: str | None = None
    ai_run_id: str | None = None
    latency_ms: int | None = None
    system_move: GateMove | None = None
    evidence_state: EvidenceState | None = None
    distinguishability: str | None = None
    candidate_labels: list[str] = Field(default_factory=list)
    gate_reasons: list[str] = Field(default_factory=list)
    fallback_reason: str | None = None
    blocked_actions: list[GateMove] = Field(default_factory=list)
    shown_teacher_move: str | None = None
    analysis_cached: bool = False
    gate_version: str = "gate-v0.1"
    schema_version: str = "episode-log-v0.2"
    prompt_version: str = "mock-v0.1"
    ai_schema_version: str = "candidate-output-v0.1"
    ai_provider: str = "mock"
    model_name: str | None = None
    raw_llm_valid: bool = True
    validation_error: str | None = None
    provider_error: str | None = None
    downgrade_reason: str | None = None
    fallback_used: bool = False
    queue_state: QueueState = QueueState.NONE
    teacher_action: TeacherAction | None = None
    teacher_final_turn: str | None = None
    teacher_feedback: str | None = None
    queue_note: str | None = None
    decision_time_ms: int | None = None
    checkpoint_duration_ms: int | None = None
    study_perceived_load: int | None = Field(default=None, ge=1, le=7)
    study_note: str | None = Field(default=None, max_length=500)
    expert_preferred_move: GateMove | None = None
    commitment_distance: int | None = Field(default=None, ge=-2, le=2)
    harmful_over_commitment: bool | None = None
    harmful_under_commitment: bool | None = None
    answer_leakage: bool | None = None
    self_correction_support: int | None = Field(default=None, ge=1, le=5)
    annotation_note: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StudyNextTurnResult(BaseModel):
    episode_log: EpisodeLog


class EpisodeAnnotationUpdate(BaseModel):
    expert_preferred_move: GateMove | None = None
    commitment_distance: int | None = Field(default=None, ge=-2, le=2)
    harmful_over_commitment: bool | None = None
    harmful_under_commitment: bool | None = None
    answer_leakage: bool | None = None
    self_correction_support: int | None = Field(default=None, ge=1, le=5)
    annotation_note: str | None = Field(default=None, max_length=500)


class ResearchEvidenceSummary(BaseModel):
    total_episodes: int
    real_llm_runs: int
    mock_runs: int
    baseline_runs: int
    fallback_count: int
    invalid_llm_count: int
    evidence_first_actions: int
    bad_timing_holds: int
    no_quote_downgrades: int
    answer_leakage_downgrades: int
    teacher_edits: int
    teacher_delays: int
    harmful_over_commitment: int
    harmful_under_commitment: int
    provider_counts: dict[str, int]
    condition_counts: dict[str, int]
    downgrade_counts: dict[str, int]


class SystemModeUpdate(BaseModel):
    app_mode: AppMode


class DemoDataResult(BaseModel):
    app_mode: AppMode
    checkpoints: int
    responses: int
    episode_logs: int


class DataDictionaryField(BaseModel):
    name: str
    type: str
    description: str
    source: str
    allowed_values: list[str] = Field(default_factory=list)
    pii_risk: str = "low"
