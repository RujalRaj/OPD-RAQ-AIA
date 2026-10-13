import pytest
from conftest import create_patient, login

from backend.services.ai import validate_proposal


@pytest.mark.parametrize(
    "payload",
    [
        {"priority": "UNKNOWN", "reason": "Example", "evidence_ids": ["reported_text"]},
        {"priority": "ROUTINE", "reason": "Example", "evidence_ids": ["invented_measurement"]},
        {"priority": "SOON", "reason": "word " * 21, "evidence_ids": ["reported_text"]},
        {"priority": "SOON", "reason": "Example", "evidence_ids": ["reported_text"], "spo2": 72},
    ],
)
def test_rejects_invalid_ungrounded_model_data(payload):
    with pytest.raises(ValueError):
        validate_proposal(payload, {"reported_text": "Original words"})


def test_optional_ai_failure_keeps_local_priority(client, monkeypatch):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "openai")

    def failed(_):
        raise TimeoutError("Do not disclose request or key")

    monkeypatch.setattr("backend.main.propose", failed)
    p = create_patient(client)
    assert p["priority"] == "SOON"
    assert p["assessment"]["ai_status"] == "UNAVAILABLE"


def test_red_flags_skip_ai_entirely(client, monkeypatch):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "openai")

    def forbidden(_):
        raise AssertionError("Emergency must not wait for AI")

    monkeypatch.setattr("backend.main.propose", forbidden)
    p = create_patient(client, symptoms=["rule_11"])
    assert p["priority"] == "IMMEDIATE"


@pytest.mark.parametrize(
    "symptoms,expected",
    [(["rule_35"], "SOON"), ([], "SOON"), (["stable_routine_visit"], "ROUTINE")],
)
def test_ai_cannot_clear_source_conditions_or_missing_context(
    client, monkeypatch, symptoms, expected
):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setattr(
        "backend.main.propose",
        lambda evidence: validate_proposal(
            {
                "priority": "ROUTINE",
                "reason": "Invented claim: oxygen is 98 percent",
                "needs_staff_review": True,
                "missing_information": [],
                "evidence_ids": ["reported_text"],
            },
            evidence,
        ),
    )
    p = create_patient(
        client,
        confirmed_text="" if symptoms == ["stable_routine_visit"] else "Unrecognized complaint",
        symptoms=symptoms,
    )
    assert p["priority"] == expected
    assert p["assessment"]["ai_status"] == "COMPLETE"
    assert len(p["assessment"]["missing_data"]) == 7
    assert "Invented claim" not in str(p)
    assert "Invented claim" not in client.get(f"/api/v1/encounters/{p['id']}/audit").text


def test_outdated_ai_response_does_not_overwrite_new_staff_data(client, monkeypatch):
    from sqlalchemy import select

    from backend.models import Encounter

    login(client)
    monkeypatch.setenv("AI_PROVIDER", "openai")

    def proposal_after_staff_edit(evidence):
        with client.app.state.sessions() as db:
            enc = db.scalar(select(Encounter))
            enc.version += 1
            enc.priority = "IMMEDIATE"
            enc.override_active = True
            db.commit()
        return validate_proposal(
            {
                "priority": "ROUTINE",
                "reason": "Follow-up visit",
                "needs_staff_review": False,
                "missing_information": [],
                "evidence_ids": ["reported_text"],
            },
            evidence,
        )

    monkeypatch.setattr("backend.main.propose", proposal_after_staff_edit)
    p = create_patient(client)
    assert p["priority"] == "IMMEDIATE" and p["override_active"]
    assert any(
        r["type"] == "AI_STALE_DISCARDED"
        for r in client.get(f"/api/v1/encounters/{p['id']}/audit").json()
    )
