export type Priority = 'IMMEDIATE' | 'SOON' | 'ROUTINE'
export type VitalKey = 'temperature_c' | 'pr' | 'sbp' | 'dbp' | 'spo2' | 'rr' | 'rbs'
export type Measurement = {
  value: number | null
  status: 'RECORDED' | 'NOT_MEASURED' | 'UNABLE_TO_OBTAIN' | 'HIGH' | 'LOW'
  unit?: string
  measured_at?: string | null
}
export type Vitals = Partial<Record<VitalKey, Measurement>>
export type Staff = { id: string; name: string; role: 'NURSE' | 'DOCTOR' | 'INTERN' | 'JR' }
export type Rule = {
  id: number
  domain: string
  trigger: string
  basis: string
  source_row: number
}
export type SymptomLabel = {
  id: string
  en: string
  hi: string
  section?: { id: string; en: string; hi: string }
}
export type SymptomGroup = {
  id: string
  en: string
  hi: string
  private_note?: { en: string; hi: string }
}
export type PatientOption = SymptomLabel & { group: string; quick: boolean; hidden?: boolean }
export type Catalog = {
  version: string
  symptom_version?: string
  patient_options: PatientOption[]
  patient_groups?: SymptomGroup[]
  facts: { id: string; label: string }[]
  rules: Rule[]
}
export type Assessment = {
  staff_decision?: { reason: string; priority: Priority; actor: string; kind: string } | null
  id: string
  suggested_priority: Priority
  reason: string
  red_flags: Rule[]
  triggered_rules: Rule[]
  missing_data: string[]
  policy_gap: boolean
  caution: boolean
  source: string
  ai_status: string
  ai_error?: string | null
  ai_provider?: string
  ai_immediate?: boolean
  retained_ai_alert?: { assessment_id: string; provider?: string; model?: string }
  carried_ai_priority?: { assessment_id: string; priority: Priority }
  needs_staff_review?: boolean
  ai_proposal?: { priority: Priority; applied: boolean; blocked_reason?: string | null }
  model_version?: string
  structured_symptoms: { name: string; value: boolean | null; evidence: Record<string, unknown> }[]
  ambiguous_mentions: { phrase: string; status: string }[]
}
export type Patient = {
  id: string
  token: number
  name: string
  demo_id: string
  age: number
  sex: string
  pregnancy_status: string
  registered_at: string
  priority: Priority
  version: number
  override_active: boolean
  unresolved: boolean
  unresolved_reason: string
  original_text: string
  confirmed_text: string
  input: {
    demo_scenario?: { title: string; briefing: string }
    language: string
    input_methods: string[]
    symptoms?: string[]
    selected_symptom_labels?: SymptomLabel[]
    symptom_catalog_version?: string
    history_status: string
    history: string
    medication_status: string
    medications: string
    facts: Record<string, boolean | null>
  }
  vitals: Vitals
  assessment: Assessment
  alert_acknowledged: boolean
}
export type DashboardData = {
  original_queue: Patient[]
  priority_order: string[]
  counts: Record<string, number>
}
export type Audit = {
  id: string
  type: string
  actor: string
  created_at: string
  payload: Record<string, unknown>
  encounter_id: string
}

export type Receipt = {
  priority: Priority
  token: number
  urgent_alert: boolean
  ai_status: string
  needs_staff_review: boolean
}
export type AIHealth = {
  ai_provider: string
  ai_model?: string | null
  ai_configured: boolean
  ai_configuration_valid: boolean
}
