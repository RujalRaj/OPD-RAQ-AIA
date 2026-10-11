# OPD RAQ AIA --- Project Handoff for Codex

## Purpose

Build a working prototype named **OPD RAQ AIA (OPD Risk-Aware Queue AI
Agent)** for urgency-aware outpatient department (OPD) queue management.
The system helps clinical staff notice potentially urgent patients
earlier than token order alone. It is a decision-support prototype: it
must not diagnose disease, prescribe treatment, or replace a
nurse/doctor's judgement.

## Current project status

-   Development machine: Ubuntu/Linux.
-   Installed: Python 3.12.3, Git 2.43.0, VS Code 1.141.0.
-   Node.js and npm were not installed at the last check. Install a
    current Node.js LTS via NVM before creating the React/Vite frontend.
-   The user has not confirmed that application code has been created
    yet. Inspect the current repository before making changes; do not
    assume files exist.
-   Suggested local project directory: `~/projects/opd-raq-aia`.
-   Original concept presentation: Aayu 2026, problem statement T05,
    "OPD Flow"; team ID AAYU-J9F7. It specifies React, FastAPI, SQLite,
    an existing model/no retraining, safety rules, nurse review,
    incomplete-vitals handling, and synthetic case testing.

## Main workflow

1.  Patient registration by ABHA ID or manual/demo registration.
2.  Patient reports symptoms using voice, text, or checkboxes.
3.  Capture relevant history and current medications if any.
4.  Nurse/paramedical staff records available vital signs:
    -   Temperature
    -   Pulse rate (PR)
    -   Blood pressure (BP)
    -   SpO2
    -   Respiratory rate (RR)
    -   Random blood sugar (RBS)
5.  NLP may structure free-text symptoms, preserving the original
    text/transcript.
6.  A transparent, clinician-reviewed safety-rule engine suggests one
    priority:
    -   `IMMEDIATE`
    -   `SOON`
    -   `ROUTINE` It returns a short explanation and missing-data flags.
7.  Staff reviews the suggestion, checks vitals, and can override the
    priority with a reason.
8.  Dashboard and queue update.
9.  Audit log records original suggestion, final priority, reason for
    override, staff identity, timestamp, and rule/model version where
    appropriate.

## Safety and clinical constraints

-   Prototype/demo only; use synthetic patient cases. Do not use real
    patient data in development/demo unless explicitly authorised under
    a compliant process.
-   Do not claim clinical validation or clinical accuracy without
    evidence.
-   The system does not diagnose or recommend treatment.
-   Priority is a suggestion for qualified staff, not an autonomous
    clinical decision.
-   Missing vitals are unknown, not normal. Represent them as
    missing/not measured/unable to obtain; never silently substitute
    zero or normal values.
-   Emergency warning signs must trigger a visible escalation prompt for
    immediate staff assessment; do not make a patient wait for AI
    processing.
-   Clinical rules and thresholds must be approved by qualified
    clinicians. Do not invent clinical thresholds.
-   Preserve patient-entered words/transcript separately from structured
    symptom interpretation. Allow correction/confirmation before
    submission.
-   Protect staff functions with authentication/role permissions in any
    realistic deployment. Patients must not see other patients' data.
-   ABHA integration should be simulated unless authorised credentials
    and integration are available. Do not store real ABHA IDs in a demo.

## UI requirements

Create a simple responsive UI with a left navigation bar: - Dashboard -
Register Patient - Queue - Audit Log - Settings

### Dashboard

-   Keep the dashboard simple and readable.
-   Show compact counts for total patients, Immediate, Soon, Routine.
-   In the central/left portion, show **Original Queue** preserving
    registration order.
-   On the right, show three priority columns **side by side**:
    Immediate, Soon, Routine.
-   Original Queue and priority columns are different views of the same
    patient records. Changing priority must not remove a patient from
    the original registration-order queue.
-   Include search/filter and a way to open patient details.
-   Use clear labels, large readable typography, accessible contrast,
    and avoid relying on color alone.

### Patient registration/input page

-   Make it usable by local communities in India, including people with
    low digital literacy.
-   Provide a language selector; initial priority languages: Hindi and
    English. Design so more Indian languages can be added later (e.g.,
    Kannada and others), with translations reviewed by native speakers.
-   On opening, show and attempt to speak a Hindi greeting: "आप अपनी
    परेशानी कैसे बताना चाहते हैं? बोलकर, लिखकर या दिए गए विकल्प चुनकर?" Roman
    Hindi: "Aap apni pareshani kaise batana chahte hain? Bolkar, likhkar
    ya diye gaye vikalp chunkar?"
-   Always show the same prompt as visible text and provide a large
    "Listen to instructions / निर्देश सुनें" replay button. Browser autoplay
    may be blocked, so speech must not be required to use the app.
