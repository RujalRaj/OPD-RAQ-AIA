# Local architecture

React 19 and Vite 7 serve a bilingual patient intake screen and an authenticated staff workspace. Vite proxies `/api` to FastAPI. The default database is SQLite through SQLAlchemy 2. All dates are stored in UTC ISO format and shown in the browser's local time.

## Request flow

1. The staff-led client collects About you → Vitals → symptoms → Review, or Vitals → Staff assessed emergency. Temperature and Pulse require a numeric reading or High/Low; SpO₂ requires a numeric percentage. The authenticated endpoint rejects missing/unavailable values for these three fields. The intake client creates an idempotency UUID. The backend validates and stores the original input, corrected text, checkbox selections, language, methods, histories and explicit missing states.
2. A transaction allocates one unique token and creates the encounter. Repeated identical submissions return the same receipt; changed data with the same submission ID is rejected.
3. The local agent extracts a narrow set of source-linked phrases and evaluates the complete supplied safety conditions. An assessment snapshot and audit events are written before optional network work.
4. Staff dashboards poll every five seconds. Priority order is Immediate → Soon → Routine, then registration time and encounter ID. Original registration order remains available separately.
5. Staff writes include an encounter version. SQLite serializes write transactions; stale versions return HTTP 409. The client can refresh the patient before retrying.
6. Optional model calls run in FastAPI background tasks with a 25-second SDK timeout and no retry. The result can apply only to its original encounter/assessment version. These tasks are not durable across server restarts; pending work is marked unavailable on startup. Groq and OpenAI use the same three-priority schema, input allowlist and queue guards.

## Tables

| Table | Purpose |
| --- | --- |
| `patients` | Synthetic demographics, registration method, generated demo ID and fixed token |
| `encounters` | One visit, current priority, source input snapshot, version, override and Unresolved state |
| `tokens` | SQLite autoincrement allocation independent of queue position |
| `input_revisions` | Original intake and subsequent staff observation revisions |
| `vitals` | Nullable numerical columns plus per-vital status, units, timestamps and recording identity |
| `symptoms` | Structured interpretations and their evidence references |
| `triage_assessments` | Versioned agent/rule output, missing data, reasons, source conditions and model status |
| `nurse_overrides` | Historical staff overrides, including doctor overrides, reason and vital reference |
| `audit_events` | Append-only event history; SQL triggers reject UPDATE and DELETE |
| `queue_events` | Changed position for the encounter whose assessment/override caused a move |
| `staff_users`, `staff_sessions` | Seeded demo roles, scrypt password hashes and hashed expiring session tokens |

An encounter's original complaint is never changed through the API. Staff symptom additions create revisions and extend the confirmed description. Audit logs are read-only; the API has no deletion endpoint. There is no global persistent patient matching or real ABHA lookup. `DEMO_ABHA` generates a visibly synthetic ID only.

## API

All paths below have prefix `/api/v1`. Interactive request/response schemas are available at `/docs` on the backend.

