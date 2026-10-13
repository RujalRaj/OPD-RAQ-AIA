import pytest
from conftest import create_patient, intake, login
from sqlalchemy import select

from backend.models import InputRevision
from backend.services.ai import validate_proposal
from backend.services.catalog import (
    COMPLAINT_KEYS,
    PATIENT_OPTIONS,
    REPORT_KEYS,
    REPORT_OPTIONS,
    SOURCE_REPORT_FACTS,
    SYMPTOM_VERSION,
    catalog,
)
from backend.services.triage_rules import assess


def test_eight_sections_replace_patient_choices_and_retain_legacy_meanings():
    data = catalog()
    assert len(data["rules"]) == 40
    groups = data["patient_groups"]
    assert len(groups) == 8
    options = [o for o in data["patient_options"] if not o.get("hidden")]
    assert len(options) == 63
    assert [sum(o["group"] == g["id"] for o in options) for g in groups] == [
        6,
        6,
        6,
        11,
        14,
        8,
        8,
        4,
    ]
    assert {o["id"] for o in options} == REPORT_KEYS
    assert all(o["en"].strip() and o["hi"].strip() for o in options)
    assert len({o["id"] for o in data["patient_options"]}) == len(data["patient_options"])
    legacy = [o for o in data["patient_options"] if o.get("hidden")]
    assert len(legacy) == 44
    assert (
        next(o for o in legacy if o["id"] == "rule_11")["en"]
        == "New chest pain, pressure or tightness"
    )
    assert groups[-1]["private_note"]["hi"] == "इन सवालों को जरूरत पड़ने पर अलग, निजी जगह में पूछें।"


@pytest.mark.parametrize("code", sorted(COMPLAINT_KEYS))
def test_general_label_does_not_assert_full_clinical_rule_or_allow_routine(code):
    result = assess({"symptoms": [code, "stable_routine_visit"], "confirmed_text": ""}, {})
    assert result["triggered_rules"] == []
    assert result["policy_gap"] is True
    assert result["source"] == "DEMO_ROUTING"
    assert result["suggested_priority"] == "SOON"
    assert len(result["missing_data"]) == 7
    assert {s["name"] for s in result["structured_symptoms"]} == {code, "stable_routine_visit"}
    assert all(s["value"] is True for s in result["structured_symptoms"])


def test_selected_labels_are_captured_and_retries_are_independent_of_catalog_changes(
    client, monkeypatch
):
    login(client)
    payload = intake(
        original_text="",
        confirmed_text="",
        language="hi-IN",
        input_methods=["CHECKBOX"],
        symptoms=[
            "complaint_abdominal_fullness",
            "complaint_dry_cough",
            "complaint_blood_in_urine",
        ],
    )
    receipt = client.post("/api/v1/encounters", json=payload)
    assert receipt.status_code == 201
    p = client.get("/api/v1/dashboard").json()["original_queue"][0]
    labels = p["input"]["selected_symptom_labels"]
    assert [o["id"] for o in labels] == payload["symptoms"]
    assert labels[1] == {"id": "complaint_dry_cough", "en": "Dry cough", "hi": "सूखी खाँसी"}
    assert p["input"]["symptom_catalog_version"] == SYMPTOM_VERSION
    assert p["original_text"] == ""
    with client.app.state.sessions() as db:
        original = db.scalar(select(InputRevision))
        assert original.payload["selected_symptom_labels"] == labels
    dry_cough = next(o for o in PATIENT_OPTIONS if o["id"] == "complaint_dry_cough")
    monkeypatch.setitem(dry_cough, "en", "Changed future label")
    retried = client.post("/api/v1/encounters", json=payload)
    assert retried.status_code == 201
    assert retried.json()["token"] == receipt.json()["token"]
    saved = client.get(f"/api/v1/encounters/{p['id']}").json()
    assert saved["input"]["selected_symptom_labels"] == labels
    assert len(client.get("/api/v1/dashboard").json()["original_queue"]) == 1


def test_all_approved_codes_register_and_legacy_urgent_rule_still_wins(client):
    login(client)
    p = create_patient(client, symptoms=sorted(COMPLAINT_KEYS) + ["rule_11"])
    assert p["priority"] == "IMMEDIATE"
    assert [r["id"] for r in p["assessment"]["triggered_rules"]] == [11]
    assert len(p["input"]["selected_symptom_labels"]) == 35
    bad = client.post("/api/v1/encounters", json=intake(symptoms=["unapproved_complaint"]))
    assert bad.status_code == 422


