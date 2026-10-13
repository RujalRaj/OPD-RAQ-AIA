import { AlertTriangle, Clock3, HeartPulse } from 'lucide-react'
import type { Assessment, Measurement, Patient, Priority, VitalKey, Vitals } from './types'

export const priorities: Priority[] = ['IMMEDIATE', 'SOON', 'ROUTINE']
export const vitalLabels: Record<VitalKey, string> = {
  temperature_c: 'Temperature',
  pr: 'Pulse',
  sbp: 'Systolic BP',
  dbp: 'Diastolic BP',
  spo2: 'SpO₂',
  rr: 'Respiratory rate',
  rbs: 'Random blood sugar',
}
export const vitalLabelsHi: Record<VitalKey, string> = {
  temperature_c: 'तापमान',
  pr: 'नाड़ी',
  sbp: 'सिस्टोलिक रक्तचाप',
  dbp: 'डायस्टोलिक रक्तचाप',
  spo2: 'ऑक्सीजन स्तर',
  rr: 'साँस की दर',
  rbs: 'रक्त शर्करा',
}
export const requiredRegistrationVitals: VitalKey[] = ['temperature_c', 'spo2', 'pr']
export function registrationVitalsComplete(vitals: Vitals) {
  return requiredRegistrationVitals.every((key) => {
    const entry = vitals[key]
    if (!entry) return false
    if (key !== 'spo2' && (entry.status === 'HIGH' || entry.status === 'LOW')) return true
    return (
      entry.status === 'RECORDED' &&
      entry.value != null &&
      Number.isFinite(entry.value) &&
      (key !== 'spo2' || (entry.value >= 0 && entry.value <= 100)) &&
      (key !== 'pr' || entry.value >= 0) &&
      (key !== 'temperature_c' || entry.value >= -273.15)
    )
  })
}
export function measurementLabel(entry: Measurement | undefined, hi = false) {
  if (entry?.status === 'RECORDED') return `${entry.value} ${entry.unit ?? ''}`.trim()
  if (entry?.status === 'HIGH')
    return hi ? 'ज़्यादा — कर्मचारी का आकलन' : 'High — staff observation'
  if (entry?.status === 'LOW') return hi ? 'कम — कर्मचारी का आकलन' : 'Low — staff observation'
  if (entry?.status === 'UNABLE_TO_OBTAIN') return hi ? 'माप नहीं मिल सका' : 'Not obtained'
  return hi ? 'माप नहीं लिया' : 'Not measured'
}
const units: Record<VitalKey, string> = {
  temperature_c: '°C',
  pr: 'beats/min',
  sbp: 'mmHg',
  dbp: 'mmHg',
  spo2: '%',
  rr: 'breaths/min',
  rbs: 'mg/dL',
}
export function Badge({ priority }: { priority: Priority }) {
  return (
    <span className={'priority-badge ' + priority.toLowerCase()}>
      <span aria-hidden="true" />
      {priority[0] + priority.slice(1).toLowerCase()}
    </span>
  )
}
export function waitTime(registered: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(registered).getTime()) / 60000))
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
export function hasUrgentAlert(a: Assessment) {
  return a.red_flags.length > 0 || !!a.ai_immediate || !!a.retained_ai_alert
}
export function aiStatusLabel(a: Assessment) {
  const states: Record<string, string> = {
    DISABLED: 'Local rules · AI off',
    NOT_REQUESTED: 'Demo seed · local assessment',
    PENDING: 'AI assessment pending · provisional priority',
    UNAVAILABLE: 'AI unavailable · staff attention needed',
    SUPERSEDED: 'AI result superseded · reassess if needed',
    SKIPPED_SAFETY: 'Immediate source rule · AI skipped',
    SKIPPED_OVERRIDE: 'Staff priority preserved · AI skipped',
  }
  if (a.ai_status === 'COMPLETE')
    return a.ai_proposal?.applied === false
      ? 'AI checked · guard retained priority'
      : 'AI assessment complete'
  return states[a.ai_status] ?? 'Assessment status unknown'
}
export function PatientCard({
  patient: p,
  onOpen,
  onVitals,
  onReview,
}: {
  patient: Patient
  onOpen: (id: string) => void
  onReview: (id: string) => void
  onVitals: (id: string) => void
}) {
  return (
    <article className={'patient-card ' + p.priority.toLowerCase()}>
      <button
        className="patient-card-main"
        onClick={() => onOpen(p.id)}
        aria-label={`Open token ${p.token}, ${p.name}`}
      >
        <div className="card-top">
          <span className="token">#{p.token}</span>
          <span className="wait">
            <Clock3 size={13} />
            {waitTime(p.registered_at)}
          </span>
        </div>
        <h3>{p.name}</h3>
        <p className="demographics">
          {p.age} years · {p.sex.toLowerCase().replace('_', ' ')}
        </p>
        <p className="complaint">
          {p.confirmed_text ||
            p.input.selected_symptom_labels?.map((item) => item.en).join('; ') ||
            (p.assessment.staff_decision?.kind === 'STAFF_ASSESSED_EMERGENCY'
              ? 'Staff assessed emergency before symptom intake'
              : 'Symptoms selected by checkbox')}
        </p>
        <p className="card-reason">{p.assessment.staff_decision?.reason ?? p.assessment.reason}</p>
        <p className="ai-status-label">{aiStatusLabel(p.assessment)}</p>
        <div className="card-tags">
          {p.input.demo_scenario && <span className="tag">Override practice · scripted</span>}
          {p.unresolved && (
            <span className="tag unresolved">
              <AlertTriangle size={12} />
              Unresolved
            </span>
          )}
          {p.override_active && <span className="tag">Staff override</span>}
          {hasUrgentAlert(p.assessment) && p.priority !== 'IMMEDIATE' && (
            <span className="tag unresolved">Safety alert retained</span>
          )}
        </div>
        <span className="card-link">
          View assessment <span aria-hidden="true">↗</span>
        </span>
      </button>
      <div className="card-vitals">
        <MissingVitals vitals={p.vitals} compact />
        <button
          className="secondary quick-vitals-button"
          onClick={() => onVitals(p.id)}
          aria-label={`Record available vitals for token ${p.token}`}
        >
          <HeartPulse size={16} aria-hidden="true" /> Record available vitals
        </button>
        <button
          className="secondary doctor-review-button"
          onClick={() => onReview(p.id)}
          aria-label={`${p.unresolved ? 'Open doctor review' : 'Request doctor review'} for token ${p.token}`}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          {p.unresolved ? 'Doctor review requested · Unresolved' : 'Request doctor review'}
        </button>
      </div>
    </article>
  )
}
export function missingVitalKeys(vitals: Vitals): VitalKey[] {
  return (Object.keys(vitalLabels) as VitalKey[]).filter(
    (key) => vitals[key]?.status !== 'RECORDED' || vitals[key]?.value == null,
  )
}

