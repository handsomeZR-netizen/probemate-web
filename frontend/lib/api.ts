import type {
  AIProviderStatus,
  AIProviderSmokeTestResult,
  AnalyzeResponseResult,
  AppMode,
  AuthSession,
  Checkpoint,
  CheckpointTemplate,
  CheckpointStatus,
  CurrentActivity,
  DataDictionaryField,
  DataGovernancePolicy,
  DemoDataResult,
  EpisodeLog,
  ExperimentCondition,
  ExperimentalConditionResult,
  GateMove,
  LessonPhase,
  PhaseManipulationResult,
  ProviderRunMode,
  QueueState,
  ResearchEvidenceSummary,
  ResponseSource,
  StudentConfidence,
  StudentResponse,
  StudyMaterialResult,
  StudyNextTurnResult,
  SystemStatus,
  TeacherAction
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const AUTH_STORAGE_KEY = "probemate-auth-token";

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window === "undefined" ? null : window.localStorage.getItem(AUTH_STORAGE_KEY);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let detail = `Request failed: ${response.status}`;
    if (contentType.includes("application/json")) {
      const body = (await response.json()) as { detail?: unknown };
      detail = typeof body.detail === "string" ? body.detail : detail;
    } else {
      detail = (await response.text()) || detail;
    }
    throw new ApiError(response.status, detail);
  }
  return (await response.json()) as T;
}

export function listCheckpoints(): Promise<Checkpoint[]> {
  return request<Checkpoint[]>("/checkpoints");
}

export function saveAuthSession(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, session.access_token);
}

