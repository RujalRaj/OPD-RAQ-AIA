import pytest
from conftest import create_patient, intake, login
from sqlalchemy import text


def test_patient_privacy_and_server_identity(client):
    assert client.get("/api/v1/dashboard").status_code == 401
    assert client.get("/api/v1/audit-logs").status_code == 401
    receipt = client.post(
        "/api/v1/encounters", json=intake(confirmed_text="chest tightness")
    ).json()
    assert set(receipt) == {
        "token",
        "demo_id",
        "registered",
        "urgent_alert",
        "ai_status",
        "needs_staff_review",
        "priority",
    }
    assert receipt["urgent_alert"]
    login(client)
    p = client.get("/api/v1/dashboard").json()["original_queue"][0]
    response = client.post(
        f"/api/v1/encounters/{p['id']}/override",
        json={
            "version": p["version"],
            "priority": "ROUTINE",
            "reason": "Demo",
            "user_id": "doctor",
        },
    )
    assert response.status_code == 422


@pytest.mark.parametrize("role", ["nurse", "intern", "jr"])
def test_override_requires_one_new_vital_and_reason_for_each_role(client, role):
    login(client, role)
    p = create_patient(client, symptoms=["rule_11"], vitals={"pr": {"value": 80}})
    base = f"/api/v1/encounters/{p['id']}"
    payload = {
        "version": p["version"],
        "priority": "ROUTINE",
        "reason": "Observed patient; correcting demo classification",
    }
    assert client.post(base + "/override", json=payload).status_code == 422
    assert (
        client.post(
            base + "/override", json={**payload, "vitals": {"pr": {"status": "NOT_MEASURED"}}}
        ).status_code
        == 422
    )
    assert (
        client.post(
            base + "/override", json={**payload, "reason": "  ", "vitals": {"pr": {"value": 82}}}
        ).status_code
        == 422
    )
    changed = client.post(base + "/override", json={**payload, "vitals": {"pr": {"value": 82}}})
    assert changed.status_code == 200, changed.text
    updated = changed.json()
    assert updated["priority"] == "ROUTINE" and updated["token"] == p["token"]
    assert updated["assessment"]["red_flags"]  # Human override does not erase evidence.
    assert updated["vitals"]["rbs"]["status"] == "NOT_MEASURED"
    log = next(x for x in client.get(base + "/audit").json() if x["type"] == "OVERRIDE")
    assert log["actor"] == role
    assert (
        log["payload"]["from_priority"] == "IMMEDIATE"
        and log["payload"]["to_priority"] == "ROUTINE"
    )
    assert log["payload"]["vital_id"]


def test_doctor_override_and_unresolved_flow_without_mandatory_review(client):
    login(client)
    p = create_patient(client)
    base = f"/api/v1/encounters/{p['id']}"
    marked = client.post(
        base + "/unresolved", json={"version": p["version"], "reason": "Need doctor assessment"}
    ).json()
    assert marked["priority"] == p["priority"] and marked["unresolved"]
    assert (
        client.post(
            base + "/resolve", json={"version": marked["version"], "reason": "Reviewed"}
        ).status_code
        == 403
    )
    login(client, "doctor")
    overridden = client.post(
        base + "/override",
        json={
            "version": marked["version"],
            "priority": "IMMEDIATE",
            "reason": "Observed deterioration",
        },
    ).json()
    assert overridden["priority"] == "IMMEDIATE"
    resolved = client.post(
        base + "/resolve",
        json={"version": overridden["version"], "reason": "Reviewed and escalated"},
    ).json()
    assert not resolved["unresolved"]


def test_versions_queue_and_original_text_survive_changes(client):
    login(client)
    first = create_patient(client, original_text="मूल शब्द", confirmed_text="corrected complaint")
    second = create_patient(client, symptoms=["rule_11"])
    dash = client.get("/api/v1/dashboard").json()
    assert [p["id"] for p in dash["original_queue"]] == [first["id"], second["id"]]
    assert dash["priority_order"] == [second["id"], first["id"]]
    base = f"/api/v1/encounters/{first['id']}"
    updated = client.post(
        base + "/reassess", json={"version": first["version"], "new_symptoms": "new chest pain"}
    ).json()
    assert updated["priority"] == "IMMEDIATE"
    assert updated["original_text"] == "मूल शब्द"
    assert updated["token"] == first["token"]
    assert client.post(base + "/reassess", json={"version": first["version"]}).status_code == 409
    dash = client.get("/api/v1/dashboard").json()
    assert dash["priority_order"] == [first["id"], second["id"]]
    assert dash["counts"]["TOTAL"] == sum(
        dash["counts"][p] for p in ("IMMEDIATE", "SOON", "ROUTINE")
    )


def test_partial_vitals_retain_status_and_timestamp(client):
    login(client)
    p = create_patient(client, vitals={"pr": {"value": 84}, "rbs": {"status": "UNABLE_TO_OBTAIN"}})
    old = p["vitals"]["pr"]
    changed = client.post(
        f"/api/v1/encounters/{p['id']}/vitals",
        json={"version": p["version"], "vitals": {"spo2": {"value": 97}}},
    ).json()
    assert changed["vitals"]["pr"] == old
    assert changed["vitals"]["rbs"]["status"] == "UNABLE_TO_OBTAIN"


def test_idempotent_registration_and_input_validation(client):
    login(client)
    payload = intake()
    first = client.post("/api/v1/encounters", json=payload).json()
    assert client.post("/api/v1/encounters", json=payload).json() == first
    assert (
        client.post("/api/v1/encounters", json={**payload, "name": "Different"}).status_code == 409
    )
    assert (
        client.post("/api/v1/encounters", json=intake(vitals={"spo2": {"value": 101}})).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/encounters",
            json=intake(vitals={"pr": {"status": "NOT_MEASURED", "value": 80}}),
        ).status_code
        == 422
    )
    assert (
        client.post("/api/v1/encounters", json=intake(facts={"invented_rule": True})).status_code
        == 422
    )
    assert client.post("/api/v1/encounters", json=intake(name="   ")).status_code == 422


def test_audit_append_only_and_staff_override_survives_ai_reassessment(client):
    login(client, "doctor")
    p = create_patient(client)
    base = f"/api/v1/encounters/{p['id']}"
    p = client.post(
        base + "/override",
        json={"version": p["version"], "priority": "IMMEDIATE", "reason": "Clinical observation"},
    ).json()
    p = client.post(
        base + "/reassess", json={"version": p["version"], "facts": {"stable_routine_visit": True}}
    ).json()
    assert p["priority"] == "IMMEDIATE" and p["override_active"]
    with client.app.state.engine.begin() as conn:
        with pytest.raises(Exception, match="append-only"):
            conn.execute(text("UPDATE audit_events SET actor='changed'"))


def test_origin_protection_and_logout(client):
    assert (
        client.post(
            "/api/v1/auth/login",
            headers={"Origin": "https://untrusted.example"},
            json={"username": "nurse", "password": "DemoOnly!2026"},
        ).status_code
        == 403
    )
    login(client)
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/dashboard").status_code == 401
