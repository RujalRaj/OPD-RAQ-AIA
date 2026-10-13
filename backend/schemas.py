import math
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

Priority = Literal["IMMEDIATE", "SOON", "ROUTINE"]
VitalName = Literal["temperature_c", "pr", "sbp", "dbp", "spo2", "rr", "rbs"]
VITAL_UNITS = {
    "temperature_c": "°C",
    "pr": "beats/min",
    "sbp": "mmHg",
    "dbp": "mmHg",
    "spo2": "%",
    "rr": "breaths/min",
    "rbs": "mg/dL",
}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)


class Measurement(StrictModel):
    value: float | None = None
    status: Literal["RECORDED", "NOT_MEASURED", "UNABLE_TO_OBTAIN", "HIGH", "LOW"] = "RECORDED"

    @model_validator(mode="after")
    def coherent(self):
        if (self.status == "RECORDED") != (self.value is not None):
            raise ValueError(
                "Numeric readings need a value; qualitative or missing entries must have no value"
            )
        if self.value is not None and not math.isfinite(self.value):
            raise ValueError("A finite numeric measurement is required")
        return self


class HasVitals(StrictModel):
    vitals: dict[VitalName, Measurement] = Field(default_factory=dict)

    @model_validator(mode="after")
    def valid_units(self):
        for key, item in self.vitals.items():
            if item.status in {"HIGH", "LOW"} and key not in {"temperature_c", "pr"}:
                raise ValueError(
                    "High / Low observations are supported only for temperature and pulse"
                )
            if item.value is None:
                continue
            if key == "spo2" and not 0 <= item.value <= 100:
                raise ValueError("SpO₂ must be between 0 and 100 percent")
            if key != "temperature_c" and item.value < 0:
                raise ValueError("This measurement cannot be negative")
            if key == "temperature_c" and item.value < -273.15:
                raise ValueError("Temperature cannot be below absolute zero")
        return self


class Intake(HasVitals):
    request_id: UUID
    name: str = Field(min_length=1, max_length=120)
    age_years: int = Field(ge=0, le=130)
    sex: Literal["MALE", "FEMALE", "OTHER", "NOT_STATED"] = "NOT_STATED"
    pregnancy_status: Literal["NOT_PREGNANT", "PREGNANT", "POSTPARTUM", "UNKNOWN"] = "UNKNOWN"
    registration_type: Literal["MANUAL", "DEMO_ABHA"] = "MANUAL"
    language: Literal["hi-IN", "en-IN"] = "hi-IN"
    input_methods: list[Literal["TEXT", "VOICE", "CHECKBOX"]] = Field(
        default_factory=lambda: ["TEXT"]
    )
    original_text: str = Field(default="", max_length=4000)
    confirmed_text: str = Field(default="", max_length=4000)
    symptoms: list[str] = Field(default_factory=list, max_length=128)
    facts: dict[str, bool | None] = Field(default_factory=dict)
    history_status: Literal["NOT_PROVIDED", "NONE", "PROVIDED"] = "NOT_PROVIDED"
    history: str = Field(default="", max_length=2000)
    medication_status: Literal["NOT_PROVIDED", "NONE", "PROVIDED"] = "NOT_PROVIDED"
    medications: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def meaningful(self):
        if not self.name.strip():
            raise ValueError("Name cannot be blank")
        emergency = getattr(self, "staff_assessed_emergency", False)
        if not emergency and not self.confirmed_text.strip() and not self.symptoms:
            raise ValueError("Enter symptoms or select at least one option")
        if not emergency and not self.input_methods:
            raise ValueError("An input method is required")
        for status, content in (
            (self.history_status, self.history),
            (self.medication_status, self.medications),
        ):
            if status == "PROVIDED" and not content.strip():
                raise ValueError("Provide details or select none / not provided")
        return self


class StaffIntake(Intake):
    doctor_review_reason: str | None = Field(default=None, min_length=1, max_length=2000)
    staff_assessed_emergency: bool = False

    @model_validator(mode="after")
    def review_reason_present(self):
        for key in ("temperature_c", "spo2", "pr"):
            item = self.vitals.get(key)
            if not item or item.status in {"NOT_MEASURED", "UNABLE_TO_OBTAIN"}:
                raise ValueError(f"{key}: enter a reading or an allowed High / Low observation")
        if self.doctor_review_reason is not None and not self.doctor_review_reason.strip():
            raise ValueError("Explain why doctor review is needed")
        return self


class Versioned(HasVitals):
    version: int = Field(ge=1)


class Reassessment(Versioned):
    new_symptoms: str = Field(default="", max_length=4000)
    facts: dict[str, bool | None] = Field(default_factory=dict)


class Override(Versioned):
    priority: Priority
    reason_code: Literal["CLINICAL_JUDGEMENT", "NEW_SYMPTOM", "VITAL_DETERIORATION", "OTHER"] = (
        "CLINICAL_JUDGEMENT"
    )
    reason: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def reason_present(self):
        if not self.reason.strip():
            raise ValueError("A reason is required")
        return self


class ReviewRequest(StrictModel):
    version: int = Field(ge=1)
    reason: str = Field(min_length=1, max_length=2000)

    @model_validator(mode="after")
    def not_blank(self):
        if not self.reason.strip():
            raise ValueError("Explain the request or resolution")
        return self


class Login(StrictModel):
    username: str
    password: str


class StaffView(StrictModel):
    id: str
    name: str
    role: Literal["NURSE", "DOCTOR", "INTERN", "JR"]


class Receipt(StrictModel):
    token: int
    demo_id: str
    registered: bool
    urgent_alert: bool
    ai_status: str
    needs_staff_review: bool
    priority: Priority


class ReceiptLookup(StrictModel):
    request_id: UUID


class StoredMeasurement(Measurement):
    unit: str
    measured_at: str | None
    recorded_by: str | None = None


class AssessmentView(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    suggested_priority: Priority
    reason: str
    red_flags: list[dict]
    triggered_rules: list[dict]
    missing_data: list[VitalName]
    caution: bool
    policy_gap: bool
    structured_symptoms: list[dict]
    ambiguous_mentions: list[dict]
    safety_rule_version: str
    source: str
    ai_status: str
    created_at: str


class PatientView(StrictModel):
    id: str
    token: int
    name: str
    demo_id: str
    age: int
    sex: str
    pregnancy_status: str
    registered_at: str
    status: str
    priority: Priority
    version: int
    override_active: bool
    unresolved: bool
    unresolved_reason: str
    original_text: str
    confirmed_text: str
    input: dict
    vitals: dict[VitalName, StoredMeasurement]
    assessment: AssessmentView
    alert_acknowledged: bool


class DashboardView(StrictModel):
    original_queue: list[PatientView]
    priority_order: list[str]
    counts: dict[str, int]


class AuditView(StrictModel):
    id: str
    encounter_id: str
    type: str
    actor: str
    payload: dict
    created_at: str
