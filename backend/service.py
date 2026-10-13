import hashlib
import json

from fastapi import HTTPException
from sqlalchemy import select

from backend.models import (
    Assessment,
    AuditEvent,
    Encounter,
    InputRevision,
    NurseOverride,
    Patient,
    QueueEvent,
    Symptom,
    Token,
    Vital,
    now,
)
from backend.schemas import VITAL_UNITS
from backend.services.catalog import FACT_KEYS, PATIENT_OPTIONS, SYMPTOM_VERSION, selection_labels
from backend.services.triage_rules import RANK, assess


def audit(db, enc, kind, actor, payload):
    item = AuditEvent(encounter_id=enc.encounter_id, event_type=kind, actor=actor, payload=payload)
    db.add(item)
    db.flush()
    return item.event_id


def validate_facts(facts, symptoms=()):
    invalid = set(facts) - FACT_KEYS
    invalid |= set(symptoms) - {o["id"] for o in PATIENT_OPTIONS}
    if invalid:
        raise HTTPException(422, "Unknown clinical fact or symptom code")


def encounter(db, eid, version=None):
    enc = db.get(Encounter, eid)
    if not enc:
        raise HTTPException(404, "Encounter not found")
    if version is not None and enc.version != version:
        raise HTTPException(409, "Patient data changed. Refresh the details before saving.")
    return enc


def latest_assessment(db, enc):
    return db.scalar(
        select(Assessment)
        .where(Assessment.encounter_id == enc.encounter_id)
        .order_by(Assessment.created_at.desc(), Assessment.assessment_id.desc())
    )


def current_vitals(db, enc):
    last = db.scalar(
        select(Vital)
        .where(Vital.encounter_id == enc.encounter_id)
        .order_by(Vital.measured_at.desc(), Vital.vital_id.desc())
    )
    return (
        last.measurements
        if last
        else {
            k: {"value": None, "status": "NOT_MEASURED", "unit": u, "measured_at": None}
            for k, u in VITAL_UNITS.items()
        }
    )


def add_vitals(db, enc, measurements, actor):
    previous = current_vitals(db, enc)
    stamp = now()
    merged = {**previous}
    for key, item in measurements.items():
        merged[key] = {
            **item.model_dump(),
            "unit": VITAL_UNITS[key],
            "measured_at": stamp if item.status in {"RECORDED", "HIGH", "LOW"} else None,
            "recorded_by": actor,
        }
    record = Vital(
        encounter_id=enc.encounter_id,
        measurements=merged,
        measured_at=stamp,
        recorded_by=actor,
        **{k: m["value"] for k, m in merged.items()},
    )
    db.add(record)
    db.flush()
    audit(
        db,
        enc,
        "VITALS",
        actor,
        {
            "vital_id": record.vital_id,
            "submitted": {k: v.model_dump() for k, v in measurements.items()},
        },
    )
    return record


def positions(db):
    rows = list(
        db.scalars(select(Encounter).where(Encounter.status.in_(["WAITING", "IN_ASSESSMENT"])))
    )
    rows.sort(key=lambda e: (RANK[e.priority], e.registered_at, e.encounter_id))
    return {e.encounter_id: i + 1 for i, e in enumerate(rows)}


def queue_change(db, enc, before, reason):
    db.flush()
    after = positions(db)
    if before.get(enc.encounter_id) != after.get(enc.encounter_id):
        db.add(
            QueueEvent(
                encounter_id=enc.encounter_id,
                old_position=before.get(enc.encounter_id),
                new_position=after.get(enc.encounter_id),
                reason=reason,
            )
        )


def run_assessment(db, enc, actor="RULE", kind="TRIAGE"):
    before = positions(db)
    previous = latest_assessment(db, enc)
    result = assess(enc.input_snapshot, current_vitals(db, enc))
    result["needs_staff_review"] = result["caution"]
    if previous and (
        previous.details.get("ai_immediate") or previous.details.get("retained_ai_alert")
    ):
        result["retained_ai_alert"] = previous.details.get("retained_ai_alert") or {
            "assessment_id": previous.assessment_id,
            "provider": previous.details.get("ai_provider"),
            "model": previous.details.get("model_version"),
        }
    old = enc.priority
    if not enc.override_active:
        enc.priority = result["suggested_priority"]
        if (
            previous
            and (
                previous.details.get("source") == "AI_WITH_SAFETY_GATE"
                or previous.details.get("carried_ai_priority")
            )
            and RANK[old] < RANK[enc.priority]
        ):
            # Re-running local rules is not a new model decision. Keep a more urgent
            # prior AI priority until a valid replacement or staff override arrives.
            enc.priority = old
            result["carried_ai_priority"] = previous.details.get("carried_ai_priority") or {
                "assessment_id": previous.assessment_id,
                "priority": old,
            }
    record = Assessment(
        encounter_id=enc.encounter_id,
        suggested_priority=result["suggested_priority"],
        final_priority=enc.priority,
        red_flags=result["red_flags"],
        risk_modifiers=["CAUTION"] if result["caution"] else [],
        missing_data=result["missing_data"],
        reason=result["reason"],
        safety_rule_version=result["safety_rule_version"],
        details=result,
    )
    db.add(record)
    db.flush()
    for symptom in result["structured_symptoms"]:
        db.add(
            Symptom(
                encounter_id=enc.encounter_id,
                name=symptom["name"],
                evidence=symptom["evidence"],
                revision=enc.version,
            )
        )
    audit(
        db,
        enc,
        kind,
        actor,
        {
            "assessment_id": record.assessment_id,
            "suggestion": record.suggested_priority,
            "previous_priority": old,
            "active_priority": enc.priority,
            "reason": record.reason,
            "rule_ids": [r["id"] for r in result["triggered_rules"]],
            "rule_version": record.safety_rule_version,
            "missing_data": result["missing_data"],
            "staff_override_preserved": enc.override_active,
            "carried_ai_priority": result.get("carried_ai_priority"),
        },
    )
    if result["red_flags"]:
        audit(
            db,
            enc,
            "ALERT",
            "RULE",
            {
                "assessment_id": record.assessment_id,
                "message": "Immediate staff assessment requested",
                "rule_ids": [r["id"] for r in result["red_flags"]],
            },
        )
    queue_change(db, enc, before, kind)
    return record


