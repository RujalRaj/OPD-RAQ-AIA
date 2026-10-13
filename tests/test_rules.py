import pytest

from backend.evaluate_cases import evaluate
from backend.services.catalog import FACT_RULES
from backend.services.triage_rules import assess


def result(facts=None, vitals=None, text="", pregnancy="UNKNOWN"):
    return assess(
        {"confirmed_text": text, "facts": facts or {}, "pregnancy_status": pregnancy},
        {k: {"value": v, "status": "RECORDED"} for k, v in (vitals or {}).items()},
    )


@pytest.mark.parametrize("rule_id,fact", list(FACT_RULES.items()))
def test_each_qualitative_source_rule(rule_id, fact):
    data = result({fact: True}, pregnancy="PREGNANT")
    assert rule_id in [r["id"] for r in data["triggered_rules"]]
    assert data["suggested_priority"] == ("IMMEDIATE" if rule_id <= 30 else "SOON")


@pytest.mark.parametrize(
    "key,thresholds,facts,rule_id",
    [
        ("spo2", [(90, True), (91, True), (92, False)], {"room_air": True}, 5),
        ("rr", [(24, False), (25, True), (26, True)], {"distress_or_deterioration": True}, 6),
        ("sbp", [(89, True), (90, False), (91, False)], {"symptoms_or_acute_illness": True}, 9),
        (
            "pr",
            [(49, True), (50, False), (150, False), (151, True)],
            {"symptoms_or_acute_illness": True},
            10,
        ),
    ],
)
def test_numeric_boundaries_and_required_context(key, thresholds, facts, rule_id):
    for value, expected in thresholds:
        assert (
            rule_id in [r["id"] for r in result(facts, {key: value})["triggered_rules"]]
        ) == expected
        assert rule_id not in [r["id"] for r in result({}, {key: value})["triggered_rules"]]


@pytest.mark.parametrize(
    "vitals,expected",
    [({"sbp": 159, "dbp": 109}, False), ({"sbp": 160}, True), ({"dbp": 110}, True)],
)
def test_pregnancy_threshold_uses_or(vitals, expected):
    assert (
        result({}, vitals, pregnancy="PREGNANT")["suggested_priority"] == "IMMEDIATE"
    ) == expected
    assert result({}, vitals, pregnancy="NOT_PREGNANT")["suggested_priority"] != "IMMEDIATE"


def test_missing_vitals_are_unknown_and_red_flag_wins():
    data = result({"rule_11": True})
    assert data["suggested_priority"] == "IMMEDIATE"
    assert len(data["missing_data"]) == 7
    assert result()["suggested_priority"] == "SOON"
    assert result()["policy_gap"]


def test_caution_rule_requires_context_not_automatic_imputation():
    data = result({"concerning_symptoms": True, "missing_vitals_prevent_downgrade": True})
    assert [r["id"] for r in data["triggered_rules"]] == [40]
    assert data["suggested_priority"] == "SOON"


@pytest.mark.parametrize(
    "text",
    [
        "No chest tightness",
        "Denies chest tightness",
        "History of chest tightness last year",
        "सीने में जकड़न नहीं है",
    ],
)
def test_negation_and_history_do_not_become_positive_findings(text):
    data = result(text=text)
    assert data["suggested_priority"] != "IMMEDIATE"
    assert data["ambiguous_mentions"]


@pytest.mark.parametrize("text", ["Chest tightness + sweating", "सीने में नया दर्द", "सीने में जकड़न"])
def test_supported_bilingual_positive_phrases(text):
    assert result(text=text)["suggested_priority"] == "IMMEDIATE"


def test_normal_readings_do_not_cancel_symptom_red_flag():
    assert (
        result({"rule_11": True}, {"spo2": 98, "pr": 75, "sbp": 120})["suggested_priority"]
        == "IMMEDIATE"
    )


def test_routine_checkbox_does_not_hide_unrecognized_complaint():
    assert result({"stable_routine_visit": True}, text="snake bite")["policy_gap"]
    assert result({"stable_routine_visit": True}, text="snake bite")["suggested_priority"] == "SOON"
    assert result({"stable_routine_visit": True})["suggested_priority"] == "ROUTINE"


def test_negation_does_not_cross_contrast_clause():
    assert result(text="No fever but chest tightness")["suggested_priority"] == "IMMEDIATE"


def test_all_original_synthetic_expectations_reported_without_hiding_gaps():
    data = evaluate()
    assert len(data) == 30
    assert {r["case"] for r in data if not r["matches"]} == {5, 7, 10, 12, 20}
    assert all(r["reason"] and r["actual"] in {"IMMEDIATE", "SOON", "ROUTINE"} for r in data)
