import json
from pathlib import Path

RULE_VERSION = "workbook-40-v1-demo"
RULES = json.loads((Path(__file__).parent.parent / "fixtures/safety_matrix.json").read_text())
# A checked qualitative fact means the complete source condition is reported.
# Numeric conditions are evaluated separately, with their context preserved.
FACT_RULES = {i: f"rule_{i}" for i in range(1, 41) if i not in {5, 6, 9, 10, 28, 40}}
CONTEXT = {
    "room_air": "SpO₂ measured on room air",
    "very_low_spo2_with_symptoms": "Staff observes a very low SpO₂ reading with symptoms (qualitative source condition)",
    "distress_or_deterioration": "Respiratory distress or deterioration",
    "symptoms_or_acute_illness": "Current symptoms or acute illness",
    "concerning_symptoms": "Symptoms are concerning",
    "missing_vitals_prevent_downgrade": "Staff confirms missing critical vitals prevent safe downgrading",
    "stable_routine_visit": "Stable routine refill/follow-up, no new symptoms reported",
}
FACT_KEYS = set(FACT_RULES.values()) | set(CONTEXT)
# Patient vocabulary is versioned separately from the unchanged source safety matrix.
SYMPTOM_VERSION = "opd-reports-v3"
PATIENT_GROUPS = [
    {"id": "breathing_chest", "en": "Breathing, chest & allergy", "hi": "साँस, सीना और एलर्जी"},
    {
        "id": "consciousness_nerves",
        "en": "Fainting, confusion & nerve symptoms",
        "hi": "बेहोशी, भ्रम और नसों से जुड़े लक्षण",
    },
    {
        "id": "bleeding_fluids",
        "en": "Bleeding, weakness & fluid loss",
        "hi": "खून बहना, कमजोरी और पानी की कमी",
    },
    {
        "id": "abdominal_illness",
        "en": "Abdominal/urinary problems, fever & other illness",
        "hi": "पेट/पेशाब की परेशानी, बुखार और अन्य बीमारी",
    },
    {
        "id": "injury_exposure",
        "en": "Injuries, poisoning, eye & limb/genital problems",
        "hi": "चोट, ज़हर, आँख और हाथ-पैर/जननांग की परेशानी",
    },
    {"id": "children", "en": "Babies & children", "hi": "शिशु और बच्चे"},
    {"id": "pregnancy", "en": "Pregnancy & after delivery", "hi": "गर्भावस्था और प्रसव के बाद"},
    {
        "id": "personal_safety",
        "en": "Personal safety & mental distress",
        "hi": "व्यक्तिगत सुरक्षा और मानसिक परेशानी",
        "private_note": {
            "en": "Ask these questions in a separate, private space when needed.",
            "hi": "इन सवालों को जरूरत पड़ने पर अलग, निजी जगह में पूछें।",
        },
    },
]
COMPLAINTS = [
    ("fever", "Fever", "बुखार", "general"),
    ("cough", "Cough", "खाँसी", "general"),
    ("vomiting", "Vomiting", "उल्टी", "general"),
    ("diarrhoea", "Loose stools / diarrhoea", "दस्त", "general"),
    ("abdominal_pain", "Abdominal pain", "पेट में दर्द", "general"),
    ("headache", "Headache", "सिर दर्द", "general"),
    ("body_aches", "Body aches", "बदन दर्द", "general"),
    ("dizziness", "Dizziness", "चक्कर आना", "general"),
    ("tiredness", "Tiredness", "थकान", "general"),
    ("reduced_appetite", "Reduced appetite", "भूख कम लगना", "general"),
    ("abdominal_fullness", "Abdominal fullness / gas", "पेट भरा या फूला लगना / गैस", "general"),
    ("chest_pain", "Chest pain", "सीने में दर्द", "respiratory"),
    ("breathing_difficulty", "Difficulty breathing", "साँस लेने में तकलीफ़", "respiratory"),
    ("wheezing", "Wheezing / whistling while breathing", "साँस में सीटी की आवाज़", "respiratory"),
    ("palpitations", "Racing or pounding heartbeat", "दिल तेज़ धड़कना", "respiratory"),
    ("coughing_blood", "Coughing up blood", "खाँसी में खून आना", "respiratory"),
    ("phlegm_cough", "Cough with phlegm", "बलगम वाली खाँसी", "respiratory"),
    ("dry_cough", "Dry cough", "सूखी खाँसी", "respiratory"),
    ("painful_urination", "Burning/pain when passing urine", "पेशाब में जलन या दर्द", "urinary"),
    ("frequent_urination", "Passing urine more often", "बार-बार पेशाब आना", "urinary"),
    ("reduced_urine", "Passing less urine than usual", "सामान्य से कम पेशाब आना", "urinary"),
    ("difficulty_urinating", "Difficulty passing urine", "पेशाब करने में कठिनाई", "urinary"),
    ("unable_to_urinate", "Unable to pass urine", "पेशाब न हो पाना", "urinary"),
    ("blood_in_urine", "Blood in urine", "पेशाब में खून", "urinary"),
    ("urine_leakage", "Urine leakage", "पेशाब का अपने आप निकल जाना", "urinary"),
    ("constipation", "Constipation", "कब्ज़", "digestive"),
    ("heartburn", "Burning in the chest / heartburn", "सीने में जलन", "digestive"),
    ("difficulty_swallowing", "Difficulty swallowing", "निगलने में परेशानी", "digestive"),
    ("blood_in_stools", "Blood in stools", "मल में खून", "digestive"),
    ("black_stools", "Black, tar-like stools", "काला, तारकोल जैसा मल", "digestive"),
    ("yellow_eyes_skin", "Yellowing of eyes or skin", "आँखों या त्वचा में पीलापन", "digestive"),
    (
        "small_joint_pain_morning_stiffness",
        "Small-joint pain with early-morning stiffness",
        "छोटे जोड़ों में दर्द के साथ सुबह-सुबह अकड़न",
        "musculoskeletal",
    ),
    (
        "large_joint_pain",
        "Large-joint pain (knee, hip, shoulder, elbow, ankle or wrist)",
        "बड़े जोड़ों में दर्द (घुटना, कूल्हा, कंधा, कोहनी, टखना या कलाई)",
        "musculoskeletal",
    ),
    ("low_back_pain", "Low back pain", "कमर के निचले हिस्से में दर्द", "musculoskeletal"),
]
COMPLAINT_KEYS = {f"complaint_{key}" for key, *_ in COMPLAINTS}
PATIENT_OPTIONS = [
    {
        "id": "rule_11",
        "en": "New chest pain, pressure or tightness",
        "hi": "सीने में नया दर्द, दबाव या जकड़न",
    },
    {
        "id": "rule_3",
        "en": "Severe breathlessness / difficulty speaking because of breathing",
        "hi": "साँस की बहुत तकलीफ़ / साँस के कारण बोलने में कठिनाई",
    },
    {"id": "rule_7", "en": "Heavy or uncontrolled bleeding", "hi": "बहुत अधिक या लगातार खून बहना"},
    {
        "id": "rule_13",
        "en": "New seizure or active convulsions",
        "hi": "नया दौरा पड़ना या अभी दौरा जारी होना",
    },
    {
        "id": "rule_15",
        "en": "Sudden weakness on one side or new speech difficulty",
        "hi": "अचानक एक तरफ कमजोरी या बोलने में नई कठिनाई",
    },
    {
        "id": "rule_31",
        "en": "New wheezing; otherwise stable",
        "hi": "साँस में नई सीटी की आवाज़; अन्यथा स्थिति स्थिर",
    },
    {
        "id": "rule_32",
        "en": "Recent fainting; now alert and stable",
        "hi": "हाल में बेहोशी; अभी होश में और स्थिति स्थिर",
    },
    {
        "id": "rule_35",
        "en": "Severe pain; no reported instability",
        "hi": "तेज़ दर्द; स्थिति बिगड़ने की सूचना नहीं",
    },
    {
        "id": "rule_37",
        "en": "Repeated vomiting/diarrhoea; unable to keep fluids down, no shock reported",
        "hi": "बार-बार उल्टी/दस्त; पानी नहीं रुक रहा, शॉक की सूचना नहीं",
    },
    {
        "id": "stable_routine_visit",
        "en": "Routine refill/follow-up; feeling well, no new symptoms",
        "hi": "नियमित दवा/फॉलो-अप; ठीक महसूस कर रहे हैं, कोई नया लक्षण नहीं",
    },
]

