"""Report source-case agreement honestly; this is not clinical validation."""

import json
from pathlib import Path

from backend.seed_demo import case_intake
from backend.services.triage_rules import assess


def evaluate():
    cases = json.loads((Path(__file__).parent / "fixtures/synthetic_cases.json").read_text())
    results = []
    for case in cases:
        payload = case_intake(case)
        result = assess(
            payload.model_dump(mode="json"), {k: v.model_dump() for k, v in payload.vitals.items()}
        )
        results.append(
            {
                "case": case["case"],
                "expected": case["expected"].upper(),
                "actual": result["suggested_priority"],
                "matches": result["suggested_priority"] == case["expected"].upper(),
                "coverage_gap": result["policy_gap"],
                "rule_ids": [r["id"] for r in result["triggered_rules"]],
                "reason": result["reason"],
            }
        )
    return results


if __name__ == "__main__":
    print(
        json.dumps(
            {
                "notice": "Synthetic software checks only; not clinical validation. Expected labels unchanged.",
                "results": evaluate(),
            },
            indent=2,
        )
    )