export function MissingVitals({ vitals, compact = false }: { vitals: Vitals; compact?: boolean }) {
  const missing = missingVitalKeys(vitals)
  const qualitative = missing.filter((key) => ['HIGH', 'LOW'].includes(vitals[key]?.status ?? ''))
  const notMeasured = missing.filter(
    (key) => vitals[key]?.status !== 'UNABLE_TO_OBTAIN' && !qualitative.includes(key),
  )
  const unavailable = missing.filter((key) => vitals[key]?.status === 'UNABLE_TO_OBTAIN')
  if (!missing.length)
    return <p className="vitals-complete">All measurement fields have recorded values.</p>
  return (
    <div className={`missing-vitals ${compact ? 'compact' : ''}`}>
      <strong>
        {missing.length === 7 && !qualitative.length
          ? 'Vitals not yet recorded'
          : `${missing.length} numeric measurement ${missing.length === 1 ? 'field' : 'fields'} missing`}
      </strong>
      {notMeasured.length > 0 && (
        <p>Not measured: {notMeasured.map((key) => vitalLabels[key]).join(', ')}.</p>
      )}
      {unavailable.length > 0 && (
        <p>Unable to obtain: {unavailable.map((key) => vitalLabels[key]).join(', ')}.</p>
      )}
      {qualitative.length > 0 && (
        <p>
          Staff observations:{' '}
          {qualitative
            .map((key) => `${vitalLabels[key]}: ${measurementLabel(vitals[key])}`)
            .join('; ')}
          . Numeric readings remain unknown.
        </p>
      )}
      {!compact && (
        <p>
          Missing values remain unknown. Record what is available; you do not need to complete every
          field.
        </p>
      )}
    </div>
  )
}

