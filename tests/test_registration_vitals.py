import pytest
from conftest import intake, login


def required_vitals(**extra):
    return {"temperature_c": {"value": 37}, "spo2": {"value": 98}, "pr": {"value": 82}, **extra}


def saved_patient(client, token):
    return next(
        p for p in client.get("/api/v1/dashboard").json()["original_queue"] if p["token"] == token
    )


def test_staff_registration_requires_auth_and_public_cannot_request_review(client):
    payload = intake(doctor_review_reason="Synthetic uncertainty")
    assert client.post("/api/v1/staff/encounters", json=payload).status_code == 401
    assert client.post("/api/v1/encounters", json=payload).status_code == 422
    login(client)
    assert client.get("/api/v1/dashboard").json()["counts"]["TOTAL"] == 0


@pytest.mark.parametrize("role", ["nurse", "intern", "jr", "doctor"])
def test_staff_registration_records_partial_vitals_before_initial_assessment(client, role):
    login(client, role)
    payload = intake(
        original_text="मूल शब्द",
        confirmed_text="Synthetic concern",
        facts={"room_air": True},
        vitals=required_vitals(spo2={"value": 85}, rbs={"status": "UNABLE_TO_OBTAIN"}),
        doctor_review_reason="Need a doctor to assess this synthetic case",
    )
    response = client.post("/api/v1/staff/encounters", json=payload)
    assert response.status_code == 201, response.text
    receipt = response.json()
    assert receipt["urgent_alert"]
    patient = saved_patient(client, receipt["token"])
    assert (
        patient["priority"] == "IMMEDIATE"
    )  # Source rule 5 requires recorded SpO2 and room-air context.
    assert any(r["id"] == 5 for r in patient["assessment"]["triggered_rules"])
    assert patient["unresolved"] and not patient["override_active"]
    assert patient["original_text"] == "मूल शब्द"
    assert patient["vitals"]["spo2"]["recorded_by"] == role
    assert patient["vitals"]["rbs"]["status"] == "UNABLE_TO_OBTAIN"
    assert patient["vitals"]["sbp"]["value"] is None
    assert patient["vitals"]["sbp"]["status"] == "NOT_MEASURED"
    endpoint = f"/api/v1/encounters/{patient['id']}"
    audit = client.get(endpoint + "/audit").json()
    for kind in ("REGISTER", "VITALS", "DOCTOR_REVIEW_REQUESTED"):
        assert next(e for e in audit if e["type"] == kind)["actor"] == role
    assert client.post("/api/v1/staff/encounters", json=payload).json() == receipt
    assert client.get(endpoint + "/audit").json() == audit
    assert client.get("/api/v1/dashboard").json()["counts"]["TOTAL"] == 1
    assert (
        client.post(
            "/api/v1/staff/encounters", json={**payload, "doctor_review_reason": "Changed"}
        ).status_code
        == 409
    )


def test_registration_review_retains_priority_and_retry_does_not_reopen_resolved_case(client):
    login(client)
    payload = intake(
        vitals=required_vitals(), doctor_review_reason="Cannot assess; need doctor assistance"
    )
    receipt = client.post("/api/v1/staff/encounters", json=payload).json()
    patient = saved_patient(client, receipt["token"])
    assert patient["unresolved"]
    assert patient["vitals"]["rr"]["value"] is None
    endpoint = f"/api/v1/encounters/{patient['id']}"
    assert (
        client.post(
            endpoint + "/resolve", json={"version": patient["version"], "reason": "Reviewed"}
        ).status_code
        == 403
    )
    login(client, "doctor")
    resolved = client.post(
        endpoint + "/resolve",
        json={"version": patient["version"], "reason": "Reviewed synthetic example"},
    ).json()
    assert not resolved["unresolved"] and resolved["priority"] == patient["priority"]
    login(client)
    assert client.post("/api/v1/staff/encounters", json=payload).status_code == 201
    assert not client.get(endpoint).json()["unresolved"]
    assert (
        len(
            [
                e
                for e in client.get(endpoint + "/audit").json()
                if e["type"] == "DOCTOR_REVIEW_REQUESTED"
            ]
        )
        == 1
    )


def test_registration_review_reason_and_measurement_validation(client):
    login(client)
    for fields in (
        {"doctor_review_reason": ""},
        {"doctor_review_reason": "  "},
        {"vitals": {"pr": {"status": "RECORDED"}}},
    ):
        assert client.post("/api/v1/staff/encounters", json=intake(**fields)).status_code == 422
    receipt = client.post("/api/v1/staff/encounters", json=intake(vitals=required_vitals())).json()
    patient = saved_patient(client, receipt["token"])
    assert not patient["unresolved"]
    assert patient["vitals"]["sbp"]["status"] == "NOT_MEASURED"


