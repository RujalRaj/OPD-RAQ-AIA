from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


def uid():
    return str(uuid4())


def now():
    return datetime.now(UTC).isoformat()


class Token(Base):
    __tablename__ = "tokens"
    __table_args__ = {"sqlite_autoincrement": True}
    number: Mapped[int] = mapped_column(Integer, primary_key=True)


class Patient(Base):
    __tablename__ = "patients"
    patient_id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    token_no: Mapped[int] = mapped_column(Integer, unique=True)
    display_name: Mapped[str] = mapped_column(String)
    age_years: Mapped[int] = mapped_column(Integer)
    sex: Mapped[str] = mapped_column(String)
    pregnancy_status: Mapped[str] = mapped_column(String, default="UNKNOWN")
    registration_type: Mapped[str] = mapped_column(String, default="MANUAL")
    demo_id: Mapped[str] = mapped_column(String)


class Encounter(Base):
    __tablename__ = "encounters"
    encounter_id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    patient_id: Mapped[str] = mapped_column(ForeignKey("patients.patient_id"))
    registered_at: Mapped[str] = mapped_column(String, default=now)
    chief_complaint_raw: Mapped[str] = mapped_column(Text)
    confirmed_text: Mapped[str] = mapped_column(Text)
    input_snapshot: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String, default="WAITING")
    priority: Mapped[str] = mapped_column(String, default="SOON")
    override_active: Mapped[bool] = mapped_column(Boolean, default=False)
    unresolved: Mapped[bool] = mapped_column(Boolean, default=False)
    unresolved_reason: Mapped[str] = mapped_column(Text, default="")
    acknowledged_assessment: Mapped[str | None] = mapped_column(String, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    request_id: Mapped[str] = mapped_column(String, unique=True)
    request_hash: Mapped[str] = mapped_column(String)
    demo_case_id: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True)


class InputRevision(Base):
    __tablename__ = "input_revisions"
    revision_id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.encounter_id"))
    payload: Mapped[dict] = mapped_column(JSON)
    actor: Mapped[str] = mapped_column(String)
    created_at: Mapped[str] = mapped_column(String, default=now)


class Vital(Base):
    __tablename__ = "vitals"
    vital_id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.encounter_id"))
    sbp: Mapped[float | None] = mapped_column(Float, nullable=True)
    dbp: Mapped[float | None] = mapped_column(Float, nullable=True)
    pr: Mapped[float | None] = mapped_column(Float, nullable=True)
    rr: Mapped[float | None] = mapped_column(Float, nullable=True)
    spo2: Mapped[float | None] = mapped_column(Float, nullable=True)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    rbs: Mapped[float | None] = mapped_column(Float, nullable=True)
    measurements: Mapped[dict] = mapped_column(JSON)
    measured_at: Mapped[str] = mapped_column(String, default=now)
    recorded_by: Mapped[str] = mapped_column(String)


class Symptom(Base):
    __tablename__ = "symptoms"
    symptom_id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.encounter_id"))
    name: Mapped[str] = mapped_column(String)
    onset: Mapped[str | None] = mapped_column(String, nullable=True)
    severity: Mapped[str] = mapped_column(String, default="UNKNOWN")
    evidence: Mapped[dict] = mapped_column(JSON)
    revision: Mapped[int] = mapped_column(Integer)


class Assessment(Base):
    __tablename__ = "triage_assessments"
    assessment_id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.encounter_id"))
    suggested_priority: Mapped[str] = mapped_column(String)
    final_priority: Mapped[str] = mapped_column(String)
    red_flags: Mapped[list] = mapped_column(JSON)
    risk_modifiers: Mapped[list] = mapped_column(JSON)
    missing_data: Mapped[list] = mapped_column(JSON)
    reason: Mapped[str] = mapped_column(Text)
    safety_rule_version: Mapped[str] = mapped_column(String)
    details: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String, default=now)


class NurseOverride(Base):
    __tablename__ = "nurse_overrides"
    override_id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.encounter_id"))
    from_priority: Mapped[str] = mapped_column(String)
    to_priority: Mapped[str] = mapped_column(String)
    reason_code: Mapped[str] = mapped_column(String)
    note: Mapped[str] = mapped_column(Text)
    user_id: Mapped[str] = mapped_column(String)
    vital_id: Mapped[str | None] = mapped_column(ForeignKey("vitals.vital_id"), nullable=True)
    created_at: Mapped[str] = mapped_column(String, default=now)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    event_id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.encounter_id"))
    event_type: Mapped[str] = mapped_column(String)
    actor: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[str] = mapped_column(String, default=now)


class QueueEvent(Base):
    __tablename__ = "queue_events"
    queue_event_id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.encounter_id"))
    old_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    new_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, default=now)


class StaffUser(Base):
    __tablename__ = "staff_users"
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    display_name: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str] = mapped_column(String)


class StaffSession(Base):
    __tablename__ = "staff_sessions"
    token_hash: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("staff_users.user_id"))
    expires_at: Mapped[float] = mapped_column(Float)


class SymptomTranslation(Base):
    __tablename__ = "symptom_translations"
    cache_key: Mapped[str] = mapped_column(String, primary_key=True)
    encounter_id: Mapped[str] = mapped_column(ForeignKey("encounters.encounter_id"))
    source_language: Mapped[str] = mapped_column(String)
    target_language: Mapped[str] = mapped_column(String)
    translated_text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String)
    provider: Mapped[str] = mapped_column(String, default="")
    model: Mapped[str] = mapped_column(String, default="")
    error: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, default=now)