def test_model_receives_meaningful_labels_but_cannot_clear_policy_gap(client, monkeypatch):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "openai")
    received = []

    def propose(evidence):
        received.append(evidence)
        return validate_proposal(
            {
                "priority": "ROUTINE",
                "reason": "Example",
                "evidence_ids": ["selected_symptoms"],
                "needs_staff_review": True,
                "missing_information": [],
            },
            evidence,
        )

    monkeypatch.setattr("backend.main.propose", propose)
    p = create_patient(
        client,
        original_text="",
        confirmed_text="",
        symptoms=["complaint_wheezing", "stable_routine_visit"],
    )
    assert received[0]["selected_symptoms"][0]["en"] == "Wheezing / whistling while breathing"
    assert "name" not in received[0]
    assert p["priority"] == "SOON"
    assert p["assessment"]["policy_gap"]
    assert p["assessment"]["ai_status"] == "COMPLETE"


@pytest.mark.parametrize("report,source_fact", sorted(SOURCE_REPORT_FACTS.items()))
def test_direct_equivalent_reports_preserve_existing_source_conditions(report, source_fact):
    result = assess({"symptoms": [report], "confirmed_text": ""}, {})
    assert result["suggested_priority"] == "IMMEDIATE"
    assert [r["id"] for r in result["triggered_rules"]] == [int(source_fact.removeprefix("rule_"))]
    reported = next(s for s in result["structured_symptoms"] if s["name"] == source_fact)
    assert reported["evidence"]["field"] == report
    assert reported["evidence"]["reported_label"]["hi"]


def test_compound_reports_do_not_invent_stability_shock_or_pregnancy_findings(client):
    login(client)
    for code in ("report_v3_17", "report_v3_52", "report_v3_54"):
        p = create_patient(client, original_text="", confirmed_text="", symptoms=[code])
        assert not p["assessment"]["triggered_rules"]
        assert p["assessment"]["policy_gap"]
        assert p["pregnancy_status"] == "UNKNOWN"
        assert all(v["value"] is None for v in p["vitals"].values())
    assert p["input"]["selected_symptom_labels"][0]["section"]["id"] == "pregnancy"


def test_all_63_reports_can_be_saved_but_section_ids_cannot_be_submitted(client):
    login(client)
    p = create_patient(
        client,
        original_text="",
        confirmed_text="",
        input_methods=["CHECKBOX"],
        symptoms=[o["id"] for o in REPORT_OPTIONS],
    )
    labels = p["input"]["selected_symptom_labels"]
    assert len(labels) == 63
    assert [o["hi"] for o in labels] == [o["hi"] for o in REPORT_OPTIONS]
    assert p["original_text"] == ""
    assert p["input"]["symptom_catalog_version"] == "opd-reports-v3"
    bad = client.post("/api/v1/encounters", json=intake(symptoms=["pregnancy"]))
    assert bad.status_code == 422


def test_new_report_labels_and_section_context_reach_model_and_remain_immutable(
    client, monkeypatch
):
    login(client)
    monkeypatch.setenv("AI_PROVIDER", "groq")
    received = []

    def propose(evidence):
        received.append(evidence)
        return validate_proposal(
            {
                "priority": "SOON",
                "reason": "Synthetic review example",
                "evidence_ids": ["selected_symptoms"],
                "needs_staff_review": True,
                "missing_information": [],
            },
            evidence,
        )

    monkeypatch.setattr("backend.main.propose", propose)
    payload = intake(
        original_text="",
        confirmed_text="",
        symptoms=["report_v3_56"],
        input_methods=["CHECKBOX"],
        language="hi-IN",
    )
    receipt = client.post("/api/v1/encounters", json=payload).json()
    assert received[0]["selected_symptoms"][0]["section"]["en"] == "Pregnancy & after delivery"
    assert received[0]["patient_context"]["pregnancy_status"] == "UNKNOWN"
    p = client.get("/api/v1/dashboard").json()["original_queue"][0]
    labels = p["input"]["selected_symptom_labels"]
    option = next(o for o in PATIENT_OPTIONS if o["id"] == "report_v3_56")
    monkeypatch.setitem(option, "en", "Future wording")
    assert client.post("/api/v1/encounters", json=payload).json()["token"] == receipt["token"]
    assert len(received) == 1
    saved = client.get(f"/api/v1/encounters/{p['id']}").json()
    assert saved["input"]["selected_symptom_labels"] == labels
