# Live AI setup for the synthetic OPD demo

This implementation supports Groq (`openai/gpt-oss-120b`) and OpenAI (`gpt-4o-mini`). Groq is the recommended free-account setup for this hackathon. The model name begins with `openai/` because OpenAI released the open-weight model; inference goes to Groq and uses a **Groq API key**, not an OpenAI API key. The OpenAI Python SDK is just the compatible client library. No new dependency or model download is needed.

Neither model is clinically validated for this application. Use invented patients only. Hosted AI needs internet. The local form, instructions, database and source-rule fallback remain available without it.

## Create the free Groq key

1. Visit [Groq Console API Keys](https://console.groq.com/keys) in a normal Chrome or Safari window and sign in or create an account. Google may block sign-in inside an embedded app browser; if that happens, paste this URL directly into your normal browser's address bar.
2. Stay on the **Free Plan**; do not upgrade to Developer for this free demo setup.
3. Choose **Create API Key**, give it a name such as `OPD Hackathon`, and copy the generated key.
4. In VS Code, open the existing `opd-raq-aia` folder and choose **Terminal → New Terminal**.
5. Run:

```sh
cd /Users/rujalrajsingh/Documents/Codex/opd-raq-aia
.venv/bin/python -m scripts.setup_ai --provider groq
```

6. Paste the key at the hidden `API key:` prompt, then press Enter. Nothing appears while typing or pasting; that is intentional. Do not put the key in a chat, screenshot, command argument or frontend file.
7. The script preserves other environment settings, writes `.env` atomically with owner-only file permissions, and sets `AI_PROVIDER=groq`. `.env` and temporary setup files are ignored by Git. Saving is not a connection test.
8. Run one live check with a fixed synthetic example:

```sh
.venv/bin/python -m scripts.check_ai
```

Success prints `LIVE RESPONSE VERIFIED`, the returned priority and review flag. This confirms connectivity and schema validation, not the clinical correctness of that priority. The check does not create database records. Do not repeatedly run it: every call consumes provider quota.

Equivalent VS Code tasks: **OPD: Set up AI key (private prompt)** and **OPD: Check live AI connection**.

## Restart and demonstrate

Changes to `.env` require a backend restart. A frontend page refresh alone does not load the new key. Stop the existing backend with Ctrl+C in its terminal; do not launch a second backend on port 8000. Start it again:

```sh
cd /Users/rujalrajsingh/Documents/Codex/opd-raq-aia
.venv/bin/python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Keep the frontend running, or start it in another terminal:

```sh
cd /Users/rujalrajsingh/Documents/Codex/opd-raq-aia/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Open <http://127.0.0.1:5173/> for staff and <http://127.0.0.1:5173/intake> for patient registration. Settings reports the provider/model and whether a key is configured. A configured key is not proof of successful authentication; inspect the individual assessment or run the live check.

Register a **new synthetic patient**. Existing rows are not automatically reprocessed and the 40 curated rehearsal cases remain local-rule fixtures. Staff can use **Save & reassess** on an existing case to request a new assessment; an active staff override remains in force and skips the model. No source document, numeric rule or original input is changed.

## What the application does

1. Store the original patient input and create one fixed token. Local source conditions run immediately.
2. If a supplied Immediate condition fires, retain Immediate and show an alert immediately; skip the network call. If a staff override controls priority, preserve it and skip the model.
3. Otherwise publish a provisional local priority with **AI assessment pending**, then request a structured model suggestion: Immediate, Soon or Routine, evidence references, and an uncertainty flag.
4. Enforce source-rule minimums in Python. A model cannot lower a supplied Soon rule to Routine. Explicit staff-reported missing-critical-vitals concerns and model-reported uncertainty also prevent applying Routine. Missing measurements and rule-coverage flags are never erased.
5. A completed model may classify a report outside the narrow phrase dictionary, including Routine when it reports sufficient context and no guard blocks it. This deliberately replaces the old blanket rejection of Routine for every vocabulary/policy gap. It is **model judgement**, not a newly validated clinical rule. General complaint checkboxes do not automatically establish qualifiers such as onset, severity or stability.
6. Keep original words, token, source assessment, model/provider/prompt version, input snapshot/fingerprint and audit events. Generated clinical prose is not displayed as verified fact; the explanation identifies the evidence categories used. The model's uncertainty is separate from the existing staff **Unresolved** doctor-review workflow.
7. Discard late responses after staff data changes. Repeated identical registrations do not generate another API request. The staff dashboard refreshes every five seconds; a pending detail and patient receipt check for completion every two seconds. Receipt lookup uses the browser's random submission UUID, not a sequential token, and returns no clinical details or staff records.
8. On timeout, invalid output, refusal, quota or authentication failure, apply no new AI decision and request staff attention. First-time assessments keep the provisional local result. During reassessment, a more urgent earlier AI priority remains active until a valid replacement or staff override arrives; local rule execution or a failed request cannot silently lower it. Interrupted jobs are marked unavailable after restart. There is no hidden automatic retry or automatic switch to a paid provider.

Staff override requirements remain: nurse/intern/JR need a reason plus at least one newly recorded vital; doctor needs a reason. An earlier AI Immediate alert remains available after an override and in history.

## Data sent to the provider

The allowlisted request contains confirmed reported text, bilingual selected labels, explicit context facts, age/sex/pregnancy context, history and medication status/details, and vital values/status/units/times. It excludes direct name, token, request ID, demo ID and `recorded_by` staff metadata. Free text can still identify someone; this is not a de-identification guarantee. Use only synthetic entries. Keys never go to the frontend or audit payloads. Provider exception bodies are not exposed.

## If the connection check fails

| Code | Next step |
| --- | --- |
| `AUTHENTICATION` | Confirm you used a Groq key for Groq. Generate a replacement if revoked, then rerun private setup. |
| `RATE_LIMIT_OR_QUOTA` | Wait and inspect the account's limits. Free-plan limits restrict requests and tokens; you do not need to upgrade simply to continue later. |
| `CONNECTION` / `TIMEOUT` | Check internet/network restrictions and retry once later. |
| `INVALID_RESPONSE_OR_CONFIGURATION` | Check model name, supported structured output and response validation. No model result was accepted. |
| `INVALID_EVIDENCE_REFERENCE` | The response cited an unsupported evidence label. Use the updated adapter, whose schema restricts labels to the accepted evidence fields. No invalid label is silently accepted. |
| `INVALID_RESPONSE_SCHEMA` / `INVALID_EXPLANATION_LENGTH` / `INVALID_MISSING_INFORMATION` | The model returned invalid fields, an invalid explanation length or invalid missing-information entries. No result was accepted; report the code without sharing input or credentials. |
| `INCOMPLETE_RESPONSE` / `MODEL_REFUSAL` | The response was cut off, empty or declined. No result was accepted. |
| `PROVIDER_ERROR` | Check provider status and model/account access. Do not paste credentials while reporting the error. |
| Dashboard still says AI off | Restart the backend from this project folder, then refresh the browser. Check for an old server on port 8000. |
| A patient still shows a local result | Old rows are not retroactively processed. Register a new synthetic case or use staff reassessment. A source Immediate or staff override intentionally skips AI. |

Groq's published limits at implementation were 30 requests/minute, 1,000 requests/day, 8,000 tokens/minute and 200,000 tokens/day for GPT-OSS 120B. Each request includes the source matrix, so the token limit can be reached before the request limit. Account limits can change; check your console. Keep a text/checkbox demonstration of the local path available if the hall's internet fails.

## OpenAI alternative

Create a project API key at [OpenAI Platform](https://platform.openai.com/api-keys) with usable API quota/billing. A ChatGPT subscription does not fund API usage. Run the same private setup with:

```sh
.venv/bin/python -m scripts.setup_ai --provider openai
.venv/bin/python -m scripts.check_ai
```

Restart the backend. The default model is `gpt-4o-mini`; the adapter uses the Responses API and `store=False`. That request setting is not a blanket zero-retention guarantee. Changing providers does not change staff permissions or clinical thresholds.

To return to local mode, set `AI_PROVIDER=disabled` in the private `.env`, then restart the backend. Do not commit `.env`.

## References

- [Groq quickstart](https://console.groq.com/docs/quickstart)
- [Groq free-plan limits](https://console.groq.com/docs/rate-limits)
- [Groq structured outputs](https://console.groq.com/docs/structured-outputs)
- [OpenAI-compatible Groq endpoint](https://console.groq.com/docs/openai)
- [OpenAI developer quickstart](https://developers.openai.com/api/docs/quickstart)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)

These notes describe the new integration and supersede the earlier mentor PDF's account of the two-priority, disabled-only adapter. On 13 October 2026, actual Groq authentication and structured output were verified with synthetic English and Hindi inputs after correcting an unconstrained evidence-label schema. The Hindi case also passed through registration, queue, receipt, staff override and audit in a temporary database. The running local backend was restarted with Groq enabled. These connectivity/workflow checks do not establish clinical accuracy. Details are in [verification.md](verification.md).

## Symptom translation

The configured provider also translates original free-text/voice reports for staff display. The opposite language is chosen from the intake language. Results are cached separately from assessments. Prepared demo phrases and bilingual checkbox labels are available locally. Failed translations show an explicit unavailable state and a retry action. Neither translation nor its failure changes priority or original input.

For public hosting, configure the key in the host environment rather than committing `.env`. See [deployment](deployment.md).
