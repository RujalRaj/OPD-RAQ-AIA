# Verification record

Latest registration checks: 13 October 2026, Python 3.12.14, Node 24.21.0 and Chrome on macOS. Source-case labels and source documents were not changed. Historical checks are retained below with their dates.

| Check | Result |
| --- | --- |
| Backend/API/rule tests | 112 passed |
| Frontend component/speech tests | 9 passed; obsolete browser-TTS tests replaced with local neural playback tests |
| Playwright browser workflows | All 13 scenarios passed across the regression and affected-workflow reruns (13 October 2026) |
| Automated accessibility | No WCAG 2 A/AA or 2.1 AA violations found on tested welcome, details, ABHA, input-method, symptom-entry, login, dashboard and patient detail views |
| Mobile layout | 390px viewport has no page-level horizontal overflow; keyboard navigation tested |
| Production frontend | TypeScript and Vite build passed |
| Code formatting/lint | Prettier and Ruff passed |
| Node dependency audit | 0 reported vulnerabilities at verification time |
| Persistence | Backend restart retained all 30 seeded source cases and working staff access |
| Seed idempotence | Repeat seed created 0 additional cases |
| Original files | Git comparison reports both attached source documents unchanged |
| Supplied synthetic expectations | 25/30 priorities agree; five discrepancies explicitly retained |

Backend tests emit one upstream Starlette/httpx deprecation warning. No test fails because of it. No live paid OpenAI request was made; model behaviour was mocked. The three new Hindi/English instruction clips were checked by independent local transcription and full media playback, as detailed below. Subjective voice comfort, physical speaker output and real microphone recognition remain manual checks on the presentation device. Automated accessibility checks are not full accessibility certification. Clinical validity was not tested or claimed.

## Demo walkthrough

1. Open the local staff workspace and choose Nurse. Use the demo password from the README. The seeded original queue and three priority lanes share the same token identifiers.
2. Open the patient form. Choose Hindi or English on the welcome page. Enter a made-up name and age in manual registration and press Next. Listen to the method prompt, choose **Through checkboxes → Severe symptoms**, and select **New chest pain, pressure or tightness**. ABHA ID demonstrates the pending-integration message and manual fallback only. For the new short-list demonstration, use the eight quick choices or More problems; ordinary complaint labels alone use the existing demo fallback when no source rule is established.
3. Review the text and optionally correct it. Register. The receipt shows one fixed token and an immediate staff-assessment message.
4. Return to the staff workspace and search for the token. Open the patient. Compare original and confirmed descriptions; missing vital values remain explicit.
5. Enter an override reason alone: the nurse override remains disabled. Enter one relevant vital such as a demo pulse measurement: the override becomes available. Choose a priority and apply. The active queue changes while the token, agent suggestion and original source alert remain.
6. Mark the encounter **Unresolved** with a reason. Sign in as Doctor (or use a separate browser profile). Filter Unresolved, review the patient and resolve the request with a note. A doctor can also change priority using the override form.
7. Inspect the patient's audit history for the source assessment, measurements, override and doctor review. A stale staff write is rejected with a refresh message rather than overwriting newer data.

These observations use invented patients and are demonstrations of software behaviour only.

## Historical Hindi audio repair — 12 October 2026

Superseded by the neural clips and guided flow on 13 October; retained as the repair history.

The earlier voice-selection fix did not resolve the reported “question mark question mark” output. The fixed Hindi greeting now uses a bundled MP3 instead of browser Hindi synthesis. English retains browser TTS. Text and language controls remain available if media playback fails.

