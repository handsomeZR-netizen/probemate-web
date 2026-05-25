import json
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from uuid import uuid4

from app.schemas.models import (
    CheckpointCreate,
    CheckpointRead,
    CheckpointStatus,
    CheckpointUpdate,
    CurrentActivity,
    EpisodeLog,
    GateMove,
    LessonPhase,
    QueueState,
    ResponseSource,
    StudentResponseCreate,
    StudentResponseRead,
    StudentResponseUpdate,
    TeacherAction,
    TeacherActionCreate,
    TeacherActionRead,
    TeacherCard,
    VisibilityPolicy,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:10]}"


def new_code() -> str:
    return uuid4().hex[:6].upper()


def edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    rows = len(a) + 1
    cols = len(b) + 1
    dp = [[0] * cols for _ in range(rows)]
    for i in range(rows):
        dp[i][0] = i
    for j in range(cols):
        dp[0][j] = j
    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[-1][-1]


class InMemoryStore:
    def __init__(self) -> None:
        default_path = Path(__file__).resolve().parents[2] / "data" / "dev-store.json"
        self.store_path = Path(os.getenv("PROBEMATE_STORE_PATH", str(default_path)))
        self._lock = RLock()
        self.checkpoints: dict[str, CheckpointRead] = {}
        self.responses: dict[str, StudentResponseRead] = {}
        self.cards: dict[str, TeacherCard] = {}
        self.teacher_actions: dict[str, TeacherActionRead] = {}
        self.episode_logs: dict[str, EpisodeLog] = {}
        self.seeded = False
        self.load()

    def load(self) -> None:
        with self._lock:
            if not self.store_path.exists():
                return
            raw = json.loads(self.store_path.read_text(encoding="utf-8"))
            self.checkpoints = {
                item["id"]: CheckpointRead.model_validate(item)
                for item in raw.get("checkpoints", [])
            }
            self.responses = {
                item["id"]: StudentResponseRead.model_validate(item)
                for item in raw.get("responses", [])
            }
            self.cards = {
                item["id"]: TeacherCard.model_validate(item)
                for item in raw.get("cards", [])
            }
            self.teacher_actions = {
                item["id"]: TeacherActionRead.model_validate(item)
                for item in raw.get("teacher_actions", [])
            }
            self.episode_logs = {
                item["id"]: EpisodeLog.model_validate(item)
                for item in raw.get("episode_logs", [])
            }
            self.seeded = bool(self.checkpoints)

    def persist(self) -> None:
        with self._lock:
            self.store_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "schema_version": 1,
                "checkpoints": [
                    item.model_dump(mode="json") for item in self.checkpoints.values()
                ],
                "responses": [item.model_dump(mode="json") for item in self.responses.values()],
                "cards": [item.model_dump(mode="json") for item in self.cards.values()],
                "teacher_actions": [
                    item.model_dump(mode="json") for item in self.teacher_actions.values()
                ],
                "episode_logs": [
                    item.model_dump(mode="json") for item in self.episode_logs.values()
                ],
            }
            tmp_path = self.store_path.with_suffix(".tmp")
            tmp_path.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            tmp_path.replace(self.store_path)

    def seed(self) -> None:
        if self.seeded:
            return
        checkpoint = self.create_checkpoint(
            CheckpointCreate(
                question="汽车向前运动，但速度越来越小，它的加速度方向是什么？",
                target_concept="加速度方向",
                lesson_phase=LessonPhase.INTRODUCE,
                current_activity=CurrentActivity.WHOLE_CLASS,
                visibility_policy=VisibilityPolicy.TEACHER_ONLY,
            )
        )
        self.create_response(
            checkpoint.id,
            StudentResponseCreate(answer_text="向前，因为车还在往前走。", anonymous_student_id="S01"),
        )
        self.create_response(
            checkpoint.id,
            StudentResponseCreate(answer_text="向后，因为速度变小了。", anonymous_student_id="S02"),
        )
        self.seeded = True
        self.persist()

    def list_checkpoints(self) -> list[CheckpointRead]:
        with self._lock:
            return sorted(self.checkpoints.values(), key=lambda item: item.created_at, reverse=True)

    def create_checkpoint(self, payload: CheckpointCreate) -> CheckpointRead:
        with self._lock:
            checkpoint = CheckpointRead(
                id=new_id("ckpt"),
                code=self._new_unique_code_unlocked(),
                status=CheckpointStatus.OPEN,
                created_at=utc_now(),
                **payload.model_dump(),
            )
            self.checkpoints[checkpoint.id] = checkpoint
            self.persist()
            return checkpoint

    def _new_unique_code_unlocked(self) -> str:
        existing_codes = {checkpoint.code for checkpoint in self.checkpoints.values()}
        for _ in range(20):
            code = new_code()
            if code not in existing_codes:
                return code
        raise RuntimeError("Unable to generate a unique checkpoint code")

    def update_checkpoint(self, checkpoint_id: str, payload: CheckpointUpdate) -> CheckpointRead | None:
        with self._lock:
            checkpoint = self.checkpoints.get(checkpoint_id)
            if checkpoint is None:
                return None
            update = payload.model_dump(exclude_none=True)
            updated = checkpoint.model_copy(update=update)
            self.checkpoints[checkpoint_id] = updated
            self.persist()
            return updated

    def get_checkpoint(self, checkpoint_id: str) -> CheckpointRead | None:
        with self._lock:
            return self.checkpoints.get(checkpoint_id)

    def get_checkpoint_by_code(self, code: str) -> CheckpointRead | None:
        with self._lock:
            normalized = code.upper()
            for checkpoint in self.checkpoints.values():
                if checkpoint.code == normalized:
                    return checkpoint
            return None

    def create_response(self, checkpoint_id: str, payload: StudentResponseCreate) -> StudentResponseRead:
        with self._lock:
            now = utc_now()
            is_teacher_representative = payload.response_source == ResponseSource.TEACHER_REPRESENTATIVE
            response = StudentResponseRead(
                id=new_id("resp"),
                checkpoint_id=checkpoint_id,
                anonymous_student_id=payload.anonymous_student_id or new_id("anon"),
                answer_text=payload.answer_text,
                submitted_at=now,
                is_representative=is_teacher_representative,
                response_source=payload.response_source,
                confidence_level=payload.confidence_level,
                selected_for_analysis_at=now if is_teacher_representative else None,
                selection_reason="teacher_representative_input" if is_teacher_representative else None,
                selected_by_role="teacher" if is_teacher_representative else None,
            )
            self.responses[response.id] = response
            self.persist()
            return response

    def list_responses(self, checkpoint_id: str) -> list[StudentResponseRead]:
        with self._lock:
            return [
                response
                for response in sorted(self.responses.values(), key=lambda item: item.submitted_at)
                if response.checkpoint_id == checkpoint_id
            ]

    def get_response(self, response_id: str) -> StudentResponseRead | None:
        with self._lock:
            return self.responses.get(response_id)

    def update_response(
        self, response_id: str, payload: StudentResponseUpdate
    ) -> StudentResponseRead | None:
        with self._lock:
            response = self.responses.get(response_id)
            if response is None:
                return None
            update = payload.model_dump(exclude_unset=True)
            if "answer_text" in update or "anonymous_student_id" in update or "confidence_level" in update:
                checkpoint = self.checkpoints.get(response.checkpoint_id)
                if checkpoint is not None and checkpoint.status == CheckpointStatus.CLOSED:
                    raise ValueError("Checkpoint is closed")
                update["updated_at"] = utc_now()
                if "answer_text" in update:
                    update["revision"] = response.revision + 1
                if update.get("anonymous_student_id") == "":
                    update["anonymous_student_id"] = response.anonymous_student_id
            if "is_representative" in update:
                if payload.is_representative:
                    update["selected_for_analysis_at"] = response.selected_for_analysis_at or utc_now()
                    update["selection_reason"] = payload.selection_reason or "teacher_selected"
                    update["selected_by_role"] = payload.selected_by_role or "teacher"
                else:
                    update["selected_for_analysis_at"] = None
                    update["selection_reason"] = None
                    update["selected_by_role"] = None
            updated = response.model_copy(update=update)
            self.responses[response_id] = updated
            self.persist()
            return updated

    def _latest_card_for_response_unlocked(self, response_id: str) -> TeacherCard | None:
        response = self.responses.get(response_id)
        cards = [
            card
            for card in self.cards.values()
            if card.response_id == response_id
            and (response is None or card.response_revision == response.revision)
        ]
        if not cards:
            return None
        return max(cards, key=lambda card: card.shown_at)

    def save_card(
        self,
        card: TeacherCard,
        force_rerun: bool = False,
        ai_run_id: str | None = None,
        latency_ms: int | None = None,
        analysis_cached: bool = False,
    ) -> TeacherCard:
        with self._lock:
            if not force_rerun:
                existing = self._latest_card_for_response_unlocked(card.response_id)
                if existing is not None:
                    return existing
            self.cards[card.id] = card
            response = self.responses[card.response_id]
            checkpoint = self.checkpoints[response.checkpoint_id]
            queue_state = (
                QueueState.QUEUED
                if card.gate_decision.move == GateMove.HOLD
                else QueueState.NONE
            )
            log = EpisodeLog(
                id=new_id("elog"),
                source="live_checkpoint",
                condition="ProbeMate",
                checkpoint_id=checkpoint.id,
                response_id=response.id,
                response_revision=response.revision,
                question=checkpoint.question,
                student_answer=response.answer_text,
                target_concept=checkpoint.target_concept,
                lesson_phase=checkpoint.lesson_phase,
                current_activity=checkpoint.current_activity,
                visibility_policy=checkpoint.visibility_policy,
                response_source=response.response_source,
                confidence_level=response.confidence_level,
                card_id=card.id,
                ai_run_id=ai_run_id or new_id("run"),
                latency_ms=latency_ms,
                system_move=card.gate_decision.move,
                evidence_state=card.candidate_output.evidence_state,
                distinguishability=card.candidate_output.distinguishability,
                candidate_labels=[
                    candidate.label for candidate in card.candidate_output.candidate_explanations
                ],
                gate_reasons=card.gate_decision.gate_reasons,
                fallback_reason=card.gate_decision.fallback_reason,
                blocked_actions=card.gate_decision.blocked_actions,
                shown_teacher_move=card.gate_decision.teacher_move,
                analysis_cached=analysis_cached,
                queue_state=queue_state,
            )
            self.episode_logs[log.id] = log
            self.persist()
            return card

    def get_card(self, card_id: str) -> TeacherCard | None:
        with self._lock:
            return self.cards.get(card_id)

    def get_latest_card_for_response(self, response_id: str) -> TeacherCard | None:
        with self._lock:
            return self._latest_card_for_response_unlocked(response_id)

    def create_teacher_action(self, payload: TeacherActionCreate) -> TeacherActionRead:
        with self._lock:
            card = self.cards[payload.card_id]
            base_text = card.gate_decision.teacher_move
            edited = payload.edited_text or payload.final_turn or base_text
            action = TeacherActionRead(
                id=new_id("act"),
                created_at=utc_now(),
                edit_distance=edit_distance(base_text, edited),
                **payload.model_dump(),
            )
            self.teacher_actions[action.id] = action
            for log_id, log in list(self.episode_logs.items()):
                if log.card_id == card.id or (
                    log.response_id == card.response_id and log.system_move == card.gate_decision.move
                ):
                    checkpoint = self.checkpoints.get(log.checkpoint_id)
                    checkpoint_duration_ms = None
                    if checkpoint is not None:
                        checkpoint_duration_ms = int(
                            (action.created_at - checkpoint.created_at).total_seconds() * 1000
                        )
                    self.episode_logs[log_id] = log.model_copy(
                        update={
                            "teacher_action": action.action,
                            "teacher_final_turn": action.final_turn
                            or action.edited_text
                            or base_text,
                            "teacher_feedback": action.teacher_feedback,
                            "queue_note": action.queue_note,
                            "decision_time_ms": action.decision_time_ms,
                            "checkpoint_duration_ms": checkpoint_duration_ms,
                            "queue_state": self._queue_state_for_action(action.action),
                        }
                    )
                    break
            self.persist()
            return action

    def _queue_state_for_action(self, action: TeacherAction) -> QueueState:
        if action == TeacherAction.DELAY:
            return QueueState.QUEUED
        if action == TeacherAction.SKIP:
            return QueueState.DISMISSED
        return QueueState.RESOLVED

    def list_episode_logs(
        self,
        checkpoint_id: str | None = None,
        system_move: str | None = None,
        teacher_action: str | None = None,
        response_source: str | None = None,
        queue_state: str | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[EpisodeLog]:
        with self._lock:
            logs = sorted(self.episode_logs.values(), key=lambda item: item.created_at, reverse=True)
            if checkpoint_id is not None:
                logs = [log for log in logs if log.checkpoint_id == checkpoint_id]
            if system_move is not None:
                logs = [log for log in logs if log.system_move == system_move]
            if teacher_action is not None:
                logs = [log for log in logs if log.teacher_action == teacher_action]
            if response_source is not None:
                logs = [log for log in logs if log.response_source == response_source]
            if queue_state is not None:
                logs = [log for log in logs if log.queue_state == queue_state]
            if offset > 0:
                logs = logs[offset:]
            if limit is not None:
                logs = logs[:limit]
            return logs


store = InMemoryStore()
