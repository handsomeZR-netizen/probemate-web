from fastapi import APIRouter, HTTPException, Query, Response

from app.schemas.models import (
    AnalyzeResponseResult,
    CheckpointCreate,
    CheckpointRead,
    CheckpointTemplate,
    CheckpointStatus,
    CheckpointUpdate,
    DataDictionaryField,
    EpisodeLog,
    GateMove,
    QueueState,
    ResponseSource,
    StudentResponseCreate,
    StudentResponseRead,
    StudentResponseUpdate,
    TeacherActionCreate,
    TeacherActionRead,
    TeacherAction,
)
from app.services.data_dictionary import list_data_dictionary
from app.services.export import episode_logs_to_csv
from app.services.pipeline import analyze_student_response
from app.services.store import store
from app.services.templates import list_checkpoint_templates

router = APIRouter()


@router.get("/checkpoints", response_model=list[CheckpointRead])
def list_checkpoints() -> list[CheckpointRead]:
    return store.list_checkpoints()


@router.post("/checkpoints", response_model=CheckpointRead)
def create_checkpoint(payload: CheckpointCreate) -> CheckpointRead:
    return store.create_checkpoint(payload)


@router.get("/checkpoint-templates", response_model=list[CheckpointTemplate])
def checkpoint_templates() -> list[CheckpointTemplate]:
    return list_checkpoint_templates()


@router.patch("/checkpoints/{checkpoint_id}", response_model=CheckpointRead)
def update_checkpoint(checkpoint_id: str, payload: CheckpointUpdate) -> CheckpointRead:
    checkpoint = store.update_checkpoint(checkpoint_id, payload)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return checkpoint


@router.get("/checkpoints/code/{code}", response_model=CheckpointRead)
def get_checkpoint_by_code(code: str) -> CheckpointRead:
    checkpoint = store.get_checkpoint_by_code(code)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return checkpoint


@router.get("/checkpoints/{checkpoint_id}", response_model=CheckpointRead)
def get_checkpoint(checkpoint_id: str) -> CheckpointRead:
    checkpoint = store.get_checkpoint(checkpoint_id)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return checkpoint


@router.get("/checkpoints/{checkpoint_id}/responses", response_model=list[StudentResponseRead])
def list_responses(checkpoint_id: str) -> list[StudentResponseRead]:
    if store.get_checkpoint(checkpoint_id) is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return store.list_responses(checkpoint_id)


@router.post("/checkpoints/{checkpoint_id}/responses", response_model=StudentResponseRead)
def create_response(checkpoint_id: str, payload: StudentResponseCreate) -> StudentResponseRead:
    checkpoint = store.get_checkpoint(checkpoint_id)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    if checkpoint.status == CheckpointStatus.CLOSED:
        raise HTTPException(status_code=409, detail="Checkpoint is closed")
    return store.create_response(checkpoint_id, payload)


@router.patch("/responses/{response_id}", response_model=StudentResponseRead)
def update_response(response_id: str, payload: StudentResponseUpdate) -> StudentResponseRead:
    try:
        response = store.update_response(response_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if response is None:
        raise HTTPException(status_code=404, detail="Response not found")
    return response


@router.post("/responses/{response_id}/analyze", response_model=AnalyzeResponseResult)
def analyze_response(response_id: str, rerun: bool = False) -> AnalyzeResponseResult:
    response = store.get_response(response_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Response not found")
    checkpoint = store.get_checkpoint(response.checkpoint_id)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return analyze_student_response(checkpoint, response, force_rerun=rerun)


@router.post("/teacher-actions", response_model=TeacherActionRead)
def create_teacher_action(payload: TeacherActionCreate) -> TeacherActionRead:
    if store.get_card(payload.card_id) is None:
        raise HTTPException(status_code=404, detail="Teacher card not found")
    return store.create_teacher_action(payload)


@router.get("/research/episode-logs", response_model=list[EpisodeLog])
def list_episode_logs(
    checkpoint_id: str | None = None,
    system_move: GateMove | None = None,
    teacher_action: TeacherAction | None = None,
    response_source: ResponseSource | None = None,
    queue_state: QueueState | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[EpisodeLog]:
    return store.list_episode_logs(
        checkpoint_id=checkpoint_id,
        system_move=system_move,
        teacher_action=teacher_action,
        response_source=response_source,
        queue_state=queue_state,
        limit=limit,
        offset=offset,
    )


@router.get("/research/episode-logs.csv")
def export_episode_logs_csv(
    checkpoint_id: str | None = None,
    system_move: GateMove | None = None,
    teacher_action: TeacherAction | None = None,
    response_source: ResponseSource | None = None,
    queue_state: QueueState | None = None,
    deidentify: bool = True,
) -> Response:
    logs = store.list_episode_logs(
        checkpoint_id=checkpoint_id,
        system_move=system_move,
        teacher_action=teacher_action,
        response_source=response_source,
        queue_state=queue_state,
    )
    csv_text = episode_logs_to_csv(logs, deidentify=deidentify)
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="probemate-episode-logs.csv"'},
    )


@router.get("/research/data-dictionary", response_model=list[DataDictionaryField])
def research_data_dictionary() -> list[DataDictionaryField]:
    return list_data_dictionary()
