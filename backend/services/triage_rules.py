from backend.schemas import VITAL_UNITS
from backend.services.catalog import (
    COMPLAINT_KEYS,
    FACT_RULES,
    REPORT_KEYS,
    RULE_VERSION,
    RULES,
    SOURCE_REPORT_FACTS,
    selection_labels,
)
from backend.services.symptom_processor import extract, routine_description_supported

RANK = {"IMMEDIATE": 0, "SOON": 1, "ROUTINE": 2}


def assess(snapshot, vitals):
    extracted, ambiguous = extract(snapshot.get("confirmed_text", ""))
    facts = {key: True for key in extracted}
    evidence = dict(extracted)
    labels = {item["id"]: item for item in selection_labels(snapshot)}
    for key in snapshot.get("symptoms", []):
        facts[key] = True
        evidence[key] = {"source": "CHECKBOX", "field": key, "reported_label": labels.get(key)}
        if key in SOURCE_REPORT_FACTS:
            source_fact = SOURCE_REPORT_FACTS[key]
            facts[source_fact] = True
            evidence[source_fact] = {**evidence[key], "mapped_source_condition": source_fact}
    for key, value in snapshot.get("facts", {}).items():
        facts[key] = value
        evidence[key] = {"source": "EXPLICIT_FACT", "field": key, "value": value}
    pregnancy = snapshot.get("pregnancy_status", "UNKNOWN")
    pregnant = pregnancy == "PREGNANT"
    obstetric = pregnancy in {"PREGNANT", "POSTPARTUM"}

    def value(key):
        measurement = vitals.get(key, {})
        return measurement.get("value") if measurement.get("status") == "RECORDED" else None

    missing = [k for k in VITAL_UNITS if value(k) is None]
    triggered = []
    for row in RULES:
        i = row["id"]
        match = facts.get(FACT_RULES.get(i, "")) is True
        if i in {24, 25}:
            match = match and obstetric
        elif i in {26, 27, 29, 39}:
            match = match and pregnant
        elif i == 5:
            match = (
                value("spo2") is not None and value("spo2") <= 91 and facts.get("room_air") is True
            ) or facts.get("very_low_spo2_with_symptoms") is True
        elif i == 6:
            match = (
                value("rr") is not None
                and value("rr") >= 25
                and facts.get("distress_or_deterioration") is True
            )
        elif i == 9:
            match = (
                value("sbp") is not None
                and value("sbp") < 90
                and facts.get("symptoms_or_acute_illness") is True
            )
        elif i == 10:
            match = (
                value("pr") is not None
                and (value("pr") > 150 or value("pr") < 50)
                and facts.get("symptoms_or_acute_illness") is True
            )
        elif i == 28:
            match = pregnant and (
                (value("sbp") is not None and value("sbp") >= 160)
                or (value("dbp") is not None and value("dbp") >= 110)
            )
        elif i == 40:
            match = (
                bool(missing)
                and facts.get("concerning_symptoms") is True
                and facts.get("missing_vitals_prevent_downgrade") is True
            )
        if match:
            triggered.append(
                {
                    **row,
                    "evidence": {
                        "facts": {k: v for k, v in evidence.items() if facts.get(k) is True},
                        "recorded_vitals": {
                            k: v for k, v in vitals.items() if v.get("status") == "RECORDED"
                        },
                    },
                }
            )
    reds = [r for r in triggered if r["priority"] == "Immediate"]
    review_gap = False
    if reds:
        priority = "IMMEDIATE"
        reason = f"Reported findings match safety rule {reds[0]['id']}. Immediate staff assessment requested."
    elif triggered:
        priority = "SOON"
        reason = f"Reported findings match safety rule {triggered[0]['id']}. Prompt staff assessment requested."
    elif (
        facts.get("stable_routine_visit") is True
        and routine_description_supported(snapshot.get("confirmed_text", ""))
        and not extracted
        and not any(facts.get(k) is True for k in FACT_RULES.values())
        and not any(facts.get(k) is True for k in COMPLAINT_KEYS | REPORT_KEYS)
    ):
        priority = "ROUTINE"
        reason = "Stable routine visit reported. No supplied safety condition established; staff may change priority."
    else:
        priority = "SOON"
        reason = "Insufficient rule coverage or context. Soon is a demo routing fallback; staff assessment is needed."
        review_gap = True
    return {
        "suggested_priority": priority,
        "reason": reason,
        "red_flags": reds,
        "triggered_rules": triggered,
        "missing_data": missing,
        "caution": bool(missing) or review_gap,
        "policy_gap": review_gap,
        "structured_symptoms": [
            {"name": k, "evidence": v, "value": facts.get(k)} for k, v in evidence.items()
        ],
        "ambiguous_mentions": ambiguous,
        "safety_rule_version": RULE_VERSION,
        "source": "SOURCE_RULES" if triggered else "DEMO_ROUTING",
        "ai_status": "DISABLED",
    }
