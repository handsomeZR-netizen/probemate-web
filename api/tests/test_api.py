from fastapi.testclient import TestClient

from app.schemas.models import CandidateOutput
from app.main import app
from app.services.llm_client import LLMValidationError, OpenAIValidationError


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
            "class_name": "研究课 A",
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
    assert matching_log["class_name"] == "研究课 A"
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
    assert "class_name" in fields
    assert "harmful_over_commitment" in fields
    assert "commitment_distance" in fields


def test_data_governance_policy_defaults() -> None:
    response = client.get("/data-governance")

    assert response.status_code == 200
    payload = response.json()
    assert payload["retention_days"] == 180
    assert payload["deidentify_exports_by_default"] is True
    assert payload["student_misconception_labels_hidden"] is True


def test_system_status_reports_command_center_fields() -> None:
    response = client.get("/system/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["ai_provider"]
    assert payload["storage_backend"] in {"json", "postgres"}
    assert isinstance(payload["auth_required"], bool)
    assert payload["total_checkpoints"] >= 0
    assert payload["total_episodes"] >= 0
    assert {"real_llm_runs", "mock_runs", "baseline_runs"} <= set(payload)
    assert {"last_ai_run_at", "last_ai_run_provider", "last_ai_run_model"} <= set(payload)
    assert payload["app_mode"] in {"demo", "research", "classroom_pilot"}


def test_ai_provider_smoke_test_reports_gate_and_audit_metadata() -> None:
    response = client.post(
        "/ai/provider-smoke-test",
        json={
            "question": "汽车向前运动，但速度越来越小，它的加速度方向是什么？",
            "answer_text": "向前，因为车还在往前走。",
            "target_concept": "加速度方向",
            "lesson_phase": "practice",
            "current_activity": "whole_class",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ai_provider"] == "mock"
    assert payload["configured"] is True
    assert payload["quote_audit_passed"] is True
    assert payload["raw_llm_valid"] is True
    assert payload["fallback_used"] is False
    assert payload["gate_decision"]["move"] == "diagnostic_probe"


def test_teacher_access_code_protects_teacher_routes(monkeypatch) -> None:
    monkeypatch.setenv("TEACHER_ACCESS_CODE", "teacher-code")
    monkeypatch.setenv("RESEARCH_ACCESS_CODE", "research-code")
    monkeypatch.setenv("AUTH_SECRET", "test-secret")

    unauthorized = client.get("/checkpoints")
    assert unauthorized.status_code == 401

    login_response = client.post(
        "/auth/login",
        json={"role": "teacher", "access_code": "teacher-code"},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    authorized = client.get("/checkpoints", headers={"Authorization": f"Bearer {token}"})
    assert authorized.status_code == 200

    checkpoint_response = client.post(
        "/checkpoints",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "question": "减速运动中，加速度方向如何判断？",
            "target_concept": "加速度方向",
            "lesson_phase": "introduce",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    checkpoint = checkpoint_response.json()
    blocked_teacher_rep = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={
            "answer_text": "教师录入代表回答。",
            "anonymous_student_id": "T-rep",
            "response_source": "teacher_representative",
        },
    )
    assert blocked_teacher_rep.status_code == 401
    allowed_teacher_rep = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "answer_text": "教师录入代表回答。",
            "anonymous_student_id": "T-rep",
            "response_source": "teacher_representative",
        },
    )
    assert allowed_teacher_rep.status_code == 200

    research_forbidden = client.get("/research/episode-logs", headers={"Authorization": f"Bearer {token}"})
    assert research_forbidden.status_code == 403

    research_login = client.post(
        "/auth/login",
        json={"role": "researcher", "access_code": "research-code"},
    )
    research_token = research_login.json()["access_token"]
    research_allowed = client.get(
        "/research/episode-logs",
        headers={"Authorization": f"Bearer {research_token}"},
    )
    assert research_allowed.status_code == 200

    condition_allowed = client.post(
        "/experimental/generate-condition",
        headers={"Authorization": f"Bearer {token}"},
        json={"response_id": allowed_teacher_rep.json()["id"], "condition": "evidence_only"},
    )
    assert condition_allowed.status_code == 200


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


def test_clear_analysis_cache_allows_new_card_generation() -> None:
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
        json={"answer_text": "向后，因为摩擦力总是阻碍运动。", "anonymous_student_id": "S14"},
    )
    response = student_response.json()

    first = client.post(f"/responses/{response['id']}/analyze")
    cached = client.post(f"/responses/{response['id']}/analyze")
    clear_response = client.delete(f"/responses/{response['id']}/analysis-cache")
    after_clear = client.post(f"/responses/{response['id']}/analyze")

    assert first.status_code == 200
    assert cached.status_code == 200
    assert cached.json()["cached"] is True
    assert clear_response.status_code == 200
    assert clear_response.json()["cleared_cards"] == 1
    assert after_clear.status_code == 200
    assert after_clear.json()["cached"] is False
    assert after_clear.json()["card"]["id"] != first.json()["card"]["id"]


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
    assert "向前，因为车还在往前走。" not in response.text
    assert "[deidentified_text:" in response.text


def test_research_logs_csv_can_export_raw_ids_for_local_debugging() -> None:
    response = client.get("/research/episode-logs.csv?deidentify=false")

    assert response.status_code == 200
    assert "ckpt_" in response.text


def test_condition_generator_outputs_all_conditions() -> None:
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
        json={"answer_text": "向前，因为车还在往前走。", "anonymous_student_id": "S31"},
    )
    response = student_response.json()

    results = {}
    for condition in ["no_ai", "standard_llm", "over_committed", "evidence_only", "probemate"]:
        condition_response = client.post(
            "/experimental/generate-condition",
            json={"response_id": response["id"], "condition": condition},
        )
        assert condition_response.status_code == 200
        payload = condition_response.json()
        assert payload["condition"] == condition
        assert payload["teacher_card"]
        results[condition] = payload

    assert results["no_ai"]["move"] is None
    assert results["over_committed"]["move"] == "diagnostic_probe"
    assert "混淆" in results["over_committed"]["teacher_card"]
    assert results["probemate"]["move"] in {"hold", "ask_for_evidence", "diagnostic_probe"}

    logs_response = client.get("/research/episode-logs?condition=over_committed")
    logs = logs_response.json()
    assert logs_response.status_code == 200
    matching = next(log for log in logs if log["response_id"] == response["id"])
    assert matching["condition"] == "over_committed"
    assert matching["ai_provider"] == "baseline"