- **Content check:** The exact shipped MP3 was transcribed locally using faster-whisper 1.2.1, the multilingual `medium` model, CPU int8, and PyAV 16.1.0. No language, expected text, or initial prompt was supplied to the recognizer. It detected Hindi and recovered both sentences and all three input choices. The raw transcript has spelling variants (`दिये गय` for `दिए गए`); this is automated content verification, not a human pronunciation review. The raw result, expected text, duration (7.056 seconds), generation source and SHA-256 are saved in [hindi-audio-verification.json](hindi-audio-verification.json).
- **Actual media test:** Chrome loads the real MP3 with `speechSynthesis` disabled. The test compares downloaded bytes against the transcribed file's SHA-256, checks the full displayed greeting, waits through playback to `ended`, and checks duration, final playback position, volume and mute state. Media playback and its events are not mocked. Replay and Stop audio are also exercised.
- **Failure and cancellation:** Tests cover missing/broken media, blocked autoplay, startup timeout, replay, language changes, and leaving the page. Failed Hindi playback never falls back to the engine that pronounced punctuation. Existing voice-selection unit tests cover the generic browser speech utility separately; they do not establish audible correctness.
- **In-app browser:** Restarted the preview, reloaded `/intake`, tapped **निर्देश सुनें**, and observed playback finish with **निर्देश पूरे हुए**. This verifies the deployed local flow as well as the separate Chrome tests. No microphone or system audio was recorded.
- **Regression checks:** 15 frontend tests, 5 browser workflows, the production build and Prettier all passed. Browser workflows also retain the accessibility checks and nurse/doctor override coverage. Backend code and clinical rules did not change in this repair; their 74-test result above is from the earlier full verification.

The pre-generated audio is part of the application: users do not install gTTS, Whisper, model weights, or any new service to play it. If the displayed Hindi greeting is changed, regenerate and recheck the clip and update the verification record together. Browser tests deliberately reject a changed text or audio hash without that updated record.

## Login-page update — 13 October 2026

Applied the approved headline, updated brand and supporting copy, enlarged the landing-page brand name, and made patient registration a prominent bordered panel with a filled button. The new **Fill credentials** action populates the existing shared demo password while retaining the selected staff role. It does not submit the login form. A status message confirms the fill.

Validation: 15 frontend tests, 6 browser tests, the TypeScript/Vite production build, and Prettier passed. The added browser test verifies keyboard activation, no automatic sign-in, all four staff roles signing in with the filled password, logout, accessible registration navigation, no page-level overflow at 390px, and automated WCAG 2 A/AA and 2.1 AA checks on the login page. Desktop and mobile screenshots were visually reviewed. No clinical rules or backend behaviour changed.


## Guided registration and neural audio — 13 October 2026

Registration now has distinct language, personal-details, input-method, symptom-entry and review screens. Language selection uses two large cards. The bilingual opening says “अपनी भाषा चुनें” then “Choose your preferred language”; the method prompt and subsequent form use the chosen language. Simple fade transitions honor reduced-motion preferences. Complete prompt text remains available to screen readers while visible words follow actual audio timestamps. Blocked audio reveals text and a replay hint. Patients can stop playback and disable automatic prompts during their registration.

Registration type comes before demographics. ABHA ID fades the manual fields out and displays an ID field plus an explicit development notice. No ABDM lookup is simulated: the placeholder ID never enters an API payload, database or browser storage. A manual-registration action restores previously entered demographics. Integration still requires authorized sandbox access and appropriate patient authentication/consent.

Fixed instructions use SwaraNeural Hindi and NeerjaNeural Indian English, generated using edge-tts 7.2.7 at -10% rate and -2Hz pitch. Runtime volume is 0.8. Three bundled assets total approximately 284 KB. This replaces both the old Hindi gTTS recording and the English OS-voice path. The optional generation script is not required to run the prototype.

Validation:

