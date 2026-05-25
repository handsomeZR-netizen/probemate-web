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

export interface Checkpoint {
  id: string;
  code: string;
  question: string;
  target_concept: string;
  lesson_phase: LessonPhase;
  current_activity: CurrentActivity;
  visibility_policy: "teacher_only" | "anonymous_representative" | "allow_public_display";
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

export interface GateDecision {
  move: GateMove;
  why_this_move: string;
  teacher_move: string;
  gate_reasons: string[];
  fallback_reason: string | null;
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
    safety_notes: string[];
  };
  shown_at: string;
}

export interface AnalyzeResponseResult {
  ai_run_id: string;
  card: TeacherCard;
  latency_ms: number;
  cached: boolean;
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
  queue_state: QueueState;
  teacher_action: TeacherAction | null;
  teacher_final_turn: string | null;
  teacher_feedback: string | null;
  queue_note: string | null;
  decision_time_ms: number | null;
  checkpoint_duration_ms: number | null;
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