-   Give three ways to report symptoms:
    1.  Voice/speech-to-text
    2.  Typed text
    3.  Symptom checkboxes
-   Allow patient/reception staff to review and correct speech
    transcript before submitting.
-   Capture patient name/demo ID, age, token, symptoms, relevant
    history, current medicines, and available vitals.
-   Provide a clear review/confirm step before sending the information.
-   Do not require a patient to choose their own clinical priority.
-   Voice features need graceful fallback if browser/device/language
    support is unavailable.

### Staff assessment/detail panel

Show: - Patient token and demographic details appropriate for the demo -
Original symptom input and input method - Structured symptom
interpretation - History and medications (with "not provided"
distinguished from "none") - Each vital and its status (recorded/not
measured/unable to obtain) - Suggested priority and explanation -
Missing-data warnings - Staff review status and override action - Final
priority and audit history

## Technology stack

-   Frontend: React + Vite, CSS or Tailwind CSS.
-   Backend: Python 3.12 + FastAPI + Uvicorn.
-   Database: SQLite + SQLAlchemy for prototype persistence.
-   AI/NLP: begin with structured checkbox input and a transparent rules
    engine. Optional pretrained clinical NLP model only as a later
    enhancement. Bio_ClinicalBERT is not a validated OPD triage model by
    itself; do not claim it is.
-   Browser speech: Web Speech API `speechSynthesis` for TTS where a
    suitable voice exists; speech recognition via
    `SpeechRecognition`/`webkitSpeechRecognition` only where supported.
    Test language availability. Consider an appropriate speech service
    only after reviewing privacy, consent, cost, and language support.
-   Git/GitHub for version control.
-   Local development first; cloud deployment is not required for the
    initial prototype.

## Suggested repository structure

``` text
opd-raq-aia/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   └── services/
│       ├── symptom_processor.py
│       └── triage_rules.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
├── tests/
├── README.md
├── PROJECT_HANDOFF.md
└── .gitignore
```

## Proposed API endpoints

-   `POST /patients` --- register patient
-   `GET /patients/{id}` --- get patient details
-   `POST /patients/{id}/vitals` --- record available vitals
-   `POST /patients/{id}/assessments` --- run assessment pipeline
-   `GET /queue` --- get patients, original registration order, and
    priority fields
-   `PATCH /queue/{id}/priority` --- authorised staff override with
    reason
-   `GET /audit-logs` --- retrieve audit events
-   `GET /health` --- health check

Use request/response schemas and validation. Configure CORS for the
local Vite origin. Never expose secrets in the repository.

## Suggested implementation sequence

1.  Inspect the repository and existing files; preserve any working
    code.
2.  Check/install Node.js LTS and npm, Python venv support, and
    dependencies.
3.  Create a minimal FastAPI app and verify `/health` and `/docs`.
4.  Create React/Vite app and build navigation + dashboard using
    synthetic data.
5.  Build patient input page with Hindi/English visible prompts, replay
    TTS, checkbox/text entry, and graceful voice-input fallback.
6.  Add API integration and persist patient registration.
7.  Implement transparent configurable rules with clinician-reviewed
    configuration; keep NLP optional.
8.  Connect patient details to the staff view.
9.  Implement original registration-order queue alongside side-by-side
    priority columns.
10. Add authorised nurse override and audit log.
11. Add automated tests for input validation, missing vitals, urgent
    warning cases, queue sorting/view consistency, override auditing,
    and multilingual fallback.
12. Document local run instructions and demo scenarios in README.

## Acceptance criteria

-   Patient can submit symptoms through checkboxes or text; voice is
    optional and gracefully falls back if unsupported.
-   Hindi greeting is displayed and best-effort spoken, with a replay
    button.
-   Original input and structured interpretation are both available to
    staff.
-   Missing vitals are explicitly visible as missing/unknown.
-   Dashboard shows Original Queue in registration order and three
    priority columns side by side.
-   Staff can review and override a suggestion with a reason.
-   Audit log preserves old and new priority, reason, staff identity and
    timestamp.
-   Application is labelled demo/synthetic and does not claim diagnosis
    or clinical validation.
-   All core flows work locally and are documented.

## Instructions to Codex

Act as the implementation engineer. First inspect the repository and
report what already exists. Then implement incrementally, prioritising a
working end-to-end local prototype. Do not merely return a plan:
create/edit the code, run available tests, fix errors, and update
README. Ask before adding paid APIs or services. Keep clinical policy
configurable and clearly marked as requiring clinician approval. Do not
fabricate clinical thresholds or claim the app is medically validated.
At the end, summarise files changed, exact run commands, tests
performed, and any limitations.
