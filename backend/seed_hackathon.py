"""Curated synthetic rehearsal queue; preserve previous records and audit history."""

import argparse
import json
import os
import sqlite3
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from backend.auth import seed_staff
from backend.database import initialize, make_engine, make_sessions
from backend.models import Encounter
from backend.schemas import StaffIntake
from backend.service import audit, latest_assessment, register

FIXTURE = Path(__file__).parent / "fixtures/hackathon_queue.json"
ACTIVE = ("WAITING", "IN_ASSESSMENT")


def activate_queue(db):
    cases = json.loads(FIXTURE.read_text())
    request_ids = {str(uuid5(NAMESPACE_URL, f"opd-hackathon-v1-{case['case']}")) for case in cases}
    created = 0
    archive_count = 0
    practice_token = None
    seed_staff(db)
    for enc in db.scalars(select(Encounter).where(Encounter.status.in_(ACTIVE))):
        if enc.request_id not in request_ids:
            previous_status = enc.status
            enc.status = "DEMO_ARCHIVED"
            enc.version += 1  # In-flight model responses cannot apply to the retired queue version.
            audit(
                db,
                enc,
                "DEMO_QUEUE_ARCHIVED",
                "DEMO_SETUP",
                {
                    "reason": "Replaced active queue with the requested curated synthetic demonstration",
                    "previous_status": previous_status,
                },
            )
            archive_count += 1
    for case in cases:
        request_id = str(uuid5(NAMESPACE_URL, f"opd-hackathon-v1-{case['case']}"))
        enc = db.scalar(select(Encounter).where(Encounter.request_id == request_id))
        if not enc:
            fields = case["intake"]
            enc = register(db, StaffIntake(request_id=request_id, **fields), actor="DEMO_SETUP")
            metadata = {"demo_dataset": "hackathon-v1"}
            if case.get("scenario"):
                metadata["demo_scenario"] = case["scenario"]
            enc.input_snapshot = {**enc.input_snapshot, **metadata}
            assessment = latest_assessment(db, enc)
            assessment.details = {**assessment.details, "ai_status": "NOT_REQUESTED"}
            audit(
                db,
                enc,
                "DEMO_SCENARIO_CREATED",
                "DEMO_SETUP",
                {
                    "fixture_case": case["case"],
                    "dataset": "hackathon-v1",
                    "priority": enc.priority,
                    "assessment_source": assessment.details["source"],
                    "scenario": case.get("scenario"),
                    "live_model_called": False,
                },
            )
            created += 1
        if case.get("scenario"):
            from backend.models import Patient

            practice_token = db.get(Patient, enc.patient_id).token_no
    db.flush()
    counts = dict(
        Counter(db.scalars(select(Encounter.priority).where(Encounter.status.in_(ACTIVE))))
    )
    if created and counts != {"IMMEDIATE": 3, "SOON": 7, "ROUTINE": 30}:
        raise RuntimeError(f"Curated baseline did not match expected counts: {counts}")
    return {
        "created": created,
        "archived": archive_count,
        "counts": counts,
        "override_practice_token": practice_token,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--activate",
        action="store_true",
        help="Archive previous active demo records and activate the 40 curated cases",
    )
    args = parser.parse_args()
    if not args.activate:
        parser.error(
            "Use --activate to change the active demo queue. Previous records are archived, not deleted."
        )
    engine = make_engine()
    initialize(engine)
    if engine.dialect.name != "sqlite":
        raise RuntimeError("The curated queue setup supports only the local SQLite demo")
    backup_dir = Path("data/backups")
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    backup = backup_dir / f"before-hackathon-{stamp}.sqlite"
    fd = os.open(backup, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    connection = engine.raw_connection()
    try:
        with sqlite3.connect(backup) as target:
            connection.driver_connection.backup(target)
    finally:
        connection.close()
    with make_sessions(engine)() as db:
        summary = activate_queue(db)
        db.commit()
    print(json.dumps({**summary, "backup": str(backup)}, indent=2))


if __name__ == "__main__":
    main()
