import json
from unittest.mock import Mock

import httpx
import pytest
from conftest import create_patient, intake, login
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.main import create_app
from backend.models import Assessment
from backend.services.ai import (
    AIProposal,
    clinical_evidence,
    failure_code,
    propose,
    validate_proposal,
)
from scripts.setup_ai import save_key


def proposal(priority="IMMEDIATE", review=False, missing=()):
    return AIProposal(
        priority=priority,
        reason="Reported symptoms require staff assessment",
        evidence_ids=["reported_text"],
        needs_staff_review=review,
        missing_information=list(missing),
    )


@pytest.mark.parametrize("provider", ["openai", "groq"])
@pytest.mark.parametrize("priority", ["IMMEDIATE", "SOON", "ROUTINE"])
def test_all_three_model_priorities_reach_queue_and_audit(client, monkeypatch, provider, priority):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", provider)
    monkeypatch.setattr("backend.main.propose", lambda _: proposal(priority))
    # Deliberately outside the narrow local phrase dictionary. Test software application,
    # not whether a model's clinical interpretation is correct.
    p = create_patient(
        client,
        original_text="Synthetic description in the patient’s own words",
        confirmed_text="Synthetic description in the patient’s own words",
    )
    assert p["priority"] == priority
    assert p["assessment"]["source"] == "AI_WITH_SAFETY_GATE"
    assert p["assessment"]["ai_provider"] == provider
    assert p["assessment"]["policy_gap"] is True  # LLM must not erase coverage gaps.
    assert len(p["assessment"]["missing_data"]) == 7
    assert p["original_text"] == "Synthetic description in the patient’s own words"
    logs = client.get(f"/api/v1/encounters/{p['id']}/audit").json()
    item = next(x for x in logs if x["type"] == "AI_ASSESSMENT")
    assert item["payload"]["proposal"]["applied"] is True
    assert len(item["payload"]["input_fingerprint"]) == 64
    assert any(x["type"] == "ALERT" and x["actor"] == "AI" for x in logs) == (
        priority == "IMMEDIATE"
    )


@pytest.mark.parametrize("symptoms,expected", [(["rule_11"], "IMMEDIATE"), (["rule_35"], "SOON")])
def test_source_floor_cannot_be_lowered(client, monkeypatch, symptoms, expected):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "groq")
    model = Mock(return_value=proposal("ROUTINE"))
    monkeypatch.setattr("backend.main.propose", model)
    p = create_patient(client, symptoms=symptoms)
    assert p["priority"] == expected
    if expected == "IMMEDIATE":
        model.assert_not_called()
        assert p["assessment"]["ai_status"] == "SKIPPED_SAFETY"
    else:
        assert p["assessment"]["ai_proposal"]["blocked_reason"] == "SOURCE_RULE_MINIMUM"


@pytest.mark.parametrize(
    "review,missing", [(True, []), (False, ["Symptom onset"]), (True, ["Vitals"])]
)
def test_uncertainty_blocks_routine_but_not_escalation(client, monkeypatch, review, missing):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "groq")
    monkeypatch.setattr("backend.main.propose", lambda _: proposal("ROUTINE", review, missing))
    p = create_patient(client)
    assert p["priority"] == "SOON"
    assert p["assessment"]["ai_proposal"]["blocked_reason"] == "INCOMPLETE_CONTEXT"
    monkeypatch.setattr("backend.main.propose", lambda _: proposal("IMMEDIATE", review, missing))
    urgent = create_patient(client)
    assert urgent["priority"] == "IMMEDIATE"
    assert urgent["assessment"]["needs_staff_review"] is True


def test_staff_explicit_missing_vital_gate_cannot_be_cleared(client, monkeypatch):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "groq")
    monkeypatch.setattr("backend.main.propose", lambda _: proposal("ROUTINE"))
    p = create_patient(client, facts={"missing_vitals_prevent_downgrade": True})
    assert p["priority"] == "SOON"


