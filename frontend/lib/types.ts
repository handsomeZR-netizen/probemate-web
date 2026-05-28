export type LessonPhase =
  | "introduce"
  | "practice"
  | "review"
  | "group_discussion"
  | "experiment"
  | "wrap_up"
  | "after_class";

export type CurrentActivity =
  | "whole_class"
  | "peer_discussion"
  | "demo"
  | "worksheet"
  | "experiment_observation"
  | "teacher_wrap_up";

export type GateMove = "hold" | "ask_for_evidence" | "diagnostic_probe";
export type TeacherAction = "use" | "edit" | "delay" | "skip";
export type ResponseSource = "student_qr" | "teacher_representative" | "imported_episode";
export type QueueState = "none" | "queued" | "resolved" | "dismissed";
export type StudentConfidence = "unsure" | "low" | "medium" | "high";
export type ProviderRunMode = "mock" | "current";
export type AppMode = "demo" | "research" | "classroom_pilot";
export type ExperimentCondition =
  | "no_ai"
  | "standard_llm"
  | "over_committed"
  | "evidence_only"
  | "probemate";

export interface Checkpoint {
  id: string;
  code: string;
  question: string;
  target_concept: string;
  lesson_phase: LessonPhase;
  current_activity: CurrentActivity;
  visibility_policy: "teacher_only" | "anonymous_representative" | "allow_public_display";
  class_name: string | null;
  status: "open" | "closed";
  created_at: string;
}

export type CheckpointStatus = Checkpoint["status"];

export interface CheckpointTemplate {
  id: string;
  title: string;
  description: string;
  question: string;
  target_concept: string;
  lesson_phase: LessonPhase;
  current_activity: CurrentActivity;
  visibility_policy: Checkpoint["visibility_policy"];
}

export interface StudentResponse {
  id: string;
  checkpoint_id: string;
  anonymous_student_id: string;
  answer_text: string;
  submitted_at: string;
  updated_at: string | null;
  revision: number;
  is_representative: boolean;
  response_source: ResponseSource;
  confidence_level: StudentConfidence | null;
  selected_for_analysis_at: string | null;
  selection_reason: string | null;
  selected_by_role: string | null;
}

export interface CandidateExplanation {
  label: string;
  student_quotes: string[];
  interpretation: string;
  missing_evidence: string;
  risk_if_overdiagnosed: string;
}

export interface SuggestedTeacherMove {
  move_type_hint: GateMove;
  text: string;
  answer_leakage_risk: string;
}

export interface GateDecision {
  move: GateMove;
  why_this_move: string;
  teacher_move: string;
  gate_reasons: string[];
  fallback_reason: string | null;
  downgrade_reason: string | null;
  blocked_actions: GateMove[];
}

export interface TeacherCard {
  id: string;
  response_id: string;
  response_revision: number;
  gate_decision: GateDecision;
  candidate_output: {
    candidate_explanations: CandidateExplanation[];
    evidence_state: string;
    distinguishability: string;
    suggested_teacher_moves: SuggestedTeacherMove[];
    safety_notes: string[];
  };
  ai_provider: string;
  model_name: string | null;
  prompt_version: string;
  ai_schema_version: string;
  raw_llm_valid: boolean;
  validation_error: string | null;
  provider_error: string | null;
  downgrade_reason: string | null;
  fallback_used: boolean;
  shown_at: string;
}

export interface AnalyzeResponseResult {
  ai_run_id: string;
  card: TeacherCard;
  latency_ms: number;
  cached: boolean;
  ai_provider: string;
  model_name: string | null;
  raw_llm_valid: boolean;
  fallback_used: boolean;
}

export interface EpisodeLog {
  id: string;
  source: string;
  condition: string;
  checkpoint_id: string;
  response_id: string;
  response_revision: number;
  question: string;
  student_answer: string;
  target_concept: string | null;
  lesson_phase: LessonPhase | null;
  current_activity: CurrentActivity | null;
  visibility_policy: Checkpoint["visibility_policy"] | null;
  class_name: string | null;
  response_source: ResponseSource | null;
  confidence_level: StudentConfidence | null;
  card_id: string | null;
  ai_run_id: string | null;
  latency_ms: number | null;
  system_move: GateMove | null;
  evidence_state: "none" | "ambiguous" | "sufficient" | null;
  distinguishability: string | null;
  candidate_labels: string[];
  gate_reasons: string[];
  fallback_reason: string | null;
  blocked_actions: GateMove[];
  shown_teacher_move: string | null;
  analysis_cached: boolean;
  gate_version: string;
  schema_version: string;
  prompt_version: string;
  ai_schema_version: string;
  ai_provider: string;
  model_name: string | null;
  raw_llm_valid: boolean;
  validation_error: string | null;
  provider_error: string | null;
  downgrade_reason: string | null;
  fallback_used: boolean;
  queue_state: QueueState;
  teacher_action: TeacherAction | null;
  teacher_final_turn: string | null;
  teacher_feedback: string | null;
  queue_note: string | null;
  decision_time_ms: number | null;
  checkpoint_duration_ms: number | null;
  study_perceived_load: number | null;
  study_note: string | null;
  expert_preferred_move: GateMove | null;
  commitment_distance: number | null;
  harmful_over_commitment: boolean | null;
  harmful_under_commitment: boolean | null;
  answer_leakage: boolean | null;
  self_correction_support: number | null;
  annotation_note: string | null;
  created_at: string;
}