export function VitalEditor({
  value,
  onChange,
  saved,
  idPrefix = 'vital',
  hi = false,
  registration = false,
}: {
  value: Vitals
  onChange: (v: Vitals) => void
  saved?: Vitals
  idPrefix?: string
  hi?: boolean
  registration?: boolean
}) {
  const labels = hi ? vitalLabelsHi : vitalLabels
  return (
    <div className="vital-editor">
      {(registration
        ? ([...requiredRegistrationVitals, 'sbp', 'dbp', 'rr', 'rbs'] as VitalKey[])
        : (Object.keys(vitalLabels) as VitalKey[])
      ).map((key) => (
        <div className="vital-entry" key={key}>
          <label htmlFor={`${idPrefix}-${key}`}>
            {labels[key]} <small>{units[key]}</small>
            {registration && requiredRegistrationVitals.includes(key) && (
              <small className="required-vital">{hi ? 'ज़रूरी' : 'Required'}</small>
            )}
          </label>
          <input
            id={`${idPrefix}-${key}`}
            type="number"
            step="any"
            min={key === 'temperature_c' ? -273.15 : 0}
            max={key === 'spo2' ? 100 : undefined}
            value={value[key]?.value ?? ''}
            placeholder={hi ? 'दर्ज नहीं' : 'Not entered'}
            aria-describedby={saved ? `${idPrefix}-${key}-saved` : undefined}
            disabled={!!value[key] && value[key]?.status !== 'RECORDED'}
            onChange={(e) => {
              const next = { ...value }
              if (e.target.value === '') delete next[key]
              else next[key] = { value: Number(e.target.value), status: 'RECORDED' }
              onChange(next)
            }}
          />
          <label className="sr-only" htmlFor={`${idPrefix}-status-${key}`}>
            {labels[key]} {hi ? 'माप की स्थिति' : 'measurement status'}
          </label>
          <select
            id={`${idPrefix}-status-${key}`}
            value={value[key]?.status ?? 'RECORDED'}
            onChange={(e) => {
              const status = e.target.value as Measurement['status']
              const next = { ...value }
              if (status === 'RECORDED') delete next[key]
              else next[key] = { value: null, status }
              onChange(next)
            }}
          >
            <option value="RECORDED">
              {hi ? 'संख्यात्मक माप दर्ज करें' : 'Enter numeric value'}
            </option>
            {registration && (key === 'temperature_c' || key === 'pr') && (
              <>
                <option value="HIGH">{hi ? 'ज़्यादा (High)' : 'High'}</option>
                <option value="LOW">{hi ? 'कम (Low)' : 'Low'}</option>
              </>
            )}
            {(!registration || !requiredRegistrationVitals.includes(key)) && (
              <option value="NOT_MEASURED">{hi ? 'माप नहीं लिया' : 'Not measured'}</option>
            )}
            {(!registration || !requiredRegistrationVitals.includes(key)) && (
              <option value="UNABLE_TO_OBTAIN">{hi ? 'माप नहीं मिल सका' : 'Not obtained'}</option>
            )}
          </select>
          {saved && (
            <small className="saved-vital" id={`${idPrefix}-${key}-saved`}>
              Saved: {measurementLabel(saved[key], hi)}
              {saved[key]?.measured_at &&
                ` · ${new Date(saved[key]!.measured_at!).toLocaleString('en-IN')}`}
            </small>
          )}
        </div>
      ))}
    </div>
  )
}
