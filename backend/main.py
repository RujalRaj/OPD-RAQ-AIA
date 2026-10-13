import hashlib
import json
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text

from backend.auth import check_password, session_token
from backend.database import initialize, make_engine, make_sessions
from backend.models import (
    Assessment,
    AuditEvent,
    Encounter,
    InputRevision,
    NurseOverride,
    StaffSession,
    StaffUser,
    SymptomTranslation,
)
from backend.schemas import (
    AuditView,
    DashboardView,
    Intake,
    Login,
    Override,
    PatientView,
    Reassessment,
    Receipt,
    ReceiptLookup,
    ReviewRequest,
    StaffIntake,
    StaffView,
    Versioned,
)
from backend.service import (
    add_vitals,
    audit,
    details,
    encounter,
    latest_assessment,
    positions,
    queue_change,
    register,
    run_assessment,
    validate_facts,
)
from backend.services.ai import (
    PROMPT_VERSION,
    PROVIDERS,
    clinical_evidence,
    configuration,
    failure_code,
    propose,
)
from backend.services.catalog import catalog
from backend.services.translation import (
    prepared_translation,
    translate,
    translation_context,
    translation_view,
)
from backend.services.triage_rules import RANK


def create_app(database_url=None):
    engine = make_engine(database_url)
    sessions = make_sessions(engine)

    @asynccontextmanager
    async def lifespan(app):
        initialize(engine)
        # A process restart cannot resume an in-memory background request.
        with sessions() as db:
            for assessment in db.scalars(select(Assessment)):
                if assessment.details.get("ai_status") == "PENDING":
                    assessment.details = {
                        **assessment.details,
                        "ai_status": "UNAVAILABLE",
                        "ai_error": "INTERRUPTED",
                        "needs_staff_review": True,
                    }
                    enc = encounter(db, assessment.encounter_id)
                    audit(
                        db,
                        enc,
                        "AI_INTERRUPTED",
                        "SYSTEM",
                        {"assessment_id": assessment.assessment_id},
                    )
            for row in db.scalars(
                select(SymptomTranslation).where(SymptomTranslation.status == "PENDING")
            ):
                row.status = "UNAVAILABLE"
                row.error = "INTERRUPTED"
            db.commit()
        yield
        engine.dispose()

    app = FastAPI(title="OPD RAQ AIA — synthetic demo", version="0.1.0", lifespan=lifespan)
    app.state.engine = engine
    app.state.sessions = sessions
    origins = os.getenv(
        "LOCAL_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8000,http://localhost:8000",
    ).split(",")
    for public_url in (os.getenv("PUBLIC_BASE_URL"), os.getenv("RENDER_EXTERNAL_URL")):
        if public_url:
            origins.append(public_url.rstrip("/"))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def origin_check(request, call_next):
        if (
            request.method == "POST"
            and request.headers.get("origin")
            and request.headers["origin"] not in origins
        ):
            from fastapi.responses import JSONResponse

            return JSONResponse({"detail": "Origin not permitted"}, status_code=403)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Cache-Control"] = "no-store"
        return response

    def database(request: Request):
        with sessions() as db:
            if request.method == "POST":
                db.execute(text("BEGIN IMMEDIATE"))
            try:
                yield db
                db.commit()
            except Exception:
                db.rollback()
                raise

    def staff(request: Request, db=Depends(database)):
        token = request.cookies.get("opd_session", "")
        session = db.get(StaffSession, hashlib.sha256(token.encode()).hexdigest())
        if not session or session.expires_at <= time.time():
            raise HTTPException(401, "Staff sign-in required")
        return db.get(StaffUser, session.user_id)

    def public_user(user):
        return {"id": user.user_id, "name": user.display_name, "role": user.role}

    def model_job(eid, version, assessment_id):
        with sessions() as db:
            pending = db.get(Assessment, assessment_id)
            evidence = pending.details["ai_input"]
            config = pending.details["ai_configuration"]
        try:
            proposal = propose(evidence)
            state, error = "COMPLETE", None
        except Exception as exc:
            proposal = None
            state, error = "UNAVAILABLE", failure_code(exc)
        with sessions() as db:
            db.execute(text("BEGIN IMMEDIATE"))
            enc = encounter(db, eid)
            previous = latest_assessment(db, enc)
            if enc.version != version or previous.assessment_id != assessment_id:
                pending = db.get(Assessment, assessment_id)
                pending.details = {
                    **pending.details,
                    "ai_status": "SUPERSEDED",
                    "needs_staff_review": True,
                }
                audit(db, enc, "AI_STALE_DISCARDED", "AI", {"assessment_id": assessment_id})
                db.commit()
                return
            result = {
                **previous.details,
                "ai_status": state,
                "ai_error": error,
                "model_version": config["model"],
                "ai_provider": config["provider"],
                "prompt_version": PROMPT_VERSION,
                "needs_staff_review": True,
            }
            before = positions(db)
            blocked = None
            if proposal:
                if enc.override_active:
                    blocked = "STAFF_OVERRIDE"
                elif previous.red_flags:
                    blocked = "IMMEDIATE_SOURCE_RULE"
                elif previous.details["triggered_rules"] and proposal.priority == "ROUTINE":
                    blocked = "SOURCE_RULE_MINIMUM"
                elif proposal.priority == "ROUTINE" and (
                    proposal.needs_staff_review
                    or proposal.missing_information
                    or (
                        previous.missing_data
                        and enc.input_snapshot.get("facts", {}).get(
                            "missing_vitals_prevent_downgrade"
                        )
                        is True
                    )
                ):
                    blocked = "INCOMPLETE_CONTEXT"
                allowed = blocked is None
                result["ai_proposal"] = {
                    "priority": proposal.priority,
                    "evidence_ids": proposal.evidence_ids,
                    "applied": allowed,
                    "blocked_reason": blocked,
                    "needs_staff_review": proposal.needs_staff_review,
                    # Do not expose generated clinical prose as verified facts.
                    "missing_information_count": len(proposal.missing_information),
                }
                result["needs_staff_review"] = bool(
                    proposal.needs_staff_review or proposal.missing_information or blocked
                )
                if allowed:
                    result.pop("carried_ai_priority", None)
                    enc.priority = proposal.priority
                    result["suggested_priority"] = proposal.priority
                    fields = {
                        "reported_text": "reported symptoms",
                        "selected_symptoms": "selected symptoms",
                        "reported_facts": "reported context",
                        "patient_context": "patient context",
                        "history": "reported history",
                        "medications": "reported medicines",
                        "vitals": "available measurements",
                    }
                    cited = ", ".join(fields[k] for k in dict.fromkeys(proposal.evidence_ids))
                    result["reason"] = (
                        f"AI suggests {proposal.priority.title()} based on {cited}. Staff may review and change this suggestion."
                    )
                    result["source"] = "AI_WITH_SAFETY_GATE"
                    result["ai_immediate"] = proposal.priority == "IMMEDIATE"
                    if result["ai_immediate"]:
                        audit(
                            db,
                            enc,
                            "ALERT",
                            "AI",
                            {
                                "message": "Immediate staff assessment requested",
                                "provider": config["provider"],
                                "model": config["model"],
                                "evidence_ids": proposal.evidence_ids,
                            },
                        )
            queue_change(db, enc, before, "AI_ASSESSMENT")
            record = Assessment(
                encounter_id=eid,
                suggested_priority=result["suggested_priority"],
                final_priority=enc.priority,
                red_flags=previous.red_flags,
                risk_modifiers=previous.risk_modifiers,
                missing_data=previous.missing_data,
                reason=result["reason"],
                safety_rule_version=previous.safety_rule_version,
                details=result,
            )
            # The original pending record also records completion for restart recovery.
            previous.details = {**previous.details, "ai_status": state, "ai_error": error}
            db.add(record)
            enc.version += 1
            audit(
                db,
                enc,
                "AI_ASSESSMENT",
                "AI",
                {
                    "status": state,
                    "error_code": error,
                    "proposal": result.get("ai_proposal"),
                    "provider": config["provider"],
                    "model": config["model"],
                    "prompt_version": PROMPT_VERSION,
                    "source_assessment_id": assessment_id,
                    "input_fingerprint": hashlib.sha256(
                        json.dumps(evidence, sort_keys=True, ensure_ascii=False).encode()
                    ).hexdigest(),
                    "active_priority": enc.priority,
                },
            )
            db.commit()

    def maybe_ai(db, enc, tasks):
        a = latest_assessment(db, enc)
        config = configuration()
        if config["provider"] == "disabled":
            return
        if a.details.get("ai_status", "DISABLED") != "DISABLED":
            return  # An idempotent registration retry must not start a second paid request.
        if a.red_flags:
            a.details = {**a.details, "ai_status": "SKIPPED_SAFETY"}
            return  # Urgent source conditions never wait for a network request.
        if enc.override_active:
            a.details = {**a.details, "ai_status": "SKIPPED_OVERRIDE"}
            return
        if config["provider"] not in PROVIDERS or not config["configured"]:
            a.details = {
                **a.details,
                "ai_status": "UNAVAILABLE",
                "ai_error": "NOT_CONFIGURED",
                "needs_staff_review": True,
            }
            audit(db, enc, "AI_UNAVAILABLE", "SYSTEM", {"error_code": "NOT_CONFIGURED"})
            return
        evidence = clinical_evidence(enc.input_snapshot, details(db, enc)["vitals"])
        a.details = {
            **a.details,
            "ai_status": "PENDING",
            "ai_input": evidence,
            "ai_configuration": config,
            "ai_provider": config["provider"],
            "model_version": config["model"],
            "needs_staff_review": True,
        }
        audit(
            db,
            enc,
            "AI_REQUESTED",
            "AI",
            {
                "assessment_id": a.assessment_id,
                "provider": config["provider"],
                "model": config["model"],
                "prompt_version": PROMPT_VERSION,
            },
        )
        db.commit()  # Publish the local result and pending state before requesting inference.
        tasks.add_task(model_job, enc.encounter_id, enc.version, a.assessment_id)

    @app.get("/api/v1/health")
    def health():
        config = configuration()
        return {
            "status": "ok",
            "demo_only": True,
            "ai_provider": config["provider"],
            "ai_model": config["model"],
            "ai_configured": config["configured"],
            "ai_configuration_valid": config["supported"],
            "ai_connection_status": "NOT_CHECKED_BY_HEALTH",
        }

    @app.get("/api/v1/catalog")
    def get_catalog():
        return catalog()

    @app.post("/api/v1/auth/login", response_model=StaffView)
    def login(payload: Login, response: Response, db=Depends(database)):
        user = db.get(StaffUser, payload.username)
        if not user or not check_password(payload.password, user.password_hash):
            raise HTTPException(401, "Incorrect demo username or password")
        token = session_token(db, user.user_id)
        response.set_cookie(
            "opd_session",
            token,
            httponly=True,
            samesite="strict",
            max_age=8 * 3600,
            secure=os.getenv("COOKIE_SECURE", "false").lower() == "true",
        )
        return public_user(user)

    @app.get("/api/v1/auth/me", response_model=StaffView)
    def me(user=Depends(staff)):
        return public_user(user)

    @app.post("/api/v1/auth/logout")
    def logout(request: Request, response: Response, db=Depends(database)):
        row = db.get(
            StaffSession,
            hashlib.sha256(request.cookies.get("opd_session", "").encode()).hexdigest(),
        )
        if row:
            db.delete(row)
        response.delete_cookie("opd_session")
        return {"ok": True}

    @app.post("/api/v1/encounters", status_code=201, response_model=Receipt)
    def create_encounter(payload: Intake, tasks: BackgroundTasks, db=Depends(database)):
        enc = register(db, payload)
        return registration_receipt(db, enc, tasks)

    @app.post("/api/v1/staff/encounters", status_code=201, response_model=Receipt)
    def create_staff_encounter(
        payload: StaffIntake, tasks: BackgroundTasks, user=Depends(staff), db=Depends(database)
    ):
        enc = register(db, payload, actor=user.user_id)
        return registration_receipt(db, enc, tasks)

    def registration_receipt(db, enc, tasks):
        maybe_ai(db, enc, tasks)
        result = details(db, enc)
        # Public receipt contains no database ID or other patients' information.
        return {
            "token": result["token"],
            "demo_id": result["demo_id"],
            "registered": True,
            "priority": result["priority"],
            "urgent_alert": urgent_alert(result),
            "ai_status": result["assessment"]["ai_status"],
            "needs_staff_review": result["assessment"].get("needs_staff_review", False),
        }

    def urgent_alert(result):
        a = result["assessment"]
        return bool(
            a["red_flags"]
            or a.get("ai_immediate")
            or a.get("retained_ai_alert")
            or result["priority"] == "IMMEDIATE"
        )

    @app.post("/api/v1/registration-status", response_model=Receipt)
    def registration_status(payload: ReceiptLookup, db=Depends(database)):
        # Random request UUID is a capability held only by the registering browser.
        # Never offer public lookup by sequential token or expose staff/clinical records.
        enc = db.scalar(select(Encounter).where(Encounter.request_id == str(payload.request_id)))
        if not enc:
            raise HTTPException(404, "Registration not found")
        result = details(db, enc)
        return {
            "token": result["token"],
            "demo_id": result["demo_id"],
            "registered": True,
            "priority": result["priority"],
            "urgent_alert": urgent_alert(result),
            "ai_status": result["assessment"]["ai_status"],
            "needs_staff_review": result["assessment"].get("needs_staff_review", False),
        }

    @app.get("/api/v1/dashboard", response_model=DashboardView)
    def dashboard(user=Depends(staff), db=Depends(database)):
        rows = list(
            db.scalars(
                select(Encounter)
                .where(Encounter.status.in_(["WAITING", "IN_ASSESSMENT"]))
                .order_by(Encounter.registered_at, Encounter.encounter_id)
            )
        )
        cards = [details(db, enc) for enc in rows]
        return {
            "original_queue": cards,
            "priority_order": [
                c["id"]
                for c in sorted(
                    cards, key=lambda c: (RANK[c["priority"]], c["registered_at"], c["id"])
                )
            ],
            "counts": {
                **{p: sum(c["priority"] == p for c in cards) for p in RANK},
                "TOTAL": len(cards),
                "UNRESOLVED": sum(c["unresolved"] for c in cards),
            },
        }

    @app.get("/api/v1/encounters/{eid}", response_model=PatientView)
    def get_encounter(eid: str, user=Depends(staff), db=Depends(database)):
        return details(db, encounter(db, eid))

    def translation_job(cache_key, original, actor):
        with sessions() as db:
            row = db.get(SymptomTranslation, cache_key)
            source, target = row.source_language, row.target_language
        try:
            translated = translate(original, source, target)
            status, error = "COMPLETE", None
        except Exception as exc:
            translated, status, error = "", "UNAVAILABLE", failure_code(exc)
        # Provider requests run outside a database transaction and cannot change triage.
        with sessions() as db:
            db.execute(text("BEGIN IMMEDIATE"))
            row = db.get(SymptomTranslation, cache_key)
            row.translated_text, row.status, row.error = translated, status, error
            audit(
                db,
                encounter(db, row.encounter_id),
                "SYMPTOM_TRANSLATION",
                actor,
                {
                    "status": status,
                    "target_language": target,
                    "provider": row.provider,
                    "model": row.model,
                    "error": error,
                    "cache_key": cache_key,
                },
            )
            db.commit()

    @app.get("/api/v1/encounters/{eid}/translation")
    def get_translation(eid: str, user=Depends(staff), db=Depends(database)):
        enc = encounter(db, eid)
        key, source, target = translation_context(enc)
        row = db.get(SymptomTranslation, key)
        return (
            translation_view(row)
            if row
            else {
                "status": "NOT_REQUESTED",
                "text": "",
                "source_language": source,
                "target_language": target,
                "provider": "",
                "model": "",
                "error": None,
            }
        )

    @app.post("/api/v1/encounters/{eid}/translation")
    def request_translation(
        eid: str, tasks: BackgroundTasks, user=Depends(staff), db=Depends(database)
    ):
        enc = encounter(db, eid)
        key, source, target = translation_context(enc)
        row = db.get(SymptomTranslation, key)
        if row and row.status in {"COMPLETE", "PENDING", "EMPTY"}:
            return translation_view(row)
        if row is None:
            row = SymptomTranslation(
                cache_key=key,
                encounter_id=eid,
                source_language=source,
                target_language=target,
                status="PENDING",
            )
            db.add(row)
        row.error = None
        prepared = prepared_translation(enc.chief_complaint_raw, source)
        config = configuration()
        if not enc.chief_complaint_raw.strip():
            row.status, row.translated_text, row.provider = "EMPTY", "", "CATALOG"
        elif prepared:
            row.status, row.translated_text, row.provider = "COMPLETE", prepared, "DEMO_PHRASEBOOK"
        elif not config["configured"]:
            row.status, row.translated_text, row.error = "UNAVAILABLE", "", "NOT_CONFIGURED"
        else:
            row.status, row.provider, row.model = "PENDING", config["provider"], config["model"]
            tasks.add_task(translation_job, key, enc.chief_complaint_raw, user.user_id)
        audit(
            db,
            enc,
            "SYMPTOM_TRANSLATION_REQUESTED",
            user.user_id,
            {"target_language": target, "status": row.status, "cache_key": key},
        )
        db.flush()
        result = translation_view(row)
        db.commit()
        return result

    @app.post("/api/v1/encounters/{eid}/vitals", response_model=PatientView)
    def vitals(
        eid: str,
        payload: Versioned,
        tasks: BackgroundTasks,
        user=Depends(staff),
        db=Depends(database),
    ):
        enc = encounter(db, eid, payload.version)
        if not payload.vitals:
            raise HTTPException(422, "Provide a measurement or an explicit missing status")
        add_vitals(db, enc, payload.vitals, user.user_id)
        enc.version += 1
        run_assessment(db, enc, user.user_id, "REASSESS")
        maybe_ai(db, enc, tasks)
        return details(db, enc)

    @app.post("/api/v1/encounters/{eid}/assessments", response_model=PatientView)
    @app.post("/api/v1/encounters/{eid}/reassess", response_model=PatientView)
    def reassess(
        eid: str,
        payload: Reassessment,
        tasks: BackgroundTasks,
        user=Depends(staff),
        db=Depends(database),
    ):
        enc = encounter(db, eid, payload.version)
        validate_facts(payload.facts)
        snapshot = {
            **enc.input_snapshot,
            "facts": {**enc.input_snapshot.get("facts", {}), **payload.facts},
        }
        if payload.new_symptoms.strip():
            snapshot["confirmed_text"] = (
                enc.confirmed_text + "\nStaff update: " + payload.new_symptoms
            )
            enc.confirmed_text = snapshot["confirmed_text"]
        enc.input_snapshot = snapshot
        db.add(
            InputRevision(
                encounter_id=eid,
                payload={"new_symptoms": payload.new_symptoms, "facts": payload.facts},
                actor=user.user_id,
            )
        )
        if payload.vitals:
            add_vitals(db, enc, payload.vitals, user.user_id)
        enc.version += 1
        run_assessment(db, enc, user.user_id, "REASSESS")
        maybe_ai(db, enc, tasks)
        return details(db, enc)

    @app.post("/api/v1/encounters/{eid}/override", response_model=PatientView)
    def override(eid: str, payload: Override, user=Depends(staff), db=Depends(database)):
        enc = encounter(db, eid, payload.version)
        if user.role != "DOCTOR" and not any(
            m.status == "RECORDED" and m.value is not None for m in payload.vitals.values()
        ):
            raise HTTPException(
                422,
                "Nurse, intern and JR overrides require at least one recorded vital plus a reason",
            )
        before = positions(db)
        old = enc.priority
        measurement = add_vitals(db, enc, payload.vitals, user.user_id) if payload.vitals else None
        # Re-evaluate newly submitted vitals before recording the staff decision.
        if measurement:
            run_assessment(db, enc, user.user_id, "REASSESS")
        enc.priority = payload.priority
        enc.override_active = True
        enc.version += 1
        row = NurseOverride(
            encounter_id=eid,
            from_priority=old,
            to_priority=payload.priority,
            reason_code=payload.reason_code,
            note=payload.reason.strip(),
            user_id=user.user_id,
            vital_id=measurement.vital_id if measurement else None,
        )
        db.add(row)
        db.flush()
        audit(
            db,
            enc,
            "OVERRIDE",
            user.user_id,
            {
                "role": user.role,
                "from_priority": old,
                "to_priority": payload.priority,
                "reason": payload.reason.strip(),
                "reason_code": payload.reason_code,
                "override_id": row.override_id,
                "vital_id": row.vital_id,
                "assessment_id": latest_assessment(db, enc).assessment_id,
            },
        )
        queue_change(db, enc, before, "STAFF_OVERRIDE")
        return details(db, enc)

    @app.post("/api/v1/encounters/{eid}/unresolved", response_model=PatientView)
    def unresolved(eid: str, payload: ReviewRequest, user=Depends(staff), db=Depends(database)):
        enc = encounter(db, eid, payload.version)
        enc.unresolved, enc.unresolved_reason = True, payload.reason.strip()
        enc.version += 1
        audit(
            db,
            enc,
            "DOCTOR_REVIEW_REQUESTED",
            user.user_id,
            {"reason": payload.reason.strip(), "priority_retained": enc.priority},
        )
        return details(db, enc)

    @app.post("/api/v1/encounters/{eid}/resolve", response_model=PatientView)
    def resolve(eid: str, payload: ReviewRequest, user=Depends(staff), db=Depends(database)):
        if user.role != "DOCTOR":
            raise HTTPException(403, "Only a doctor can resolve a doctor-review request")
        enc = encounter(db, eid, payload.version)
        if not enc.unresolved:
            raise HTTPException(409, "This encounter has no unresolved review request")
        enc.unresolved = False
        enc.version += 1
        audit(
            db,
            enc,
            "DOCTOR_REVIEW_RESOLVED",
            user.user_id,
            {"reason": payload.reason.strip(), "priority": enc.priority},
        )
        return details(db, enc)

    @app.post("/api/v1/encounters/{eid}/acknowledge", response_model=PatientView)
    def acknowledge(eid: str, payload: Versioned, user=Depends(staff), db=Depends(database)):
        enc = encounter(db, eid, payload.version)
        enc.acknowledged_assessment = latest_assessment(db, enc).assessment_id
        enc.version += 1
        audit(db, enc, "ACKNOWLEDGE", user.user_id, {"assessment_id": enc.acknowledged_assessment})
        return details(db, enc)

    def audit_rows(db, eid=None):
        query = select(AuditEvent)
        if eid:
            query = query.where(AuditEvent.encounter_id == eid)
        rows = db.scalars(
            query.order_by(AuditEvent.created_at.desc(), AuditEvent.event_id.desc()).limit(300)
        )
        return [
            {
                "id": r.event_id,
                "encounter_id": r.encounter_id,
                "type": r.event_type,
                "actor": r.actor,
                "payload": r.payload,
                "created_at": r.created_at,
            }
            for r in rows
        ]

    @app.get("/api/v1/audit-logs", response_model=list[AuditView])
    def logs(user=Depends(staff), db=Depends(database)):
        return audit_rows(db)

    @app.get("/api/v1/encounters/{eid}/audit", response_model=list[AuditView])
    def patient_logs(eid: str, user=Depends(staff), db=Depends(database)):
        encounter(db, eid)
        return audit_rows(db, eid)

    # Production serves the built React app and API from the same origin.
    web_root = Path(
        os.getenv("FRONTEND_DIST", str(Path(__file__).parents[1] / "frontend/dist"))
    ).resolve()
    if (web_root / "index.html").is_file():
        app.mount("/assets", StaticFiles(directory=web_root / "assets"), name="assets")

        @app.get("/", include_in_schema=False)
        @app.get("/intake", include_in_schema=False)
        def frontend():
            return FileResponse(web_root / "index.html")

        @app.get("/favicon.svg", include_in_schema=False)
        def favicon():
            path = web_root / "favicon.svg"
            if not path.is_file():
                raise HTTPException(404, "Not found")
            return FileResponse(path)

    return app


app = create_app()
