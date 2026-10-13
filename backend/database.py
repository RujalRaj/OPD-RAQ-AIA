import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


class Base(DeclarativeBase):
    pass


def make_engine(url=None):
    url = url or os.getenv("DATABASE_URL", "sqlite:///./data/opd.db")
    if url.startswith("sqlite:///") and ":memory:" not in url:
        Path(url.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 15}
        if url.startswith("sqlite")
        else {},
    )
    if url.startswith("sqlite"):

        @event.listens_for(engine, "connect")
        def sqlite_config(conn, _):
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("PRAGMA journal_mode=WAL")

    return engine


def initialize(engine):
    from backend import models  # noqa: F401

    Base.metadata.create_all(engine)
    if engine.dialect.name == "sqlite":
        with engine.begin() as conn:
            for operation in ("UPDATE", "DELETE"):
                conn.exec_driver_sql(
                    f"CREATE TRIGGER IF NOT EXISTS audit_no_{operation.lower()} BEFORE {operation} ON audit_events BEGIN SELECT RAISE(ABORT, 'Audit events are append-only'); END"
                )


def make_sessions(engine):
    return sessionmaker(engine, expire_on_commit=False)
