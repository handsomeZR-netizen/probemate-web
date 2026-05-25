import type {
  AnalyzeResponseResult,
  Checkpoint,
  CheckpointTemplate,
  CheckpointStatus,
  CurrentActivity,
  DataDictionaryField,
  EpisodeLog,
  GateMove,
  LessonPhase,
  QueueState,
  ResponseSource,
  StudentConfidence,
  StudentResponse,
  TeacherAction
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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

export function listCheckpointTemplates(): Promise<CheckpointTemplate[]> {
  return request<CheckpointTemplate[]>("/checkpoint-templates");
}

export function createCheckpoint(payload: {
  question: string;
  target_concept: string;
  lesson_phase: LessonPhase;
  current_activity: CurrentActivity;
  visibility_policy: "teacher_only" | "anonymous_representative" | "allow_public_display";
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