def test_study_builder_generates_blind_materials() -> None:
    checkpoint_response = client.post(
        "/checkpoints",
        json={
            "question": "汽车向前运动，但速度越来越小，它的加速度方向是什么？",
            "target_concept": "加速度方向",
            "lesson_phase": "practice",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    checkpoint = checkpoint_response.json()
    student_response = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={"answer_text": "向前，因为车还在往前走。", "anonymous_student_id": "S41"},
    )
    response = student_response.json()

    materials_response = client.post(
        "/study-builder/materials",
        json={"response_id": response["id"], "conditions": ["no_ai", "over_committed", "probemate"]},
    )

    assert materials_response.status_code == 200
    payload = materials_response.json()
    assert payload["response_id"] == response["id"]
    assert [row["assistant_label"] for row in payload["rows"]] == ["Assistant A", "Assistant B", "Assistant C"]
    assert {row["condition"] for row in payload["rows"]} == {"no_ai", "over_committed", "probemate"}
    assert all(row["question"] == checkpoint["question"] for row in payload["rows"])
    assert all(row["episode_log_id"] for row in payload["rows"])

    next_turn_response = client.post(
        "/study-builder/next-turns",
        json={
            "episode_log_id": payload["rows"][0]["episode_log_id"],
            "teacher_next_turn": "请先画出此刻和下一秒的速度箭头。",
            "decision_time_ms": 31000,
            "perceived_load": 3,
            "note": "timed vignette pilot",
        },
    )

    assert next_turn_response.status_code == 200
    next_turn_log = next_turn_response.json()["episode_log"]
    assert next_turn_log["teacher_final_turn"] == "请先画出此刻和下一秒的速度箭头。"
    assert next_turn_log["decision_time_ms"] == 31000
    assert next_turn_log["study_perceived_load"] == 3
    assert next_turn_log["study_note"] == "timed vignette pilot"


def test_research_summary_and_annotation_update() -> None:
    checkpoint_response = client.post(
        "/checkpoints",
        json={
            "question": "减速运动中，加速度方向如何判断？",
            "target_concept": "加速度方向",
            "lesson_phase": "practice",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    checkpoint = checkpoint_response.json()
    student_response = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={"answer_text": "向前，因为车还在往前走。", "anonymous_student_id": "S42"},
    )
    response = student_response.json()
    client.post(f"/responses/{response['id']}/analyze")
    log = next(log for log in client.get("/research/episode-logs").json() if log["response_id"] == response["id"])

    annotation = client.patch(
        f"/research/episode-logs/{log['id']}/annotation",
        json={
            "expert_preferred_move": "ask_for_evidence",
            "commitment_distance": 1,
            "harmful_over_commitment": True,
            "answer_leakage": False,
            "self_correction_support": 4,
        },
    )
    summary = client.get("/research/evidence-summary")

    assert annotation.status_code == 200
    assert annotation.json()["harmful_over_commitment"] is True
    assert annotation.json()["self_correction_support"] == 4
    assert summary.status_code == 200
    assert summary.json()["total_episodes"] >= 1
    assert summary.json()["harmful_over_commitment"] >= 1


def test_system_mode_and_demo_data_reset() -> None:
    mode_response = client.patch("/system/mode", json={"app_mode": "research"})
    reset_response = client.post("/system/demo-data/reset")

    assert mode_response.status_code == 200
    assert mode_response.json()["app_mode"] == "research"
    assert reset_response.status_code == 200
    payload = reset_response.json()
    assert payload["app_mode"] == "demo"
    assert payload["checkpoints"] >= 3
    assert payload["responses"] >= 5
    assert payload["episode_logs"] >= 5
    assert "DevTools" not in client.get("/research/episode-logs.csv?deidentify=false").text


def test_phase_manipulation_shows_ask_probe_hold_sequence() -> None:
    intro = client.post(
        "/demo/phase-manipulation",
        json={"lesson_phase": "introduce", "current_activity": "whole_class"},
    ).json()
    practiced = client.post(
        "/demo/phase-manipulation",
        json={"lesson_phase": "practice", "current_activity": "whole_class"},
    ).json()
    discussion = client.post(
        "/demo/phase-manipulation",
        json={"lesson_phase": "practice", "current_activity": "peer_discussion"},
    ).json()

    assert intro["move"] == "ask_for_evidence"
    assert practiced["move"] == "diagnostic_probe"
    assert discussion["move"] == "hold"
    assert intro["provider_mode"] == "mock"
    assert intro["ai_provider"] == "mock"
    assert intro["quote_audit_passed"] is True


def test_phase_manipulation_can_use_current_provider_mode() -> None:
    response = client.post(
        "/demo/phase-manipulation",
        json={
            "lesson_phase": "practice",
            "current_activity": "whole_class",
            "provider_mode": "current",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider_mode"] == "current"
    assert payload["ai_provider"]
    assert "quote_audit_passed" in payload


def test_ai_provider_status_reports_mock_by_default(monkeypatch) -> None:
    monkeypatch.delenv("AI_PROVIDER", raising=False)
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.get("/ai/provider-status")

    assert response.status_code == 200
    assert response.json() == {
        "ai_provider": "mock",
        "model_name": None,
        "configured": True,
        "fallback_available": True,
    }


def test_openai_provider_success_records_ai_metadata(monkeypatch) -> None:
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("AI_MODEL", "test-model")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    def fake_generate_candidate_output(self, input_pack):
        return CandidateOutput.model_validate(
            {
                "candidate_explanations": [
                    {
                        "label": "velocity_change_direction",
                        "student_quotes": ["速度变小"],
                        "interpretation": "学生已经提到速度变小，可以追问速度变化量方向。",
                        "missing_evidence": "需要说明速度箭头如何变化。",
                        "risk_if_overdiagnosed": "仍需避免直接给出标准答案。",
                    }
                ],
                "evidence_state": "sufficient",
                "distinguishability": "short_probe_can_distinguish",
                "suggested_teacher_moves": [
                    {
                        "move_type_hint": "diagnostic_probe",
                        "text": "如果速度箭头变短，速度变化量指向哪里？",
                        "answer_leakage_risk": "low",
                    }
                ],
                "safety_notes": ["不要直接公布正确方向。"],
            }
        )

    monkeypatch.setattr(
        "app.services.llm_client.OpenAIResponsesClient.generate_candidate_output",
        fake_generate_candidate_output,
    )
    checkpoint_response = client.post(
        "/checkpoints",
        json={
            "question": "汽车向前运动，但速度越来越小，它的加速度方向是什么？",
            "target_concept": "加速度方向",
            "lesson_phase": "practice",
            "current_activity": "whole_class",
            "visibility_policy": "teacher_only",
        },
    )
    checkpoint = checkpoint_response.json()
    student_response = client.post(
        f"/checkpoints/{checkpoint['id']}/responses",
        json={"answer_text": "向后，因为速度变小。", "anonymous_student_id": "S21"},
    )
    response = student_response.json()

    analysis_response = client.post(f"/responses/{response['id']}/analyze")

    assert analysis_response.status_code == 200
    analysis = analysis_response.json()
    assert analysis["ai_provider"] == "openai"
    assert analysis["model_name"] == "test-model"
    assert analysis["raw_llm_valid"] is True
    assert analysis["fallback_used"] is False
    assert analysis["card"]["gate_decision"]["move"] == "diagnostic_probe"
    assert analysis["card"]["ai_provider"] == "openai"

    logs = client.get(f"/research/episode-logs?checkpoint_id={checkpoint['id']}").json()
    matching = next(log for log in logs if log["response_id"] == response["id"])
    assert matching["ai_provider"] == "openai"
    assert matching["model_name"] == "test-model"
    assert matching["raw_llm_valid"] is True
    assert matching["fallback_used"] is False


def test_openai_schema_failure_downgrades_to_conservative_ask(monkeypatch) -> None:
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("AI_MODEL", "test-model")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")

    def fake_generate_candidate_output(self, input_pack):
        raise OpenAIValidationError("bad schema")

    monkeypatch.setattr(
        "app.services.llm_client.OpenAIResponsesClient.generate_candidate_output",
        fake_generate_candidate_output,
    )
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
        json={"answer_text": "向前，因为车还在往前走。", "anonymous_student_id": "S22"},
    )
    response = student_response.json()

    analysis_response = client.post(f"/responses/{response['id']}/analyze")

    assert analysis_response.status_code == 200
    analysis = analysis_response.json()
    card = analysis["card"]
    assert analysis["fallback_used"] is True
    assert analysis["raw_llm_valid"] is False
    assert card["gate_decision"]["move"] == "ask_for_evidence"
    assert card["downgrade_reason"] == "schema_validation_failed"
    assert card["validation_error"] == "bad schema"

    logs = client.get(f"/research/episode-logs?checkpoint_id={checkpoint['id']}").json()
    matching = next(log for log in logs if log["response_id"] == response["id"])
    assert matching["downgrade_reason"] == "schema_validation_failed"
    assert matching["validation_error"] == "bad schema"
    assert matching["fallback_used"] is True


def test_deepseek_provider_status_uses_v4_flash_default(monkeypatch) -> None:
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.delenv("DEEPSEEK_MODEL", raising=False)
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")

    response = client.get("/ai/provider-status")

    assert response.status_code == 200
    assert response.json() == {
        "ai_provider": "deepseek",
        "model_name": "deepseek-v4-flash",
        "configured": True,
        "fallback_available": True,
    }


def test_deepseek_schema_failure_downgrades_to_conservative_ask(monkeypatch) -> None:
    monkeypatch.setenv("AI_PROVIDER", "deepseek")
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-test")
    monkeypatch.delenv("AI_MODEL", raising=False)
    monkeypatch.delenv("DEEPSEEK_MODEL", raising=False)

    def fake_generate_candidate_output(self, input_pack):
        raise LLMValidationError("bad json")

    monkeypatch.setattr(
        "app.services.llm_client.JSONChatCompletionsClient.generate_candidate_output",
        fake_generate_candidate_output,
    )
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
        json={"answer_text": "向前，因为车还在往前走。", "anonymous_student_id": "S23"},
    )
    response = student_response.json()

    analysis_response = client.post(f"/responses/{response['id']}/analyze")

    assert analysis_response.status_code == 200
    analysis = analysis_response.json()
    assert analysis["ai_provider"] == "deepseek"
    assert analysis["model_name"] == "deepseek-v4-flash"
    assert analysis["fallback_used"] is True
    assert analysis["raw_llm_valid"] is False
    assert analysis["card"]["downgrade_reason"] == "schema_validation_failed"
    assert analysis["card"]["validation_error"] == "bad json"
