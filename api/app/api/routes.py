from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response

from app.schemas.models import (
    AIProviderStatus,
    AnalyzeResponseResult,
    AuthLoginRequest,
    AuthSession,
    CheckpointCreate,
    CheckpointRead,
    CheckpointTemplate,
    CheckpointStatus,
    CheckpointUpdate,
    DataDictionaryField,
    DataGovernancePolicy,
    EpisodeLog,
    ExperimentCondition,
    ExperimentalConditionRequest,
    ExperimentalConditionResult,
    GateMove,
    PhaseManipulationRequest,
    PhaseManipulationResult,
    QueueState,
    ResponseSource,
    StudentResponseCreate,
    StudentResponseRead,
    StudentResponseUpdate,
    TeacherActionCreate,
    TeacherActionRead,
    TeacherAction,
)
from app.services.auth import create_auth_session, require_roles
from app.services.candidate_generators import get_provider_status
from app.services.data_dictionary import list_data_dictionary
from app.services.export import episode_logs_to_csv
from app.services.experimental import generate_experimental_condition, run_phase_manipulation
from app.services.governance import get_data_governance_policy
from app.services.pipeline import analyze_student_response
from app.services.store import store
from app.services.templates import list_checkpoint_templates

router = APIRouter()
teacher_auth_dependency = require_roles("teacher", "researcher")
research_auth_dependency = require_roles("researcher")
teacher_auth = Depends(teacher_auth_dependency)
research_auth = Depends(research_auth_dependency)


@router.post("/auth/login", response_model=AuthSession)
def auth_login(payload: AuthLoginRequest) -> AuthSession:
    return create_auth_session(payload.role, payload.access_code)


@router.get("/ai/provider-status", response_model=AIProviderStatus)
def ai_provider_status() -> AIProviderStatus:
    return get_provider_status()


@router.get("/data-governance", response_model=DataGovernancePolicy)
def data_governance() -> DataGovernancePolicy:
    return get_data_governance_policy()


@router.get("/checkpoints", response_model=list[CheckpointRead], dependencies=[teacher_auth])
def list_checkpoints() -> list[CheckpointRead]:
    return store.list_checkpoints()


@router.post("/checkpoints", response_model=CheckpointRead, dependencies=[teacher_auth])
def create_checkpoint(payload: CheckpointCreate) -> CheckpointRead:
    return store.create_checkpoint(payload)


@router.get("/checkpoint-templates", response_model=list[CheckpointTemplate], dependencies=[teacher_auth])
def checkpoint_templates() -> list[CheckpointTemplate]:
    return list_checkpoint_templates()


@router.patch("/checkpoints/{checkpoint_id}", response_model=CheckpointRead, dependencies=[teacher_auth])
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


@router.get("/checkpoints/{checkpoint_id}", response_model=CheckpointRead, dependencies=[teacher_auth])
def get_checkpoint(checkpoint_id: str) -> CheckpointRead:
    checkpoint = store.get_checkpoint(checkpoint_id)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return checkpoint


@router.get("/checkpoints/{checkpoint_id}/responses", response_model=list[StudentResponseRead], dependencies=[teacher_auth])
def list_responses(checkpoint_id: str) -> list[StudentResponseRead]:
    if store.get_checkpoint(checkpoint_id) is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return store.list_responses(checkpoint_id)


@router.post("/checkpoints/{checkpoint_id}/responses", response_model=StudentResponseRead)
def create_response(
    checkpoint_id: str,
    payload: StudentResponseCreate,
    authorization: str | None = Header(default=None),
) -> StudentResponseRead:
    checkpoint = store.get_checkpoint(checkpoint_id)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    if checkpoint.status == CheckpointStatus.CLOSED:
        raise HTTPException(status_code=409, detail="Checkpoint is closed")
    if payload.response_source != ResponseSource.STUDENT_QR:
        teacher_auth_dependency(authorization)
    return store.create_response(checkpoint_id, payload)


@router.patch("/responses/{response_id}", response_model=StudentResponseRead, dependencies=[teacher_auth])
def update_response(response_id: str, payload: StudentResponseUpdate) -> StudentResponseRead:
    try:
        response = store.update_response(response_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if response is None:
        raise HTTPException(status_code=404, detail="Response not found")
    return response


@router.post("/responses/{response_id}/analyze", response_model=AnalyzeResponseResult, dependencies=[teacher_auth])
def analyze_response(response_id: str, rerun: bool = False) -> AnalyzeResponseResult:
    response = store.get_response(response_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Response not found")
    checkpoint = store.get_checkpoint(response.checkpoint_id)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return analyze_student_response(checkpoint, response, force_rerun=rerun)


@router.post(
    "/experimental/generate-condition",
    response_model=ExperimentalConditionResult,
    dependencies=[teacher_auth],
)
def experimental_condition(payload: ExperimentalConditionRequest) -> ExperimentalConditionResult:
    response = store.get_response(payload.response_id)
    if response is None:
        raise HTTPException(status_code=404, detail="Response not found")
    checkpoint = store.get_checkpoint(response.checkpoint_id)
    if checkpoint is None:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return generate_experimental_condition(checkpoint, response, payload.condition)


@router.post("/demo/phase-manipulation", response_model=PhaseManipulationResult)
def phase_manipulation(payload: PhaseManipulationRequest) -> PhaseManipulationResult:
    return run_phase_manipulation(payload)


@router.post("/teacher-actions", response_model=TeacherActionRead, dependencies=[teacher_auth])
def create_teacher_action(payload: TeacherActionCreate) -> TeacherActionRead:
    if store.get_card(payload.card_id) is None:
        raise HTTPException(status_code=404, detail="Teacher card not found")
    return store.create_teacher_action(payload)


@router.get("/research/episode-logs", response_model=list[EpisodeLog], dependencies=[research_auth])
def list_episode_logs(
    checkpoint_id: str | None = None,
    system_move: GateMove | None = None,
    teacher_action: TeacherAction | None = None,
    response_source: ResponseSource | None = None,
    queue_state: QueueState | None = None,
    condition: ExperimentCondition | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> list[EpisodeLog]:
    return store.list_episode_logs(
        checkpoint_id=checkpoint_id,
        system_move=system_move,
        teacher_action=teacher_action,
        response_source=response_source,
        queue_state=queue_state,
        condition=condition,
        limit=limit,
        offset=offset,
    )


@router.get("/research/episode-logs.csv", dependencies=[research_auth])
def export_episode_logs_csv(
    checkpoint_id: str | None = None,
    system_move: GateMove | None = None,
    teacher_action: TeacherAction | None = None,
    response_source: ResponseSource | None = None,
    queue_state: QueueState | None = None,
    condition: ExperimentCondition | None = None,
    deidentify: bool = True,
) -> Response:
    logs = store.list_episode_logs(
        checkpoint_id=checkpoint_id,
        system_move=system_move,
        teacher_action=teacher_action,
        response_source=response_source,
        queue_state=queue_state,
        condition=condition,
    )
    csv_text = episode_logs_to_csv(logs, deidentify=deidentify)
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="probemate-episode-logs.csv"'},
    )


@router.get("/research/data-dictionary", response_model=list[DataDictionaryField], dependencies=[research_auth])
def research_data_dictionary() -> list[DataDictionaryField]:
    return list_data_dictionary()