# Legacy choices are retained only for old records/API clients, never new intake.
# Their wording is unchanged, including fallback labels for pre-snapshot records.
for option in PATIENT_OPTIONS:
    option.update(quick=False, hidden=True, group="legacy")
PATIENT_OPTIONS = [
    {
        "id": f"complaint_{key}",
        "en": en,
        "hi": hi,
        "group": "legacy",
        "quick": False,
        "hidden": True,
    }
    for key, en, hi, _group in COMPLAINTS
] + PATIENT_OPTIONS

REPORT_OPTIONS = json.loads(
    (Path(__file__).parent.parent / "fixtures/patient_reports_v3.json").read_text()
)
# Boundaries follow the eight sections approved by the user for the supplied 63 bullets.
for start, stop, group in zip(
    (1, 7, 13, 19, 30, 44, 52, 60), (6, 12, 18, 29, 43, 51, 59, 63), PATIENT_GROUPS
):
    for option in REPORT_OPTIONS[start - 1 : stop]:
        option.update(group=group["id"], quick=False, hidden=False)
PATIENT_OPTIONS = REPORT_OPTIONS + PATIENT_OPTIONS
REPORT_KEYS = {option["id"] for option in REPORT_OPTIONS}
# Only reports that directly state a complete existing source condition map to it.
# Broader compound reports do not establish which OR branch applies, stability,
# pregnancy, absence of shock, or a new clinical rule. They remain AI/staff evidence.
SOURCE_REPORT_FACTS = {
    "report_v3_01": "rule_3",  # Severe respiratory distress / inability to speak.
    "report_v3_03": "rule_11",  # New chest pain/pressure/tightness/heaviness.
    "report_v3_09": "rule_15",  # Sudden focal facial or unilateral limb deficit.
    "report_v3_13": "rule_7",  # Heavy/uncontrolled bleeding.
    "report_v3_34": "rule_21",  # Poisoning, overdose or dangerous chemical exposure.
}