- **Audio contents:** Independently transcribed all three shipped files with local faster-whisper medium, no prompt or forced language. The bilingual clip recovered both language-selection sentences, and each method clip recovered the complete prompt and all three choices. Raw Hindi transcription contains spelling variants (“भाशा”, “चाते”), retained transparently in [instruction-audio-verification.json](instruction-audio-verification.json). This is an automated content check, not a human listening review.
- **Actual playback:** Chrome loaded each real local MP3 with browser speech synthesis unavailable. Tests linked bytes to the independent verification hashes, checked reduced volume, observed progressive words and full playback through `ended`. The visible local in-app browser also reached the completed welcome status after Listen. No system speaker recording was made.
- **Frontend:** All 9 unit/component tests passed. These cover media timing, cancellation, blocked playback, load failures, unsupported audio, the separated language/details flow, ABHA fallback and explicit missing vital states.
- **Browser:** All 11 unique scenarios passed across the full regression run and targeted reruns. Coverage includes Hindi-only screens, the three method paths, final STT events before review, original speech alongside edited/confirmed descriptions, saved checkbox choices, ABHA field hiding and non-transmission, reduced-motion text, quiet mode, focus, keyboard entry, 390px layout and automated accessibility. STT was mocked for deterministic transcript tests; live microphone quality is not established by these tests.
- **Regression:** 74 backend tests passed; production TypeScript/Vite build, Prettier and Ruff passed. The full nurse override → Unresolved → doctor resolution browser workflow and all four demo-role logins passed. No backend code, source rules, original documents or presentation database records were changed.
- **Visual review:** Desktop language, personal-details and Hindi method views, plus mobile details/method views and ABHA, were reviewed. A test initially sampled colors during the fade; it now waits for final opacity before checking contrast. Browser-launch restrictions were handled by running Chrome with the required local execution permission.

The old audio evidence above records the earlier implementation; the current assets and hashes are in `instruction-audio-verification.json` and `frontend/src/assets/voice/manifest.json`.

## Short symptom selection — 13 October 2026

Implemented 31 user-approved new symptom labels, eight quick choices, and short More problems groups: other common, chest/breathing, urinary, digestive/liver and the existing routine follow-up. The five existing severe source-linked options have a separate shortcut. Help directs patients to nearby staff without requiring submission; it explicitly does not claim an alert was sent. Four compound legacy options asserting stability/lack of shock are hidden from new intake while their IDs, exact meanings and staff controls remain supported.

- **Backend: 109 tests passed.** Added coverage for all 31 complaints, unchanged clinical-rule meanings, explicit missing vitals, no inferred negative findings, routine-visit contradictions, immutable bilingual label capture, retry idempotency after a catalogue change, old urgent-condition compatibility, and meaningful labels sent to the mocked optional AI. All original source-rule and workbook discrepancy tests still pass.
- **Frontend: 9 existing component/speech tests passed.** The production TypeScript/Vite build, Prettier and Ruff checks passed. No dependencies were added.
- **Browser: all 13 unique scenarios passed across the full regression and targeted reruns.** New tests register selected complaints through the actual API, verify their labels on the staff dashboard and detail view, and check that the policy-gap explanation remains visible. They also test saved choices across groups/review, removal, maximum eight visible choices, Hindi-only mobile options, staff-help without a POST, severe-symptom access and all six new digestive choices being available. Existing tests retain voice transcript preservation, fixed-token nurse override, doctor escalation/resolution and full local prompt playback.
- **Accessibility and visual review:** Automated WCAG A/AA checks passed on the new quick, grouped and urinary views, with no page-level horizontal overflow at 390px. A staff-note contrast issue found during testing was fixed. Two new test selectors were corrected to wait for the review transition and target the visible agent heading instead of a hidden audit payload. Desktop and Hindi mobile screenshots were inspected; excess whitespace above the short choices was reduced.
- **Running preview:** The existing local servers were restarted with the revised catalogue. No presentation database reset or reseeding was performed. Original attached documents remain unchanged.

These checks establish software behaviour only. Ordinary labels do not establish onset/severity or expand clinical coverage; the existing labelled Soon fallback remains when no supplied rule is met. No local-prevalence, seasonal-priority or clinical-validation claim is made. The approved list and pending system categories are recorded in `symptom-catalogue.md`.

## Joint and low-back vocabulary — 13 October 2026

The user replaced the seven proposed musculoskeletal options with three: small-joint pain with early-morning stiffness; large-joint pain with knee, hip, shoulder, elbow, ankle and wrist examples; and low back pain. All three are available in Hindi and English under More problems → Joints & lower back. The catalogue now contains 34 approved complaint labels; the first eight quick choices are unchanged. Its version advances to `opd-complaints-v2`; existing captured labels and encounter versions remain untouched.

