"""Explicit, repeatable synthetic seed. Never changes existing encounters."""

import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import select

from backend.auth import seed_staff
from backend.database import initialize, make_engine, make_sessions
from backend.models import Encounter
from backend.schemas import Intake
from backend.service import register
from backend.services.symptom_processor import routine_description_supported


def case_intake(case):
    # These fixture descriptions explicitly describe stable refill/follow-up visits.
    # The expected-priority column is never passed to the engine.
    return Intake(
        request_id=uuid5(NAMESPACE_URL, f"opd-demo-case-{case['case']}"),
        name=f"Demo Patient {case['case']:02d}",
        age_years=case["age"],
        sex={"M": "MALE", "F": "FEMALE"}[case["sex"]],
        pregnancy_status={
            "Not pregnant": "NOT_PREGNANT",
            "Pregnant": "PREGNANT",
            "Postpartum": "POSTPARTUM",
        }[case["pregnancy"]],
        language="en-IN",
        original_text=case["text"],
        confirmed_text=case["text"],
        facts={"stable_routine_visit": True} if routine_description_supported(case["text"]) else {},
        vitals={
            k: {"value": case[k], "status": "RECORDED"}
            for k in ("sbp", "dbp", "pr", "rr", "spo2", "temperature_c")
            if case[k] is not None
        },
    )


def main():
    engine = make_engine()
    initialize(engine)
    cases = json.loads((Path(__file__).parent / "fixtures/synthetic_cases.json").read_text())
    count = 0
    with make_sessions(engine)() as db:
        seed_staff(db)
        for case in sorted(cases, key=lambda c: c["token"]):
            if db.scalar(select(Encounter).where(Encounter.demo_case_id == case["case"])):
                continue
            register(db, case_intake(case), token=case["token"], demo_case_id=case["case"])
            count += 1
        db.commit()
    print(
        f"Seeded {count} synthetic cases. Demo users: nurse, doctor, intern, jr. Password: DemoOnly!2026"
    )


if __name__ == "__main__":
    main()