export function clearAuthSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function login(payload: { role: "teacher" | "researcher"; access_code: string }): Promise<AuthSession> {
  return request<AuthSession>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getAIProviderStatus(): Promise<AIProviderStatus> {
  return request<AIProviderStatus>("/ai/provider-status");
}

export function getDataGovernancePolicy(): Promise<DataGovernancePolicy> {
  return request<DataGovernancePolicy>("/data-governance");
}

export function getSystemStatus(): Promise<SystemStatus> {
  return request<SystemStatus>("/system/status");
}

export function updateSystemMode(appMode: AppMode): Promise<SystemStatus> {
  return request<SystemStatus>("/system/mode", {
    method: "PATCH",
    body: JSON.stringify({ app_mode: appMode })
  });
}

export function resetDemoData(): Promise<DemoDataResult> {
  return request<DemoDataResult>("/system/demo-data/reset", {
    method: "POST"
  });
}

export function clearDemoData(): Promise<DemoDataResult> {
  return request<DemoDataResult>("/system/demo-data/clear", {
    method: "POST"
  });
}

export function runAIProviderSmokeTest(payload: {
  question: string;
  answer_text: string;
  target_concept: string;
  lesson_phase: LessonPhase;
  current_activity: CurrentActivity;
}): Promise<AIProviderSmokeTestResult> {
  return request<AIProviderSmokeTestResult>("/ai/provider-smoke-test", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function listCheckpointTemplates(): Promise<CheckpointTemplate[]> {
  return request<CheckpointTemplate[]>("/checkpoint-templates");
}

export function createCheckpoint(payload: {
  question: string;
  target_concept: string;
  lesson_phase: LessonPhase;
  current_activity: CurrentActivity;
  visibility_policy: "teacher_only" | "anonymous_representative" | "allow_public_display";
  class_name?: string;
}): Promise<Checkpoint> {
  return request<Checkpoint>("/checkpoints", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getCheckpoint(id: string): Promise<Checkpoint> {
  return request<Checkpoint>(`/checkpoints/${id}`);
}

export function updateCheckpoint(
  id: string,
  payload: {
    status?: CheckpointStatus;
    current_activity?: CurrentActivity;
    lesson_phase?: LessonPhase;
    visibility_policy?: Checkpoint["visibility_policy"];
  }
): Promise<Checkpoint> {
  return request<Checkpoint>(`/checkpoints/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function getCheckpointByCode(code: string): Promise<Checkpoint> {
  return request<Checkpoint>(`/checkpoints/code/${code}`);
}

export function listResponses(checkpointId: string): Promise<StudentResponse[]> {
  return request<StudentResponse[]>(`/checkpoints/${checkpointId}/responses`);
}

export function submitResponse(
  checkpointId: string,
  payload: {
    anonymous_student_id?: string;
    answer_text: string;
    response_source?: ResponseSource;
    confidence_level?: StudentConfidence;
  }
): Promise<StudentResponse> {
  return request<StudentResponse>(`/checkpoints/${checkpointId}/responses`, {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateResponse(
  responseId: string,
  payload: {
    answer_text?: string;
    anonymous_student_id?: string;
    confidence_level?: StudentConfidence;
    is_representative?: boolean;
    selection_reason?: string;
    selected_by_role?: string;
  }
): Promise<StudentResponse> {
  return request<StudentResponse>(`/responses/${responseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function analyzeResponse(responseId: string): Promise<AnalyzeResponseResult> {
  return request<AnalyzeResponseResult>(`/responses/${responseId}/analyze`, {
    method: "POST"
  });
}

export function rerunAnalysis(responseId: string): Promise<AnalyzeResponseResult> {
  return request<AnalyzeResponseResult>(`/responses/${responseId}/analyze?rerun=true`, {
    method: "POST"
  });
}

export function clearAnalysisCache(responseId: string): Promise<{ response_id: string; cleared_cards: number }> {
  return request<{ response_id: string; cleared_cards: number }>(`/responses/${responseId}/analysis-cache`, {
    method: "DELETE"
  });
}

export function createTeacherAction(payload: {
  card_id: string;
  action: TeacherAction;
  edited_text?: string;
  final_turn?: string;
  decision_time_ms?: number;
  teacher_feedback?: string;
  queue_note?: string;
}): Promise<unknown> {
  return request<unknown>("/teacher-actions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export interface EpisodeLogFilters {
  checkpoint_id?: string;
  system_move?: GateMove | "all";
  teacher_action?: TeacherAction | "all";
  response_source?: ResponseSource | "all";
  queue_state?: QueueState | "all";
  condition?: ExperimentCondition | "all";
  limit?: number;
  offset?: number;
}

function episodeLogSearchParams(filters?: EpisodeLogFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === "" || value === "all") {
      return;
    }
    params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function listEpisodeLogs(filters?: EpisodeLogFilters): Promise<EpisodeLog[]> {
  return request<EpisodeLog[]>(`/research/episode-logs${episodeLogSearchParams(filters)}`);
}

export function episodeLogsCsvUrl(filters?: EpisodeLogFilters & { deidentify?: boolean }): string {
  return `${API_BASE_URL}/research/episode-logs.csv${episodeLogSearchParams(filters)}`;
}

export function listDataDictionary(): Promise<DataDictionaryField[]> {
  return request<DataDictionaryField[]>("/research/data-dictionary");
}

export function getResearchEvidenceSummary(): Promise<ResearchEvidenceSummary> {
  return request<ResearchEvidenceSummary>("/research/evidence-summary");
}

export function updateEpisodeAnnotation(
  logId: string,
  payload: {
    expert_preferred_move?: GateMove | null;
    commitment_distance?: number | null;
    harmful_over_commitment?: boolean | null;
    harmful_under_commitment?: boolean | null;
    answer_leakage?: boolean | null;
    self_correction_support?: number | null;
    annotation_note?: string | null;
  }
): Promise<EpisodeLog> {
  return request<EpisodeLog>(`/research/episode-logs/${logId}/annotation`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

export function generateExperimentalCondition(payload: {
  response_id: string;
  condition: ExperimentCondition;
}): Promise<ExperimentalConditionResult> {
  return request<ExperimentalConditionResult>("/experimental/generate-condition", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function generateStudyMaterials(payload: {
  response_id: string;
  conditions: ExperimentCondition[];
  blind_labels?: boolean;
  randomize_order?: boolean;
}): Promise<StudyMaterialResult> {
  return request<StudyMaterialResult>("/study-builder/materials", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function submitStudyNextTurn(payload: {
  episode_log_id: string;
  teacher_next_turn: string;
  decision_time_ms: number;
  perceived_load?: number;
  note?: string;
}): Promise<StudyNextTurnResult> {
  return request<StudyNextTurnResult>("/study-builder/next-turns", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function runPhaseManipulation(payload: {
  lesson_phase: LessonPhase;
  current_activity: CurrentActivity;
  provider_mode?: ProviderRunMode;
  answer_text?: string;
  question?: string;
  target_concept?: string;
}): Promise<PhaseManipulationResult> {
  return request<PhaseManipulationResult>("/demo/phase-manipulation", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