| Method and path | Access and behaviour |
| --- | --- |
| `GET /health`, `GET /catalog` | Public health and source rules/options |
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` | Server-derived staff identity; HttpOnly SameSite session cookie |
| `POST /encounters` | Legacy synthetic intake retained for demo fixtures/API compatibility; not used by the staff-led UI and cannot request a staff emergency |
| `POST /staff/encounters` | Authenticated registration: mandatory Temperature, SpO₂ and Pulse; optional doctor-review reason and staff emergency decision. Receipt includes token, priority, registration/AI status and urgent/staff-attention flags |
| `POST /registration-status` | Public receipt refresh using the unguessable submission UUID; no lookup by token or clinical-record exposure |
| `GET /dashboard` | Staff: original queue, priority-order IDs and counts |
| `GET /encounters/{id}` | Staff: original/confirmed input, vitals, current priority and latest assessment |
| `POST /encounters/{id}/vitals` | Staff: merge explicit measurement updates and reassess |
| `POST /encounters/{id}/reassess` | Staff: append observations, update tri-state source facts and reassess |
| `POST /encounters/{id}/assessments` | Alias for reassessment |
| `POST /encounters/{id}/override` | Staff: enforce role-specific vital/reason gate, change priority and audit |
| `POST /encounters/{id}/unresolved` | Staff: request doctor review with a reason; retain priority |
| `POST /encounters/{id}/resolve` | Doctor only: resolve an active request with a note |
| `POST /encounters/{id}/acknowledge` | Staff: record acknowledgement of the current source alert |
| `GET /audit-logs`, `GET /encounters/{id}/audit` | Staff: latest 300 global or encounter events |

Writes to an existing encounter require `version`. Override payloads require `priority`, `reason`, and `vitals` for nurse/intern/JR. A measurement is, for example, `{"pr":{"status":"RECORDED","value":82}}`. Missing status has no number: `{"rbs":{"status":"UNABLE_TO_OBTAIN","value":null}}`. Omitted measurements retain their previous value and measurement time.

POSTs with a browser Origin outside the local allowlist are rejected. Staff identity cannot be supplied in an override body. The public registration receipt intentionally omits the internal encounter ID and all queue information. Responses use no-store caching. These are local prototype protections, not a production authentication/security assessment.

See [live AI setup](live-ai-setup.md) for the provider configuration, guards, uncertainty handling and verification boundaries. Live AI may suggest Routine outside the local vocabulary when no source minimum or uncertainty guard blocks it. A policy gap is retained for staff even when the model suggestion applies.

## Qualitative vitals and registration emergency

`HIGH` and `LOW` are valid only for Temperature and Pulse, with `value: null`. They record a staff observation and timestamp, remain missing numeric measurements for source-rule evaluation, and are explicitly explained in AI prompt version `three-priority-v4`. No threshold or normal value is inferred. Optional measurements still accept `NOT_MEASURED` or `UNABLE_TO_OBTAIN`.

`staff_assessed_emergency: true` is accepted only by the authenticated staff intake schema. It allows an empty symptom description/input-method list without fabricating patient words. After the existing source assessment, the same transaction sets Immediate, records a `nurse_overrides` row with reason code `STAFF_ASSESSED_EMERGENCY`, links the vital record and audits the actor and decision. AI is skipped. Reassessment keeps the active staff decision; subsequent staff changes still use the existing reason/new-vital gates. Idempotent retries create no additional decisions or tokens. The public legacy endpoint rejects this flag.

## Bilingual symptom display and deployment

Patient detail displays Original and Translated in Hindi/English side by side (stacked on narrow screens). The opposite language is chosen from the saved intake language. Original checkbox selections use the saved bilingual labels. Prepared demo phrases use a local phrasebook; other free-text and voice reports use the configured model.

`POST /encounters/{id}/translation` starts or reuses an authenticated translation request. `GET /encounters/{id}/translation` reads its status. These display-only operations do not require an encounter version because they do not change the encounter, priority or assessment. The new `symptom_translations` table caches by encounter, original text, source/target language and prompt version. Failures and interrupted jobs are explicit and retryable. Requests and completed/failed jobs are audited. Only the original report and language tags are sent to the translation provider; structured demographics, token, history and vitals are excluded. Content typed into the report is included.

Machine output is schema-validated, checked for the expected writing system and labelled for staff review. These checks do not establish translation accuracy. Translation is never fed into the clinical assessment. The source text and confirmed/staff-updated text remain separate.

Production serves `frontend/dist` from FastAPI. The deployment origin is explicitly allowed with `PUBLIC_BASE_URL` or Render's `RENDER_EXTERNAL_URL`. Public HTTPS uses secure HttpOnly cookies. `scripts.start_server` seeds only an empty database, avoiding queue resets on ordinary restarts. See [deployment](deployment.md).