Validation: all 112 backend tests passed, including the existing parameterized clinical-rule separation and routine-visit contradiction checks for the three additions. Both affected browser workflows passed, covering English registration through the real API to visible staff records, Hindi review, full label wrapping at 390px, saved selections, and automated WCAG A/AA checks. Desktop and Hindi mobile screenshots were visually inspected. Ruff and the changed browser test's formatting passed. Frontend application code, clinical rules, dependencies, attached source documents and existing database records were unchanged. The running backend and downloadable VS Code source package were refreshed.

## Three-priority live-provider integration — 13 October 2026

Implemented Groq (`openai/gpt-oss-120b`) and OpenAI (`gpt-4o-mini`) adapters with the same strict output schema, source safety gate, staff overrides and minimal clinical payload. Original patient text, fixed tokens and source documents remain unchanged. The setup guide documents the deliberate change allowing model-suggested Routine outside the local vocabulary when no guard blocks it. This is not clinical validation.

- **139 backend tests passed.** New coverage includes all three priorities for both providers, source minimums, uncertain Routine rejection, explicit critical missing-vital flags, queue order, staff override preservation, original input, delayed receipt updates and privacy, duplicate-request suppression, missing keys, stale responses, interrupted jobs, private key saving, and a failed reassessment retaining the earlier more urgent AI priority. Both providers' real SDK request serialization is exercised through mocked HTTP transports; incomplete/refused outputs are rejected. Exception details do not enter patient responses or audit logs.
- **9 frontend tests passed**, and the TypeScript/Vite production build and Ruff passed. The existing Starlette/httpx deprecation warning remains upstream and does not fail a test.
- **All 16 unique browser scenarios passed across the full regression and targeted rerun.** The initial full run passed 15/16; one existing workflow locator matched both the new AI status and staff action status. Accessible names were added, the locator was corrected, and all six AI/workflow scenarios passed on rerun, including nurse override → Unresolved → doctor resolution, keyboard fallback and dashboard accessibility. The new English/Hindi delayed-response tests confirm a later Immediate alert reaches the receipt without changing its token. AI responses in browser tests are simulated.
- **Visual review:** Inspected the Hindi receipt and staff AI detail screenshots; alerts, provider/model status, token, original input and override controls remain readable. Automated accessibility checks are regression checks, not accessibility certification.
- **Initial verification stage:** No hosted inference request was made at this stage because a key had not been configured. The later live verification and resulting repair are recorded below. Passing mocked tests alone does not establish live authentication or model clinical accuracy.

Current setup instructions are in [live-ai-setup.md](live-ai-setup.md); they supersede the earlier mentor PDF's disabled/two-priority integration description. No new source archive or PDF was generated for this update.

## Live Groq evidence-label repair and verification — 13 October 2026

The user's first connection check failed with the broad `INVALID_RESPONSE_OR_CONFIGURATION` message. A synthetic reproduction confirmed that Groq accepted the key and returned completed JSON, but one evidence reference did not match the backend's accepted top-level fields. The request schema had allowed arbitrary strings even though downstream validation rejected unknown references.

The response schema now enumerates the seven permitted evidence keys for both providers, and prompt version `three-priority-v3` explicitly distinguishes those keys from symptom codes, rule IDs and nested paths. Backend validation remains strict. Response failures now have controlled diagnostic codes identifying invalid evidence, schema, explanation length, missing-information fields, incomplete output and refusal, without printing provider bodies, patient input or credentials.

- **142 backend tests passed**, including regression checks for invalid symptom-code, nested-vital and rule-ID references and safe diagnostic output. Both provider request schemas constrain evidence IDs. Ruff passed. Frontend code did not change in this repair, so its previous build/browser results remain applicable; those tests were not repeated.
- **Live English check:** The exact `scripts.check_ai` command returned `LIVE RESPONSE VERIFIED: ROUTINE; staff-review flag: False` using Groq `openai/gpt-oss-120b`.
- **Live Hindi workflow:** One invented Hindi cough report was registered through the FastAPI application in an isolated temporary SQLite database with an actual Groq request. It returned `COMPLETE` with an applied Routine suggestion. Verified original Hindi text, all seven unknown vitals, fixed token, receipt completion, subsequent nurse override with one recorded vital and reason, and AI/override audit events. The observed priority is recorded as model output, not as a clinically approved expected label.
- **Running app:** Identified and restarted the existing backend for this project. Its health endpoint now reports `groq`, `openai/gpt-oss-120b`, key configured and valid configuration. Health alone is not the connection proof; the two successful hosted requests above provide that evidence. Existing demonstration patients were not reset, reseeded or reprocessed.