@pytest.mark.parametrize("emergency", [False, True])
@pytest.mark.parametrize("key", ["temperature_c", "spo2", "pr"])
@pytest.mark.parametrize(
    "entry", [None, {"status": "NOT_MEASURED"}, {"status": "UNABLE_TO_OBTAIN"}]
)
def test_required_vitals_cannot_be_omitted_or_marked_unavailable(client, emergency, key, entry):
    login(client)
    vitals = required_vitals()
    if entry is None:
        del vitals[key]
    else:
        vitals[key] = entry
    response = client.post(
        "/api/v1/staff/encounters",
        json=intake(
            vitals=vitals,
            staff_assessed_emergency=emergency,
        ),
    )
    assert response.status_code == 422
    assert client.get("/api/v1/dashboard").json()["counts"]["TOTAL"] == 0


@pytest.mark.parametrize("role", ["nurse", "intern", "jr", "doctor"])
def test_staff_emergency_skips_symptoms_and_ai_and_preserves_decision(client, monkeypatch, role):
    login(client, role)
    monkeypatch.setenv("AI_PROVIDER", "groq")
    payload = intake(
        original_text="",
        confirmed_text="",
        input_methods=[],
        symptoms=[],
        vitals=required_vitals(temperature_c={"status": "HIGH"}, pr={"status": "LOW"}),
        staff_assessed_emergency=True,
    )
    response = client.post("/api/v1/staff/encounters", json=payload)
    assert response.status_code == 201, response.text
    receipt = response.json()
    assert receipt["priority"] == "IMMEDIATE" and receipt["urgent_alert"]
    assert receipt["ai_status"] == "SKIPPED_OVERRIDE"
    patient = saved_patient(client, receipt["token"])
    assert patient["override_active"]
    assert not patient["original_text"] and not patient["input"]["input_methods"]
    for key, status in (("temperature_c", "HIGH"), ("pr", "LOW")):
        vital = patient["vitals"][key]
        assert vital["value"] is None and vital["status"] == status
        assert vital["recorded_by"] == role and vital["measured_at"]
        assert key in patient["assessment"]["missing_data"]
    assert patient["assessment"]["staff_decision"]["kind"] == "STAFF_ASSESSED_EMERGENCY"
    assert not patient["assessment"]["triggered_rules"]
    endpoint = f"/api/v1/encounters/{patient['id']}"
    audit = client.get(endpoint + "/audit").json()
    decision = next(e for e in audit if e["type"] == "STAFF_ASSESSED_EMERGENCY")
    assert decision["actor"] == role
    assert decision["payload"]["vital_id"] and decision["payload"]["override_id"]
    assert not any(e["type"] == "AI_REQUESTED" for e in audit)
    assert client.post("/api/v1/staff/encounters", json=payload).json() == receipt
    assert client.get(endpoint + "/audit").json() == audit
    assert (
        client.post(
            "/api/v1/staff/encounters", json={**payload, "staff_assessed_emergency": False}
        ).status_code
        == 422
    )
    reassessed = client.post(endpoint + "/reassess", json={"version": patient["version"]}).json()
    assert reassessed["priority"] == "IMMEDIATE" and reassessed["override_active"]
    assert reassessed["token"] == receipt["token"]
    lookup = client.post(
        "/api/v1/registration-status", json={"request_id": payload["request_id"]}
    ).json()
    assert lookup["priority"] == "IMMEDIATE"


def test_qualitative_vitals_are_not_numeric_thresholds_or_automatic_emergencies(client):
    login(client)
    vitals = required_vitals(temperature_c={"status": "LOW"}, pr={"status": "HIGH"})
    response = client.post("/api/v1/staff/encounters", json=intake(vitals=vitals))
    assert response.status_code == 201
    patient = saved_patient(client, response.json()["token"])
    assert patient["priority"] != "IMMEDIATE" and not patient["override_active"]
    assert not patient["assessment"]["triggered_rules"]
    endpoint = f"/api/v1/encounters/{patient['id']}"
    # Existing staff override policy still requires a new numeric measurement and a reason.
    assert (
        client.post(
            endpoint + "/override",
            json={
                "version": patient["version"],
                "priority": "IMMEDIATE",
                "reason": "Synthetic review",
                "vitals": {"pr": {"status": "HIGH"}},
            },
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    "vitals",
    [
        required_vitals(spo2={"status": "HIGH"}),
        required_vitals(sbp={"status": "LOW"}),
        required_vitals(pr={"status": "HIGH", "value": 120}),
        required_vitals(spo2={"value": 101}),
    ],
)
def test_invalid_qualitative_and_numeric_combinations_rejected(client, vitals):
    login(client)
    assert client.post("/api/v1/staff/encounters", json=intake(vitals=vitals)).status_code == 422


def test_emergency_cannot_be_requested_anonymously_or_by_public_payload(client):
    payload = intake(vitals=required_vitals(), staff_assessed_emergency=True)
    assert client.post("/api/v1/staff/encounters", json=payload).status_code == 401
    assert client.post("/api/v1/encounters", json=payload).status_code == 422
