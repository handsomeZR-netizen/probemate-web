import csv
import random
from io import StringIO

from app.schemas.models import (
    CheckpointRead,
    EpisodeLog,
    ExperimentCondition,
    StudyMaterialRequest,
    StudyMaterialResult,
    StudyMaterialRow,
    StudyNextTurnRequest,
)
from app.services.experimental import generate_experimental_condition
from app.services.store import store


BLIND_LABELS = ["Assistant A", "Assistant B", "Assistant C", "Assistant D", "Assistant E"]


def generate_study_materials(payload: StudyMaterialRequest) -> StudyMaterialResult:
    response = store.get_response(payload.response_id)
    if response is None:
        raise ValueError("Response not found")
    checkpoint = store.get_checkpoint(response.checkpoint_id)
    if checkpoint is None:
        raise ValueError("Checkpoint not found")
    rows: list[StudyMaterialRow] = []
    conditions = list(payload.conditions)
    if payload.randomize_order:
        random.shuffle(conditions)
    for index, condition in enumerate(conditions):
        result = generate_experimental_condition(checkpoint, response, condition)
        assistant_label = BLIND_LABELS[index] if payload.blind_labels and index < len(BLIND_LABELS) else condition.value
        rows.append(
            StudyMaterialRow(
                material_id=f"{response.id}_{condition.value}",
                episode_log_id=result.episode_log_id,
                assistant_label=assistant_label,
                condition=condition,
                response_id=response.id,
                question=checkpoint.question,
                student_answer=response.answer_text,
                target_concept=checkpoint.target_concept,
                lesson_phase=checkpoint.lesson_phase,
                current_activity=checkpoint.current_activity,
                teacher_card=result.teacher_card,
                move=result.move,
                ai_provider=result.ai_provider,
                model_name=result.model_name,
                raw_llm_valid=result.raw_llm_valid,
                fallback_used=result.fallback_used,
                downgrade_reason=result.downgrade_reason,
            )
        )
    return StudyMaterialResult(response_id=response.id, rows=rows)


def record_study_next_turn(payload: StudyNextTurnRequest) -> EpisodeLog:
    log = store.record_study_next_turn(payload)
    if log is None:
        raise ValueError("Episode log not found")
    return log


def study_materials_to_csv(rows: list[StudyMaterialRow]) -> str:
    columns = list(StudyMaterialRow.model_fields.keys())
    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow(row.model_dump(mode="json"))
    return buffer.getvalue()


def rating_template_to_csv(rows: list[StudyMaterialRow]) -> str:
    columns = [
        "material_id",
        "assistant_label",
        "expert_preferred_move",
        "commitment_distance",
        "harmful_over_commitment",
        "harmful_under_commitment",
        "answer_leakage",
        "self_correction_support",
        "notes",
    ]
    buffer = StringIO()
    writer = csv.DictWriter(buffer, fieldnames=columns, lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({"material_id": row.material_id, "assistant_label": row.assistant_label})
    return buffer.getvalue()


def checkpoint_for_response(response_id: str) -> CheckpointRead | None:
    response = store.get_response(response_id)
    if response is None:
        return None
    return store.get_checkpoint(response.checkpoint_id)