def test_queue_order_fixed_tokens_and_nurse_override_retain_ai_alert(client, monkeypatch):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "groq")
    model = Mock(side_effect=[proposal("ROUTINE"), proposal("IMMEDIATE")])
    monkeypatch.setattr("backend.main.propose", model)
    first = create_patient(client)
    urgent = create_patient(client)
    assert first["token"] < urgent["token"]
    queue = client.get("/api/v1/dashboard").json()
    assert queue["priority_order"] == [urgent["id"], first["id"]]
    changed = client.post(
        f"/api/v1/encounters/{urgent['id']}/override",
        json={
            "version": urgent["version"],
            "priority": "SOON",
            "reason": "Synthetic workflow correction",
            "vitals": {"pr": {"value": 80}},
        },
    ).json()
    assert changed["priority"] == "SOON" and changed["token"] == urgent["token"]
    assert changed["assessment"]["retained_ai_alert"]["provider"] == "groq"
    updated = client.post(
        f"/api/v1/encounters/{urgent['id']}/reassess",
        json={
            "version": changed["version"],
            "new_symptoms": "Additional synthetic observation",
        },
    ).json()
    assert updated["priority"] == "SOON"
    assert updated["assessment"]["ai_status"] == "SKIPPED_OVERRIDE"
    assert model.call_count == 2


def test_public_status_tracks_late_immediate_without_exposing_records(client, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "groq")
    model = Mock(return_value=proposal())
    monkeypatch.setattr("backend.main.propose", model)
    payload = intake()
    receipt = client.post("/api/v1/encounters", json=payload).json()
    assert receipt["ai_status"] == "PENDING" and not receipt["urgent_alert"]
    response = client.post(
        "/api/v1/registration-status", json={"request_id": payload["request_id"]}
    )
    completed = response.json()
    assert completed["urgent_alert"] and completed["ai_status"] == "COMPLETE"
    assert completed["token"] == receipt["token"]
    assert set(completed) == {
        "token",
        "demo_id",
        "registered",
        "urgent_alert",
        "ai_status",
        "needs_staff_review",
        "priority",
    }
    assert (
        client.post("/api/v1/registration-status", json={"token": receipt["token"]}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/registration-status", json={"request_id": intake()["request_id"]}
        ).status_code
        == 404
    )
    assert client.post("/api/v1/encounters", json=payload).json()["token"] == receipt["token"]
    assert model.call_count == 1


def test_missing_key_is_visible_without_attempting_request(client, monkeypatch):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "groq")
    monkeypatch.delenv("GROQ_API_KEY")
    model = Mock()
    monkeypatch.setattr("backend.main.propose", model)
    health = client.get("/api/v1/health").json()
    assert health["ai_configured"] is False
    p = create_patient(client)
    assert p["assessment"]["ai_error"] == "NOT_CONFIGURED"
    assert p["assessment"]["needs_staff_review"] is True
    model.assert_not_called()


def test_minimal_payload_includes_context_but_excludes_identity():
    snapshot = intake(
        name="Identifying name",
        sex="FEMALE",
        pregnancy_status="PREGNANT",
        history_status="PROVIDED",
        history="Reported past illness",
        medication_status="NONE",
        language="hi-IN",
        confirmed_text="मुझे परेशानी है",
        facts={"room_air": True},
    )
    evidence = clinical_evidence(
        snapshot,
        {
            "pr": {
                "value": 88,
                "status": "RECORDED",
                "recorded_by": "private-staff-identifier",
                "measured_at": "2026-10-13T12:00:00Z",
            }
        },
    )
    assert evidence["patient_context"]["pregnancy_status"] == "PREGNANT"
    assert evidence["patient_context"]["age_years"] == 40
    assert evidence["history"]["reported"] == "Reported past illness"
    assert evidence["medications"]["status"] == "NONE"
    assert evidence["vitals"]["spo2"]["value"] is None
    assert evidence["vitals"]["pr"]["unit"] == "beats/min"
    encoded = json.dumps(evidence)
    for forbidden in ["Identifying name", "private-staff-identifier", snapshot["request_id"]]:
        assert forbidden not in encoded
    assert evidence["reported_text"] == snapshot["confirmed_text"]