Three hosted requests were made for this repair: one reproduction of the validation failure and two successful checks after the fix. All used synthetic inputs. No API key was printed, placed in a command argument, or included in documentation. The original clinical matrix and staff override requirements were unchanged. Live OpenAI, clinical accuracy and broader Hindi/Roman-Hindi performance were not validated by these checks.

## Quick vitals entry and registration reminders — 13 October 2026

Added a Hindi/English reminder and staff-only vitals shortcut to the registration receipt. A receipt token is resolved against the authenticated dashboard only after sign-in, without adding private encounter IDs or measurements to public receipts. Added quick entry and missing/unavailable reminders to staff priority cards and queue rows. The existing vitals endpoint records partial updates, audits the actor, reassesses with the existing safety gates and retains staff overrides. Saved readings remain reference information; the new-entry draft starts empty. Conflicting writes keep the draft and offer an explicit refresh before retry. The dialog supports Escape, keyboard focus restoration, and permanently visible Save/Cancel controls while measurements scroll.

- **142 backend tests passed**; the existing upstream Starlette/httpx deprecation warning remains. Backend code, source rules and override requirements were unchanged.
- **9 frontend unit/component tests passed**; TypeScript/Vite production build and formatting checks passed.
- **4 new browser scenarios passed** after the final layout change: English anonymous registration through staff sign-in, Hindi registration with signed-in staff, partial saves and explicit unavailable readings, retained urgent alerts and original words/tokens, audit attribution, continued requirement for a new vital when overriding, stale-write rejection/draft recovery, preserved staff overrides, clearing missing reminders/filtering when all fields are recorded, queue shortcut and cancellation without writes.
- **6 existing browser scenarios passed** across the earlier targeted run: delayed AI Immediate receipts in both languages, pending staff assessment updates, nurse-to-doctor workflow, dashboard accessibility and fixed tokens, and unsupported microphone/keyboard fallback. The dashboard accessibility scenario was rerun after the keyboard-focus fix. New dialog accessibility checks found no violations in the tested WCAG A/AA rules.
- Desktop/mobile dialog and Hindi receipt screenshots were visually reviewed. The new mobile form was checked for visible save controls without needing to scroll through every field. Browser tests used ports 8011/5174 and a separate synthetic test database with hosted AI disabled. No live patient reassessment, provider call, credential change or clinical rule change was made for this feature.

Relevant commands: `.venv/bin/python -m pytest -q`; `npm run test -- --run` and `npm run build` from `frontend`; `CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e -- e2e/vitals.spec.ts` for the new browser scenarios.

## Pre-token vitals step and visible doctor review — 13 October 2026

This revision supersedes the receipt handoff described above. The registration flow now ends **review → available vitals → token**. No registration request is sent from the review screen. Staff may sign in without leaving the intake, record partial measurements and optionally request doctor review. Anonymous registration may continue without measurements. Unmeasured values remain unknown; all fields are optional. The receipt no longer offers the old vitals-entry box.

The new authenticated `POST /api/v1/staff/encounters` creates the encounter with available vitals and optional doctor-review reason in the same database transaction. The server derives staff identity from the session. Initial assessment sees the entered measurements. Review requests are audited as `DOCTOR_REVIEW_REQUESTED` and appear under Unresolved; they do not replace priority. Repeated submissions recover the existing token without duplicate vitals, review events, or reopening a resolved case. On an interrupted response the browser freezes the submitted draft and retries the same request ID and payload; rejected authentication/validation allows correction.

