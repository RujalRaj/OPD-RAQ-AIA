"""One live synthetic API request, without adding patients to the database."""

from pathlib import Path

from dotenv import load_dotenv

from backend.services.ai import clinical_evidence, configuration, failure_code, propose


def main():
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    config = configuration()
    if not config["configured"]:
        print("No usable key configured. Run: .venv/bin/python -m scripts.setup_ai --provider groq")
        return 1
    evidence = clinical_evidence(
        {
            "age_years": 40,
            "sex": "NOT_STATED",
            "pregnancy_status": "UNKNOWN",
            "language": "en-IN",
            "confirmed_text": "Routine medication refill. I feel well and have no new symptoms.",
            "symptoms": ["stable_routine_visit"],
            "facts": {},
            "history_status": "NOT_PROVIDED",
            "medication_status": "NOT_PROVIDED",
        },
        {},
    )
    print(f"Testing {config['provider']} / {config['model']} with one invented example...")
    try:
        result = propose(evidence)
    except Exception as exc:
        code = failure_code(exc)
        help_text = {
            "AUTHENTICATION": "Check the selected provider and API key; replace a revoked or invalid key.",
            "RATE_LIMIT_OR_QUOTA": "Check the account quota. On Groq Free, wait before retrying; no upgrade is required.",
            "TIMEOUT": "Check internet access, then try once more later.",
            "CONNECTION": "Check internet access or network restrictions.",
            "INVALID_RESPONSE_OR_CONFIGURATION": "Check model support and response validation; no result was accepted.",
            "INVALID_EVIDENCE_REFERENCE": "The model cited an unsupported evidence label. No result was accepted; check the response schema.",
            "INVALID_RESPONSE_SCHEMA": "The model returned unexpected fields or malformed JSON. No result was accepted.",
            "INVALID_EXPLANATION_LENGTH": "The model explanation exceeded the allowed length or was empty. No result was accepted.",
            "INVALID_MISSING_INFORMATION": "The model's missing-information fields were invalid. No result was accepted.",
            "INCOMPLETE_RESPONSE": "The model response was cut off or empty. No result was accepted.",
            "MODEL_REFUSAL": "The model declined the request. No result was accepted.",
            "PROVIDER_ERROR": "Check the account model access and provider status. No result was accepted.",
        }
        print(f"Connection check failed: {code}. {help_text[code]}")
        return 1
    print(
        f"LIVE RESPONSE VERIFIED: {result.priority}; staff-review flag: {result.needs_staff_review}."
    )
    print("This confirms API connectivity and output validation, not clinical correctness.")
    print(
        "No patient was created. Restart the backend after changing .env, then register a new synthetic patient."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