export interface DataDictionaryField {
  name: string;
  type: string;
  description: string;
  source: string;
  allowed_values: string[];
  pii_risk: string;
}

export interface AIProviderStatus {
  ai_provider: string;
  model_name: string | null;
  configured: boolean;
  fallback_available: boolean;
}

export interface SystemStatus {
  app_mode: AppMode;
  ai_provider: string;
  model_name: string | null;
  ai_configured: boolean;
  fallback_available: boolean;
  storage_backend: string;
  auth_required: boolean;
  total_checkpoints: number;
  total_episodes: number;
  real_llm_runs: number;
  mock_runs: number;
  baseline_runs: number;
  last_ai_run_at: string | null;
  last_ai_run_provider: string | null;
  last_ai_run_model: string | null;
}

export interface ResearchEvidenceSummary {
  total_episodes: number;
  real_llm_runs: number;
  mock_runs: number;
  baseline_runs: number;
  fallback_count: number;
  invalid_llm_count: number;
  evidence_first_actions: number;
  bad_timing_holds: number;
  no_quote_downgrades: number;
  answer_leakage_downgrades: number;
  teacher_edits: number;
  teacher_delays: number;
  harmful_over_commitment: number;
  harmful_under_commitment: number;
  provider_counts: Record<string, number>;
  condition_counts: Record<string, number>;
  downgrade_counts: Record<string, number>;
}

export interface StudyMaterialRow {
  material_id: string;
  episode_log_id: string | null;
  assistant_label: string;
  condition: ExperimentCondition;
  response_id: string;
  question: string;
  student_answer: string;
  target_concept: string | null;
  lesson_phase: LessonPhase | null;
  current_activity: CurrentActivity | null;
  teacher_card: string;
  move: GateMove | null;
  ai_provider: string;
  model_name: string | null;
  raw_llm_valid: boolean;
  fallback_used: boolean;
  downgrade_reason: string | null;
}

export interface StudyMaterialResult {
  response_id: string;
  rows: StudyMaterialRow[];
}

export interface StudyNextTurnResult {
  episode_log: EpisodeLog;
}

export interface DemoDataResult {
  app_mode: AppMode;
  checkpoints: number;
  responses: number;
  episode_logs: number;
}

export interface AIProviderSmokeTestResult {
  ai_provider: string;
  model_name: string | null;
  configured: boolean;
  latency_ms: number;
  raw_llm_valid: boolean;
  fallback_used: boolean;
  quote_audit_passed: boolean;
  validation_error: string | null;
  provider_error: string | null;
  downgrade_reason: string | null;
  gate_decision: GateDecision;
  candidate_output: {
    candidate_explanations: CandidateExplanation[];
    evidence_state: string;
    distinguishability: string;
    suggested_teacher_moves: SuggestedTeacherMove[];
    safety_notes: string[];
  };
}

export interface ExperimentalConditionResult {
  condition: ExperimentCondition;
  response_id: string;
  teacher_card: string;
  move: GateMove | null;
  ai_provider: string;
  model_name: string | null;
  raw_llm_valid: boolean;
  fallback_used: boolean;
  downgrade_reason: string | null;
}

export interface PhaseManipulationResult {
  lesson_phase: LessonPhase;
  current_activity: CurrentActivity;
  provider_mode: ProviderRunMode;
  ai_provider: string;
  model_name: string | null;
  raw_llm_valid: boolean;
  fallback_used: boolean;
  quote_audit_passed: boolean;
  move: GateMove;
  teacher_move: string;
  why_this_move: string;
  downgrade_reason: string | null;
}

export interface DataGovernancePolicy {
  student_notice: string;
  retention_days: number;
  deidentify_exports_by_default: boolean;
  student_misconception_labels_hidden: boolean;
  raw_answer_access: string;
}

export interface AuthSession {
  role: string;
  access_token: string;
  auth_required: boolean;
}