Patient cards now expose **Request doctor review** / **Open doctor review**. These open and focus the review-reason field in patient details. A detail-page shortcut also makes review visible near the assessment header, including when AI is unavailable or needs staff attention. A reason is required; a measurement is not. Only doctors can resolve review. Existing source safety conditions, AI guards, urgent alerts, fixed tokens and nurse/intern/JR override requirements are unchanged.

Verification:

- **149 backend tests passed**, including seven new cases covering staff authentication and attribution for all four roles, initial measurement use with the existing source-rule context, explicit unknown/unavailable states, reason validation, idempotency and doctor-only resolution. The existing upstream Starlette/httpx deprecation warning remains.
- **9 frontend unit tests passed**; TypeScript/Vite production build, Ruff and formatting checks passed.
- **23 unique browser scenarios passed**: the full 22-scenario suite passed, followed by three targeted final checks (both bilingual vitals flows plus a new interrupted-response recovery scenario). Coverage includes no token/request before vitals, inline sign-in without losing input, back-navigation preserving draft readings, registration and dashboard doctor review, no-measurement continuation, unchanged override requirements, quick-vitals conflict handling, and the existing audio/intake/AI-polling workflows.
- Desktop English and mobile English/Hindi screenshots were visually checked. Automated WCAG A/AA checks found no violations on the tested vitals screens, and mobile horizontal overflow checks passed. These checks do not establish clinical or accessibility certification.
- Browser tests used isolated ports 8011/5174 with a separate synthetic database and hosted AI disabled. No real provider requests were made for this revision. The actual port-8000 backend was restarted with its existing database; direct and Vite-proxied health checks report Groq / `openai/gpt-oss-120b` configured, and API documentation confirms the new staff registration endpoint. Existing demonstration records were not reset or reassessed.

Commands: `.venv/bin/python -m pytest -q` from the project root; `npm run test -- --run`, `npm run build`, and `CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e` from `frontend`. The final targeted browser run used `-- e2e/vitals.spec.ts --grep 'vitals before token|interrupted registration'`.

## Eight-section checkbox replacement — 13 October 2026

Replaced the patient-facing quick-choice/More problems list with the user’s 63 supplied reports under eight approved expandable section checkboxes. Hindi text was compared against every bullet in the supplied attachment and matched verbatim; English translations are stored alongside it. Opening a section is navigation only, closing it retains chosen symptoms, and only explicitly chosen reports are submitted. Sensitive questions retain the private-space note. The nearby-staff help option remains available without registration. Empty input cannot proceed unless a symptom or text/voice description exists.

Registration snapshots now preserve section context as well as bilingual report labels, including pregnancy/child context without changing demographic fields. All 44 legacy IDs/labels remain hidden from new intake and available to historic records. The existing 40-rule matrix is unchanged. Five direct equivalents map to its existing conditions (reports 01/03/09/13/34 to rules 3/11/15/7/21); compound reports do not infer missing clinical qualifiers. These mappings and their limits are documented in `docs/symptom-catalogue.md`. No blanket clinical priority rule or clinical-validation claim was added.

- **157 backend tests passed**, including new catalogue, complete source-condition, all-63 submission, preserved unknown values, immutable-label and model-section-context checks. Tests use synthetic data and simulated AI. The existing upstream Starlette/httpx deprecation warning remains.
- **9 frontend unit tests passed**; final TypeScript/Vite build, Ruff and formatting checks passed.
- **8 affected browser scenarios passed** after the final layout/empty-input fix: bilingual sections, all 63 Hindi labels and English exclusion, keyboard expansion, no group IDs submitted, selection retention/removal, private guidance, no-submit help, staff original-report display and source alert, intake method switching and original words, ABHA fallback, nurse override/doctor review/resolution, and dashboard accessibility. The initial run caught the still-enabled empty review button; it was fixed and the eight scenarios rerun successfully.
- Desktop English and mobile Hindi screenshots were visually reviewed after removing inherited section spacing. Automated accessibility and mobile overflow checks passed for the tested views; these are not clinical or accessibility certification.
- Test servers used isolated ports 8011/5174 and the separate synthetic test database with hosted AI disabled. The user’s VS Code servers were not stopped/restarted. Read-only checks on port 8000 and through the port-5173 proxy both reported `opd-reports-v3`, eight sections and 63 visible options. Existing demonstration patients were not reset or reassessed, and no real provider call was made.