def register(db, payload, token=None, demo_case_id=None, *, actor="PATIENT"):
    data = payload.model_dump(mode="json")
    emergency = data.get("staff_assessed_emergency", False)
    if emergency and actor == "PATIENT":
        raise HTTPException(403, "A staff emergency decision requires staff authentication")
    validate_facts(data["facts"], data["symptoms"])
    digest = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    previous = db.scalar(select(Encounter).where(Encounter.request_id == str(payload.request_id)))
    if previous:
        if previous.request_hash != digest:
            raise HTTPException(409, "This submission ID was already used for different data")
        return previous
    # Hash only the submitted request above; freeze labels for history after deduplication.
    data["selected_symptom_labels"] = selection_labels(data)
    data["symptom_catalog_version"] = SYMPTOM_VERSION
    counter = Token(**({"number": token} if token else {}))
    db.add(counter)
    db.flush()
    patient = Patient(
        token_no=counter.number,
        display_name=payload.name,
        age_years=payload.age_years,
        sex=payload.sex,
        pregnancy_status=payload.pregnancy_status,
        registration_type=payload.registration_type,
        demo_id=f"DEMO-{counter.number:04d}",
    )
    db.add(patient)
    db.flush()
    enc = Encounter(
        patient_id=patient.patient_id,
        chief_complaint_raw=payload.original_text,
        confirmed_text=payload.confirmed_text,
        input_snapshot=data,
        request_id=str(payload.request_id),
        request_hash=digest,
        demo_case_id=demo_case_id,
    )
    db.add(enc)
    db.flush()
    db.add(InputRevision(encounter_id=enc.encounter_id, payload=data, actor=actor))
    audit(
        db,
        enc,
        "REGISTER",
        actor,
        {
            "token": patient.token_no,
            "input_methods": payload.input_methods,
            "language": payload.language,
        },
    )
    vital = None
    if payload.vitals:
        vital = add_vitals(db, enc, payload.vitals, "DEMO_INTAKE" if actor == "PATIENT" else actor)
    assessment = run_assessment(db, enc)
    if emergency:
        before = positions(db)
        old = enc.priority
        reason = "Staff assessed emergency at registration"
        enc.priority = "IMMEDIATE"
        enc.override_active = True
        decision = NurseOverride(
            encounter_id=enc.encounter_id,
            from_priority=old,
            to_priority="IMMEDIATE",
            reason_code="STAFF_ASSESSED_EMERGENCY",
            note=reason,
            user_id=actor,
            vital_id=vital.vital_id,
        )
        db.add(decision)
        db.flush()
        assessment.final_priority = enc.priority
        assessment.details = {**assessment.details, "ai_status": "SKIPPED_OVERRIDE"}
        audit(
            db,
            enc,
            "STAFF_ASSESSED_EMERGENCY",
            actor,
            {
                "from_priority": old,
                "to_priority": enc.priority,
                "reason": reason,
                "override_id": decision.override_id,
                "vital_id": vital.vital_id,
            },
        )
        queue_change(db, enc, before, "STAFF_ASSESSED_EMERGENCY")
    review_reason = getattr(payload, "doctor_review_reason", None)
    if review_reason is not None:
        enc.unresolved = True
        enc.unresolved_reason = review_reason.strip()
        audit(
            db,
            enc,
            "DOCTOR_REVIEW_REQUESTED",
            actor,
            {"reason": enc.unresolved_reason, "priority_retained": enc.priority},
        )
    return enc


def details(db, enc):
    p = db.get(Patient, enc.patient_id)
    a = latest_assessment(db, enc)
    staff_decision = (
        db.scalar(
            select(NurseOverride)
            .where(NurseOverride.encounter_id == enc.encounter_id)
            .order_by(NurseOverride.created_at.desc(), NurseOverride.override_id.desc())
        )
        if enc.override_active
        else None
    )
    return {
        "id": enc.encounter_id,
        "token": p.token_no,
        "name": p.display_name,
        "demo_id": p.demo_id,
        "age": p.age_years,
        "sex": p.sex,
        "pregnancy_status": p.pregnancy_status,
        "registered_at": enc.registered_at,
        "status": enc.status,
        "priority": enc.priority,
        "version": enc.version,
        "override_active": enc.override_active,
        "unresolved": enc.unresolved,
        "unresolved_reason": enc.unresolved_reason,
        "original_text": enc.chief_complaint_raw,
        "confirmed_text": enc.confirmed_text,
        "input": enc.input_snapshot,
        "vitals": current_vitals(db, enc),
        "assessment": {
            **a.details,
            "id": a.assessment_id,
            "created_at": a.created_at,
            "staff_decision": {
                "reason": staff_decision.note,
                "priority": staff_decision.to_priority,
                "actor": staff_decision.user_id,
                "kind": staff_decision.reason_code,
            }
            if staff_decision
            else None,
        }
        if a
        else None,
        "alert_acknowledged": bool(a and enc.acknowledged_assessment == a.assessment_id),
    }
