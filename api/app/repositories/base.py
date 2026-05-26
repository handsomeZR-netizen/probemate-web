from typing import Protocol

from app.schemas.models import (
    CheckpointCreate,
    CheckpointRead,
    CheckpointUpdate,
    EpisodeLog,
    StudentResponseCreate,
    StudentResponseRead,
    StudentResponseUpdate,
    TeacherActionCreate,
    TeacherActionRead,
    TeacherCard,
)


class StoreRepository(Protocol):
    def seed(self) -> None: ...

    def list_checkpoints(self) -> list[CheckpointRead]: ...

    def create_checkpoint(self, payload: CheckpointCreate) -> CheckpointRead: ...

    def update_checkpoint(self, checkpoint_id: str, payload: CheckpointUpdate) -> CheckpointRead | None: ...

    def get_checkpoint(self, checkpoint_id: str) -> CheckpointRead | None: ...

    def get_checkpoint_by_code(self, code: str) -> CheckpointRead | None: ...

    def create_response(self, checkpoint_id: str, payload: StudentResponseCreate) -> StudentResponseRead: ...

    def list_responses(self, checkpoint_id: str) -> list[StudentResponseRead]: ...

    def get_response(self, response_id: str) -> StudentResponseRead | None: ...

    def update_response(self, response_id: str, payload: StudentResponseUpdate) -> StudentResponseRead | None: ...

    def save_card(
        self,
        card: TeacherCard,
        force_rerun: bool = False,
        ai_run_id: str | None = None,
        latency_ms: int | None = None,
        analysis_cached: bool = False,
    ) -> TeacherCard: ...

    def save_episode_log(self, log: EpisodeLog) -> EpisodeLog: ...

    def get_card(self, card_id: str) -> TeacherCard | None: ...

    def get_latest_card_for_response(self, response_id: str) -> TeacherCard | None: ...

    def create_teacher_action(self, payload: TeacherActionCreate) -> TeacherActionRead: ...

    def list_episode_logs(
        self,
        checkpoint_id: str | None = None,
        system_move: str | None = None,
        teacher_action: str | None = None,
        response_source: str | None = None,
        queue_state: str | None = None,
        condition: str | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[EpisodeLog]: ...