@pytest.mark.parametrize("priority", ["IMMEDIATE", "SOON", "ROUTINE"])
def test_strict_schema_accepts_three_priorities(priority):
    value = proposal(priority).model_dump()
    assert validate_proposal(value, {"reported_text": "Synthetic text"}).priority == priority
    with pytest.raises(ValueError):
        validate_proposal(
            {**value, "evidence_ids": ["invented"]}, {"reported_text": "Synthetic text"}
        )
    with pytest.raises(ValueError):
        validate_proposal({**value, "reason": "word " * 21}, {"reported_text": "Synthetic text"})


@pytest.mark.parametrize(
    "finish,refusal,expected",
    [("stop", None, True), ("length", None, False), ("stop", "Refused", False)],
)
def test_groq_real_sdk_serialization_and_response_validation(
    monkeypatch, finish, refusal, expected
):
    import openai

    original = openai.OpenAI
    captured = []

    def handler(request):
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "id": "demo",
                "object": "chat.completion",
                "created": 1,
                "model": "openai/gpt-oss-120b",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": finish,
                        "message": {
                            "role": "assistant",
                            "refusal": refusal,
                            "content": json.dumps(proposal().model_dump()),
                        },
                    }
                ],
            },
        )

    monkeypatch.setenv("AI_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "test-never-send")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://wrong-endpoint.invalid")
    monkeypatch.setattr(
        openai,
        "OpenAI",
        lambda **kwargs: original(
            **kwargs, http_client=httpx.Client(transport=httpx.MockTransport(handler))
        ),
    )
    if expected:
        assert propose({"reported_text": "Synthetic complaint"}).priority == "IMMEDIATE"
    else:
        with pytest.raises(ValueError):
            propose({"reported_text": "Synthetic complaint"})
    request = captured[0]
    assert str(request.url) == "https://api.groq.com/openai/v1/chat/completions"
    body = json.loads(request.content)
    schema = body["response_format"]["json_schema"]
    assert schema["strict"] is True
    assert set(schema["schema"]["required"]) == set(schema["schema"]["properties"])
    assert schema["schema"]["properties"]["priority"]["enum"] == ["IMMEDIATE", "SOON", "ROUTINE"]
    assert set(schema["schema"]["properties"]["evidence_ids"]["items"]["enum"]) == {
        "reported_text",
        "selected_symptoms",
        "reported_facts",
        "patient_context",
        "history",
        "medications",
        "vitals",
    }


def test_key_setup_preserves_settings_and_never_creates_world_readable_key(tmp_path):
    import stat

    from dotenv import dotenv_values

    path = tmp_path / ".env"
    path.write_text("DATABASE_URL=sqlite:///./keep.db\n# keep comment\nAI_PROVIDER=disabled\n")
    save_key(path, "groq", "test-only-key")
    values = dotenv_values(path)
    assert values["DATABASE_URL"] == "sqlite:///./keep.db"
    assert values["AI_PROVIDER"] == "groq" and values["GROQ_MODEL"] == "openai/gpt-oss-120b"
    assert "# keep comment" in path.read_text()
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert list(tmp_path.glob(".ai-setup-*")) == []
    before = path.read_bytes()
    with pytest.raises(ValueError):
        save_key(path, "groq", "invalid\nextra=value")
    assert path.read_bytes() == before


def test_restart_marks_interrupted_job_unavailable(client):
    login(client)
    p = create_patient(client)
    with client.app.state.sessions() as db:
        a = db.scalar(select(Assessment).where(Assessment.encounter_id == p["id"]))
        a.details = {**a.details, "ai_status": "PENDING"}
        db.commit()
        url = str(db.bind.url)
    with TestClient(create_app(url)) as restarted:
        login(restarted)
        p = restarted.get(f"/api/v1/encounters/{p['id']}").json()
        assert p["assessment"]["ai_status"] == "UNAVAILABLE"
        assert p["assessment"]["ai_error"] == "INTERRUPTED"


