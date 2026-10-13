from collections import Counter

from conftest import create_patient, login
from sqlalchemy import select

from backend.models import AuditEvent, Encounter
from backend.seed_hackathon import activate_queue


def test_curated_queue_keeps_old_history_and_exact_source_derived_baseline(client):
    login(client)
    old = create_patient(client, confirmed_text="Old synthetic case")
    with client.app.state.sessions() as db:
        summary = activate_queue(db)
        db.commit()
        assert db.get(Encounter, old["id"]).status == "DEMO_ARCHIVED"
        assert db.scalar(
            select(AuditEvent).where(
                AuditEvent.encounter_id == old["id"], AuditEvent.event_type == "DEMO_QUEUE_ARCHIVED"
            )
        )
    assert summary["counts"] == {"IMMEDIATE": 3, "SOON": 7, "ROUTINE": 30}
    rows = client.get("/api/v1/dashboard").json()["original_queue"]
    assert len(rows) == 40 and len({row["token"] for row in rows}) == 40
    assert Counter(row["priority"] for row in rows) == summary["counts"]
    assert all(row["assessment"]["ai_status"] == "NOT_REQUESTED" for row in rows)
    practice = next(row for row in rows if row["input"].get("demo_scenario"))
    assert practice["token"] == summary["override_practice_token"]
    assert practice["priority"] == "IMMEDIATE" and not practice["override_active"]
    endpoint = f"/api/v1/encounters/{practice['id']}"
    changed = client.post(
        endpoint + "/override",
        json={
            "version": practice["version"],
            "priority": "ROUTINE",
            "reason": "Scripted clarification: registration error; routine refill visit",
            "vitals": {"pr": {"value": 82}},
        },
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["token"] == practice["token"]
    assert changed.json()["assessment"]["red_flags"]
    with client.app.state.sessions() as db:
        again = activate_queue(db)
        db.commit()
    assert again["created"] == 0
    assert again["counts"] == {"IMMEDIATE": 2, "SOON": 7, "ROUTINE": 31}
    assert client.get(endpoint).json()["override_active"]
    assert client.get("/api/v1/encounters/" + old["id"]).status_code == 200