Commands: `.venv/bin/python -m pytest -q` in the project root; `npm run test -- --run`, `npm run build`, and `CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e -- e2e/symptoms.spec.ts e2e/intake.spec.ts e2e/workflow.spec.ts` in `frontend`.

## Staff-led registration and emergency shortcut — 13 October 2026

This revision supersedes the earlier optional-vitals registration and symptoms-page help shortcut. The current sequence is About you → Vitals → symptoms → Review → token, or About you → Vitals → Staff assessed emergency → token. Staff authentication is required by the current registration UI. Temperature, SpO₂ and Pulse appear first. Temperature/Pulse accept numeric readings or High/Low; SpO₂ requires a numeric percentage. Missing/Not obtained choices are excluded from these three and rejected by the authenticated backend registration schema. Other vitals remain optional.

High/Low are explicit qualitative observations with null numeric values and staff/time attribution. Source numeric rules still treat their numerical readings as unknown; AI prompt v4 explicitly prohibits inventing values or inferring numeric thresholds from these observations. High/Low does not automatically assign Immediate. The explicit staff emergency action creates a protected Immediate decision with a linked vital record and audit entry and skips AI/symptom collection. Existing source rules, nurse/intern/JR override requirements and doctor-review permissions remain intact. The legacy public demo intake endpoint remains for existing fixtures/API compatibility and cannot request a staff emergency.

The receipt displays Immediate in red and Soon/Routine in green, with neutral pending status for non-Immediate provisional AI results. The checkbox review places selected reports before the editable description. Old skip-form messages are removed. Interrupted submissions recover the same token; expired sign-in returns to vitals and then restores Review corrections. Staff reading timestamps were darkened after an automated contrast check found them too faint.

Validation:

- 185 backend tests passed, including required-vital rejection, qualitative value validation, all four staff roles, emergency authentication, audit identity/vital linkage, unknown numeric data, no fabricated symptoms, idempotent retries, unchanged source rules, and staff-priority preservation during reassessment.
- 9 frontend unit tests passed; TypeScript/Vite production build, Ruff and Prettier checks passed.
- 28 unique browser scenarios passed across the full-suite run and final targeted run. The initial full run passed 25/26 and identified the timestamp contrast issue. After that fix, all 15 targeted vitals/workflow scenarios passed, including the previously failing check and two added scenarios (Routine receipt colour and expired-session correction retention). Bilingual flows, qualitative emergency entry, mandatory dropdown options, source/AI Immediate receipts, Soon/Routine colours, selected-symptom order, stored originals, existing overrides, Unresolved requests/resolution, retry deduplication and audio playback regressions are covered.
- English/Hindi mobile vitals and the Hindi Immediate receipt screenshots were visually inspected. Tested screens passed automated WCAG A/AA checks and mobile overflow checks; this is not accessibility certification or clinical validation.
- Browser tests used isolated ports 8011/5174, a separate synthetic database and disabled hosted AI. No live provider calls, live patient writes, source workbook changes or changes to the user's VS Code servers were made.

Commands: `.venv/bin/python -m pytest -q` and `.venv/bin/python -m ruff check backend tests` from the project root; `npm run test -- --run`, `npm run build`, `npm run format:check`, and `CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:e2e` from `frontend`. Final targeted browser run: `npm run test:e2e -- e2e/workflow.spec.ts e2e/vitals.spec.ts` with the same `CHROME_PATH` setting.

## Curated queue and priority controls — 13 October 2026

Activated 40 generated synthetic cases with a checked baseline of 3 Immediate, 7 Soon and 30 Routine. Created a private SQLite backup before archiving 42 earlier active records, preserving their histories and audit trails. The labelled practice case is Demo Anita Verma, local token 107: a scripted erroneous chest-pain entry with a staff clarification role-play. It is not presented as a measured Groq mistake. Existing source rules and routine-demo logic derive the baseline; seed assessments explicitly say “Demo seed · local assessment.” No hosted-model calls were used to manufacture the requested distribution. New registrations and reassessments still use the existing configured provider.

