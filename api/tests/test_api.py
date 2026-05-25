from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_episode_flow() -> None:
    checkpoint_response = client.post(
        "/checkpoints",
        json={
            "question": "汽车向前运动，但速度越来越小，它的加速度方向是什么？",
            "target_concept": "加速度方向",
            "lesson_phase": "introduce",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    assert checkpoint_response.status_code == 200
    checkpoint = checkpoint_response.json()

    student_response = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={
            "answer_text": "向前，因为车还在往前走。",
            "anonymous_student_id": "S01",
            "confidence_level": "low",
        },
    )
    assert student_response.status_code == 200
    response = student_response.json()

    analysis_response = client.post(f"/responses/{response['id']}/analyze")
    assert analysis_response.status_code == 200
    analysis = analysis_response.json()
    card = analysis["card"]
    assert analysis["ai_run_id"].startswith("run_")
    assert card["gate_decision"]["move"] == "ask_for_evidence"

    action_response = client.post(
        "/teacher-actions",
        json={
            "card_id": card["id"],
            "action": "use",
            "final_turn": card["gate_decision"]["teacher_move"],
            "decision_time_ms": 12000,
        },
    )
    assert action_response.status_code == 200

    logs_response = client.get("/research/episode-logs")
    assert logs_response.status_code == 200
    matching_log = next(log for log in logs_response.json() if log["response_id"] == response["id"])
    assert matching_log["card_id"] == card["id"]
    assert matching_log["ai_run_id"] == analysis["ai_run_id"]
    assert matching_log["target_concept"] == "加速度方向"
    assert matching_log["response_source"] == "student_qr"
    assert matching_log["confidence_level"] == "low"
    assert matching_log["evidence_state"] == "ambiguous"
    assert matching_log["gate_reasons"] == [
        "student_quote_exists",
        "evidence_ambiguous",
        "short_probe_can_add_evidence",
    ]
    assert matching_log["shown_teacher_move"] == card["gate_decision"]["teacher_move"]
    assert matching_log["teacher_action"] == "use"
    assert matching_log["decision_time_ms"] == 12000


def test_teacher_representative_source_marks_response() -> None:
    checkpoint_response = client.post(
        "/checkpoints",
        json={
            "question": "减速运动中，加速度方向如何判断？",
            "target_concept": "速度变化量",
            "lesson_phase": "introduce",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    checkpoint = checkpoint_response.json()

    response = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={
            "answer_text": "看速度变化量，应该向后。",
            "anonymous_student_id": "T-rep",
            "response_source": "teacher_representative",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["response_source"] == "teacher_representative"
    assert payload["is_representative"] is True
    assert payload["selection_reason"] == "teacher_representative_input"
    assert payload["selected_by_role"] == "teacher"
    assert payload["selected_for_analysis_at"] is not None


def test_checkpoint_templates_are_available() -> None:
    response = client.get("/checkpoint-templates")

    assert response.status_code == 200
    templates = response.json()
    assert len(templates) >= 3
    assert {template["id"] for template in templates} >= {
        "acceleration-direction",
        "free-fall-weight",
        "friction-direction",
    }


def test_research_data_dictionary_documents_key_fields() -> None:
    response = client.get("/research/data-dictionary")

    assert response.status_code == 200
    fields = {field["name"]: field for field in response.json()}
    assert "confidence_level" in fields
    assert fields["confidence_level"]["allowed_values"] == ["unsure", "low", "medium", "high"]
    assert "queue_state" in fields


def test_patch_response_representative_selection() -> None:
    checkpoint_response = client.post(
        "/checkpoints",
        json={
            "question": "箱子上放一本书，箱子被推着匀速前进。书受到的摩擦力方向是什么？",
            "target_concept": "摩擦力方向",
            "lesson_phase": "practice",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    checkpoint = checkpoint_response.json()
    student_response = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={"answer_text": "向后，因为摩擦力总是阻碍运动。", "anonymous_student_id": "S03"},
    )
    response = student_response.json()

    patch_response = client.patch(
        f"/responses/{response['id']}",
        json={"is_representative": True, "selection_reason": "teacher_selected"},
    )

    assert patch_response.status_code == 200
    updated = patch_response.json()
    assert updated["is_representative"] is True
    assert updated["selection_reason"] == "teacher_selected"
    assert updated["selected_by_role"] == "teacher"
    assert updated["selected_for_analysis_at"] is not None


def test_closed_checkpoint_rejects_student_submission() -> None:
    checkpoint_response = client.post(
        "/checkpoints",
        json={
            "question": "铁球和木球同时释放，哪个先落地？",
            "target_concept": "自由落体",
            "lesson_phase": "experiment",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    checkpoint = checkpoint_response.json()

    patch_response = client.patch(
        f"/checkpoints/{checkpoint['id']}",
        json={"status": "closed"},
    )
    assert patch_response.status_code == 200
    assert patch_response.json()["status"] == "closed"

    student_response = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={"answer_text": "铁球，因为更重。", "anonymous_student_id": "S09"},
    )
    assert student_response.status_code == 409


def test_analysis_is_idempotent_by_default() -> None:
    checkpoint_response = client.post(
        "/checkpoints",
        json={
            "question": "箱子上放一本书，箱子被推着匀速前进。书受到的摩擦力方向是什么？",
            "target_concept": "摩擦力方向",
            "lesson_phase": "practice",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    checkpoint = checkpoint_response.json()
    student_response = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={"answer_text": "向后，因为摩擦力总是阻碍运动。", "anonymous_student_id": "S11"},
    )
    response = student_response.json()

    first = client.post(f"/responses/{response['id']}/analyze")
    second = client.post(f"/responses/{response['id']}/analyze")

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["card"]["id"] == second.json()["card"]["id"]
    assert second.json()["cached"] is True

    logs = client.get("/research/episode-logs").json()
    matching_logs = [log for log in logs if log["response_id"] == response["id"]]
    assert len(matching_logs) == 1


def test_student_response_edit_increments_revision_and_invalidates_cached_card() -> None:
    checkpoint_response = client.post(
        "/checkpoints",
        json={
            "question": "汽车向前运动，但速度越来越小，它的加速度方向是什么？",
            "target_concept": "加速度方向",
            "lesson_phase": "introduce",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    checkpoint = checkpoint_response.json()
    student_response = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={"answer_text": "向前，因为车还在往前走。", "anonymous_student_id": "S12"},
    )
    response = student_response.json()

    first = client.post(f"/responses/{response['id']}/analyze")
    patch_response = client.patch(
        f"/responses/{response['id']}",
        json={
            "answer_text": "向后，因为速度变小了。",
            "anonymous_student_id": "S12",
            "confidence_level": "high",
        },
    )
    second = client.post(f"/responses/{response['id']}/analyze")

    assert first.status_code == 200
    assert patch_response.status_code == 200
    assert patch_response.json()["revision"] == 2
    assert second.status_code == 200
    assert second.json()["cached"] is False
    assert second.json()["card"]["id"] != first.json()["card"]["id"]
    assert second.json()["card"]["response_revision"] == 2

    logs = client.get(f"/research/episode-logs?checkpoint_id={checkpoint['id']}").json()
    latest_log = next(log for log in logs if log["response_revision"] == 2)
    assert latest_log["confidence_level"] == "high"


def test_delay_action_adds_episode_to_queue_and_filters_logs() -> None:
    checkpoint_response = client.post(
        "/checkpoints",
        json={
            "question": "铁球和木球同时释放，哪个先落地？",
            "target_concept": "自由落体",
            "lesson_phase": "experiment",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    checkpoint = checkpoint_response.json()
    student_response = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={
            "answer_text": "铁球，因为更重。",
            "anonymous_student_id": "S13",
            "response_source": "teacher_representative",
        },
    )
    response = student_response.json()
    analysis = client.post(f"/responses/{response['id']}/analyze").json()
    card = analysis["card"]

    action_response = client.post(
        "/teacher-actions",
        json={
            "card_id": card["id"],
            "action": "delay",
            "final_turn": card["gate_decision"]["teacher_move"],
            "decision_time_ms": 5000,
            "teacher_feedback": "先等学生补证据。",
            "queue_note": "小组讨论后回看。",
        },
    )

    assert action_response.status_code == 200
    logs_response = client.get(
        f"/research/episode-logs?checkpoint_id={checkpoint['id']}&queue_state=queued&teacher_action=delay"
    )
    logs = logs_response.json()
    assert logs_response.status_code == 200
    assert any(log["response_id"] == response["id"] for log in logs)
    matching = next(log for log in logs if log["response_id"] == response["id"])
    assert matching["queue_state"] == "queued"
    assert matching["teacher_feedback"] == "先等学生补证据。"
    assert matching["queue_note"] == "小组讨论后回看。"


def test_research_logs_csv_export() -> None:
    response = client.get("/research/episode-logs.csv")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "response_source,confidence_level,card_id,ai_run_id,latency_ms,system_move" in response.text
    assert "ckpt_" not in response.text


def test_research_logs_csv_can_export_raw_ids_for_local_debugging() -> None:
    response = client.get("/research/episode-logs.csv?deidentify=false")

    assert response.status_code == 200
    assert "ckpt_" in response.text
