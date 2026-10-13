"""Start the packaged demo; seed only an empty database, never reset a working queue."""

import os

import uvicorn
from sqlalchemy import select

from backend.auth import seed_staff
from backend.database import initialize, make_engine, make_sessions
from backend.models import Encounter
from backend.seed_hackathon import activate_queue


def prepare_database():
    engine = make_engine()
    initialize(engine)
    with make_sessions(engine)() as db:
        seed_staff(db)
        if os.getenv("SEED_DEMO_ON_EMPTY", "false").lower() == "true" and not db.scalar(
            select(Encounter.encounter_id).limit(1)
        ):
            activate_queue(db)
        db.commit()
    engine.dispose()


if __name__ == "__main__":
    prepare_database()
    uvicorn.run("backend.main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