Added a repeatable `backend.seed_hackathon --activate` command, JSON fixture, documented setup and matching VS Code task. Re-running preserves existing staff overrides. Added a default-Immediate dashboard with a labelled priority selector while retaining the original queue and global counts. The override panel now owns separate measurement rows, type/value dropdowns, a custom numeric option, Add/Remove measurement controls, explicit incomplete-entry feedback and a separate reason box. Backend reason/new-vital requirements remain unchanged; submitted measurements and overrides remain audited.

Validation: 186 backend tests, 9 frontend unit tests, TypeScript/Vite build, Ruff and Prettier passed. Twenty affected browser scenarios passed across the targeted suite and final rerun. The first run passed 19/20; its remaining test needed to select Routine in the doctor's new default-Immediate dashboard, and passed after that test update. New browser coverage checks priority switching, one/multiple/custom measurement entry, reason and incomplete-reading gates, backend persistence, retained original report/source alerts, stable tokens, audit identity and movement to the Routine view. Tested layouts passed automated WCAG A/AA and mobile-overflow checks.

The running port-5173 app was independently checked with a fresh browser session: counts were exactly 3/7/30, and token 107 was still Immediate. Captured `docs/assets/dashboard-demo.png` and `docs/assets/override-controls.png`, and visually inspected both. Filling the screenshot's override draft did not submit a priority change. The user's servers were left running. Isolated test servers used ports 8011/5174, a separate synthetic database and disabled hosted AI.

## Bilingual patient reports and deployment package — 13 October 2026

Added Original and Translated in Hindi/English boxes to staff patient detail. Original text and checkbox selections remain unchanged. Opposite-language checkbox labels come from the saved catalog; free-text translations use a separate cache and background job. Prepared demo phrases are labelled separately. Translation failure is explicit and retryable, with no effect on priority, token, version, source assessment or staff override.

Validation: 193 backend tests passed, followed by two new deployment tests (195 tests total); 9 frontend unit tests and the TypeScript/Vite build passed. All 7 affected browser scenarios passed, covering both language directions, selected symptoms, mobile overflow, automated accessibility, priority selection, nurse override and doctor review/resolution. Ruff and Prettier checks passed. The desktop bilingual screenshot was visually inspected. Two additional startup checks confirm that production serves the frontend without exposing source files and seeds only an empty database while preserving existing changes. Test provider responses are simulated unless explicitly recorded below.

Added a Docker image, Render configuration, secure-cookie setting and explicit deployment origin handling. Updated the README, architecture, provider setup and deployment instructions. Private credentials and SQLite files are excluded from both Git and the Docker build.

Two real Groq translation calls also completed using invented headache reports, one in each direction. Both retained the stated onset and the explicit absence of vomiting. This is a small connectivity/content check, not a translation-quality or clinical evaluation. No live patient records or queue priorities were changed by the check.

### Public deployment verified

Deployed the Docker application to https://opd-raq-aia.onrender.com on Render's free instance. Public health, HTTPS secure-cookie login, staff dashboard, the /intake route and cached translation endpoints passed. The hosted queue was 3 Immediate, 7 Soon and 30 Routine. A live Groq reassessment of synthetic token 11 completed as Routine, preserving those counts. Token 3 (Demo Anita Verma) remains Immediate for the override demonstration. Original text, token, priority and encounter version were unchanged by its translation request.

The public website was checked in a fresh automated browser session, including doctor login, the three Immediate cards and the two symptom-language boxes. Submission screenshots are saved in docs/assets/live-dashboard.png and docs/assets/live-bilingual-report.png. The hosted runtime uses application commit dba2411; the subsequent submission commit updates documentation and screenshots only.

Render's free filesystem is ephemeral. Restarts/redeployments may start a new seeded queue and remove subsequent demo changes; the documentation states this limitation. The local SQLite database and existing VS Code servers were not reset or stopped.
