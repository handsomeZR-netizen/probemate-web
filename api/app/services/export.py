import csv
import hashlib
from io import StringIO

from app.schemas.models import EpisodeLog


CSV_COLUMNS = [
    "id",
    "created_at",
    "condition",
    "checkpoint_id",
    "response_id",
    "response_revision",
    "question",
    "student_answer",
    "target_concept",
    "lesson_phase",
    "current_activity",
    "visibility_policy",
    "response_source",
    "confidence_level",
    "card_id",
    "ai_run_id",
    "latency_ms",
    "system_move",
    "evidence_state",
    "distinguishability",
    "candidate_labels",
    "gate_reasons",
    "fallback_reason",
    "blocked_actions",
    "shown_teacher_move",
    "analysis_cached",
    "gate_version",
    "schema_version",
    "prompt_version",
    "queue_state",
    "teacher_action",
    "teacher_final_turn",
    "teacher_feedback",
    "queue_note",
    "decision_time_ms",
    "checkpoint_duration_ms",
]

ID_COLUMNS = {"id", "checkpoint_id", "response_id", "card_id", "ai_run_id"}


def deidentify_value(value: object) -> object:
    if value is None:
        return None
    digest = hashlib.sha256(str(value).encode("utf-8")).hexdigest()[:12]
    return f"id_{digest}"


def format_cell(value: object) -> object:
    if isinstance(value, list):
        return "|".join(str(item) for item in value)
    if isinstance(value, str) and value[:1] in {"=", "+", "-", "@"}:
        return f"'{value}"
    return value


def episode_logs_to_csv(logs: list[EpisodeLog], deidentify: bool = False) -> str:
    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_COLUMNS, lineterminator="\n")
    writer.writeheader()
    for log in logs:
        row = log.model_dump(mode="json")
        if deidentify:
            for column in ID_COLUMNS:
                row[column] = deidentify_value(row.get(column))
        writer.writerow({column: format_cell(row.get(column)) for column in CSV_COLUMNS})
    return buffer.getvalue()