def test_failed_reassessment_keeps_earlier_ai_priority_until_valid_replacement(client, monkeypatch):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "groq")
    model = Mock(
        side_effect=[proposal(), TimeoutError("private-provider-detail"), proposal("ROUTINE")]
    )
    monkeypatch.setattr("backend.main.propose", model)
    p = create_patient(client)
    response = client.post(
        f"/api/v1/encounters/{p['id']}/reassess", json={"version": p["version"]}
    ).json()
    assert response["priority"] == "IMMEDIATE"
    assert response["assessment"]["ai_status"] == "PENDING"
    failed = client.get(f"/api/v1/encounters/{p['id']}").json()
    assert failed["priority"] == "IMMEDIATE"
    assert failed["assessment"]["ai_status"] == "UNAVAILABLE"
    assert failed["assessment"]["ai_error"] == "TIMEOUT"
    assert failed["assessment"]["carried_ai_priority"]["priority"] == "IMMEDIATE"
    assert "private-provider-detail" not in json.dumps(failed)
    logs = client.get(f"/api/v1/encounters/{p['id']}/audit").json()
    assert "private-provider-detail" not in json.dumps(logs)
    client.post(f"/api/v1/encounters/{p['id']}/reassess", json={"version": failed["version"]})
    replaced = client.get(f"/api/v1/encounters/{p['id']}").json()
    assert replaced["priority"] == "ROUTINE" and replaced["token"] == p["token"]
    assert not replaced["assessment"].get("carried_ai_priority")


@pytest.mark.parametrize("status", ["completed", "incomplete"])
def test_openai_real_responses_sdk_serialization(monkeypatch, status):
    import openai

    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-only-key")
    original = openai.OpenAI
    captured = []

    def handler(request):
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "id": "resp_test",
                "object": "response",
                "created_at": 1,
                "model": "gpt-4o-mini",
                "status": status,
                "output": [
                    {
                        "id": "msg_test",
                        "type": "message",
                        "role": "assistant",
                        "status": "completed",
                        "content": [
                            {
                                "type": "output_text",
                                "text": proposal().model_dump_json(),
                                "annotations": [],
                            }
                        ],
                    }
                ],
            },
        )

    monkeypatch.setattr(
        openai,
        "OpenAI",
        lambda **kwargs: original(
            **kwargs, http_client=httpx.Client(transport=httpx.MockTransport(handler))
        ),
    )
    if status == "completed":
        assert propose({"reported_text": "Synthetic complaint"}).priority == "IMMEDIATE"
    else:
        with pytest.raises(ValueError):
            propose({"reported_text": "Synthetic complaint"})
    assert str(captured[0].url) == "https://api.openai.com/v1/responses"
    body = json.loads(captured[0].content)
    assert body["store"] is False
    assert body["text"]["format"]["strict"] is True
    assert (
        "reported_text"
        in body["text"]["format"]["schema"]["properties"]["evidence_ids"]["items"]["enum"]
    )


@pytest.mark.parametrize("reference", ["symptom_1", "vitals.spo2", "rule_11"])
def test_unsupported_evidence_is_rejected_with_private_actionable_diagnostic(
    monkeypatch, capsys, reference
):
    from scripts import check_ai

    value = {**proposal().model_dump(), "evidence_ids": [reference], "reason": "Private report"}
    with pytest.raises(ValueError) as raised:
        validate_proposal(value, {"reported_text": "Synthetic report", reference: "untrusted"})
    assert failure_code(raised.value) == "INVALID_EVIDENCE_REFERENCE"
    monkeypatch.setenv("AI_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "test-never-send")
    monkeypatch.setattr(check_ai, "propose", Mock(side_effect=raised.value))
    assert check_ai.main() == 1
    output = capsys.readouterr().out
    assert "INVALID_EVIDENCE_REFERENCE" in output
    for private in [reference, "Private report", "test-never-send"]:
        assert private not in output