def selection_labels(snapshot):
    """Use captured labels, with a read-only fallback for pre-catalogue encounters."""
    if "selected_symptom_labels" in snapshot:
        return snapshot["selected_symptom_labels"]
    options = {option["id"]: option for option in PATIENT_OPTIONS}
    groups = {group["id"]: group for group in PATIENT_GROUPS}
    selected = []
    for symptom in dict.fromkeys(snapshot.get("symptoms", [])):
        if symptom not in options:
            continue
        option = options[symptom]
        item = {key: option[key] for key in ("id", "en", "hi")}
        if option["group"] in groups:
            # Preserve section context, particularly child/pregnancy reports whose
            # complete meaning depends on their heading. This is not a demographic inference.
            item["section"] = {key: groups[option["group"]][key] for key in ("id", "en", "hi")}
        selected.append(item)
    return selected


def catalog():
    return {
        "version": RULE_VERSION,
        "symptom_version": SYMPTOM_VERSION,
        "patient_groups": PATIENT_GROUPS,
        "demo_context": {"district": "Gorakhpur", "state": "Uttar Pradesh", "setting": "OPD"},
        "clinical_validation": "NOT_VALIDATED",
        "patient_options": PATIENT_OPTIONS,
        "facts": [
            {"id": f, "label": next(r["trigger"] for r in RULES if r["id"] == i)}
            for i, f in FACT_RULES.items()
        ]
        + [{"id": k, "label": v} for k, v in CONTEXT.items()],
        "rules": RULES,
    }
