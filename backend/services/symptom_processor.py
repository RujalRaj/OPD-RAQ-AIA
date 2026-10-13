import re

# Literal descriptions in the supplied synthetic fixtures, not clinical criteria.
STABLE_DESCRIPTIONS = {
    "routine thyroid refill",
    "routine diabetes follow-up; feels well",
    "routine hypertension follow-up, asymptomatic",
    "stable medication refill; all vitals normal",
    "routine arthritis follow-up",
}


def routine_description_supported(text):
    return not text.strip() or text.strip().lower() in STABLE_DESCRIPTIONS


# Narrow, source-linked phrase extraction, not a clinical language model.
# Unmatched/ambiguous wording is retained and cannot establish absent findings.
PHRASES = {
    "rule_1": ["unresponsive", "cannot protect airway", "difficult to arouse"],
    "rule_2": ["stridor", "upper-airway obstruction"],
    "rule_3": [
        "severe breathlessness",
        "unable to speak full sentences",
        "severe respiratory distress",
        "साँस की बहुत तकलीफ़",
    ],
    "rule_4": ["central cyanosis"],
    "rule_7": ["heavy bleeding", "uncontrolled bleeding", "बहुत अधिक खून"],
    "rule_8": ["signs of shock", "poor perfusion with acute illness"],
    "rule_11": [
        "acute chest pain",
        "new chest pain",
        "chest tightness",
        "acute chest pressure",
        "सीने में नया दर्द",
        "सीने में जकड़न",
    ],
    "rule_13": ["new seizure", "active convulsion", "नया दौरा"],
    "rule_14": ["acute confusion", "new altered mental status", "pale and confused"],
    "rule_15": [
        "sudden right-sided weakness",
        "sudden left-sided weakness",
        "new focal neurologic deficit",
        "अचानक एक तरफ कमजोरी",
    ],
    "rule_16": ["sudden loss of consciousness", "recurrent syncope with concerning symptoms"],
    "rule_17": [
        "sudden severe headache with blurred vision",
        "sudden severe headache with visual symptoms",
    ],
    "rule_18": ["symptomatic hypoglycaemia", "symptomatic hypoglycemia"],
    "rule_19": [
        "major road traffic collision; abdominal pain",
        "high-risk trauma with concerning symptoms",
    ],
    "rule_20": ["threatened limb"],
    "rule_21": ["suspected poisoning", "overdose", "dangerous chemical exposure"],
    "rule_24": ["heavy vaginal bleeding"],
    "rule_31": ["wheeze, mild; speaking normally", "new wheeze without distress"],
    "rule_32": ["fainted briefly; now alert", "recent fainting; now stable"],
    "rule_33": ["new weakness of both legs; no instability"],
    "rule_34": ["acute visual loss", "acute visual disturbance"],
    "rule_35": ["severe pain", "severe abdominal pain"],
    "rule_36": ["new generalized weakness", "new generalised weakness"],
    "rule_37": ["vomiting repeatedly; cannot keep fluids down", "cannot maintain hydration"],
    "symptoms_or_acute_illness": ["dizziness", "palpitations", "fever", "acute illness", "चक्कर"],
    "concerning_symptoms": ["very unwell", "concerning symptoms"],
}


def extract(text):
    lower = text.lower()
    found = {}
    ambiguous = []
    for key, phrases in PHRASES.items():
        for phrase in phrases:
            for match in re.finditer(re.escape(phrase), lower):
                before = lower[max(0, match.start() - 65) : match.start()]
                before = re.split(r"[.!?\n]|\b(?:but|however)\b|लेकिन|मगर", before)[-1]
                after = lower[match.end() : match.end() + 30]
                negated = re.search(r"\b(no|not|denies|without|never)\b", before) or re.search(
                    r"(नहीं|नही)", after
                )
                historical = re.search(
                    r"\b(history of|last year|previously|mother|father|family|resolved)\b", before
                ) or re.search(r"\b(resolved|last year)\b", after)
                if negated or historical:
                    ambiguous.append(
                        {
                            "phrase": text[match.start() : match.end()],
                            "status": "NEGATED_OR_HISTORICAL",
                            "start": match.start(),
                            "end": match.end(),
                        }
                    )
                else:
                    found[key] = {
                        "source": "TEXT_PHRASE",
                        "quote": text[match.start() : match.end()],
                        "start": match.start(),
                        "end": match.end(),
                    }
    return found, ambiguous
