import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, ShieldAlert } from 'lucide-react'
import { api, post } from './api'
import OverrideMeasurements from './OverrideMeasurements'
import SymptomReport from './SymptomReport'
import {
  aiStatusLabel,
  hasUrgentAlert,
  Badge,
  priorities,
  VitalEditor,
  vitalLabels,
  measurementLabel,
} from './components'
import type { Audit, Catalog, Patient, Priority, Staff, VitalKey, Vitals } from './types'

export default function PatientDetail({
  initial,
  focusReview = false,
  user,
  catalog,
  onClose,
  onChange,
}: {
  initial: Patient
  focusReview?: boolean
  user: Staff
  catalog: Catalog
  onClose: () => void
  onChange: () => void
}) {
  const [p, setP] = useState(initial),
    [vitals, setVitals] = useState<Vitals>({}),
    [priority, setPriority] = useState<Priority>(initial.priority),
    [reason, setReason] = useState(''),
    [reviewReason, setReviewReason] = useState(''),
    [newSymptoms, setNewSymptoms] = useState(''),
    [facts, setFacts] = useState<Record<string, boolean | null>>({}),
    [logs, setLogs] = useState<Audit[]>([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false)
  const [overrideVitals, setOverrideVitals] = useState<Vitals>({})
  const [overrideValid, setOverrideValid] = useState(true)
  const [overrideReset, setOverrideReset] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const reviewInput = useRef<HTMLTextAreaElement>(null)
  const measured = Object.values(overrideVitals).filter(
    (v) => v.status === 'RECORDED' && v.value !== null,
  ).length
  const canOverride = !!reason.trim() && overrideValid && (user.role === 'DOCTOR' || measured > 0)
  const selections =
    p.input.selected_symptom_labels ??
    catalog.patient_options.filter((option) => p.input.symptoms?.includes(option.id))
  const loadLogs = () =>
    api<Audit[]>(`/encounters/${p.id}/audit`)
      .then(setLogs)
      .catch(() => setError('Could not load audit history.'))
  useEffect(() => {
    if (focusReview) reviewInput.current?.focus()
    else heading.current?.focus()
    void loadLogs()
  }, [p.id, focusReview])
  useEffect(() => {
    if (p.assessment.ai_status !== 'PENDING') return
    let cancelled = false
    let refreshing = false
    const timer = setInterval(async () => {
      if (refreshing) return
      refreshing = true
      try {
        const updated = await api<Patient>(`/encounters/${p.id}`)
        if (!cancelled) {
          setP(updated)
          if (updated.assessment.ai_status !== 'PENDING') void loadLogs()
        }
      } catch {
        if (!cancelled)
          setError('Could not refresh the pending assessment. Refresh patient to check its status.')
      } finally {
        refreshing = false
      }
    }, 2000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [p.id, p.assessment.ai_status])
  async function action(endpoint: string, payload: unknown, message: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await post<Patient>(`/encounters/${p.id}/${endpoint}`, payload)
      setP(updated)
      setPriority(updated.priority)
      if (endpoint === 'reassess') setVitals({})
      if (endpoint === 'reassess') {
        setFacts({})
        setNewSymptoms('')
      }
      if (endpoint === 'override') {
        setReason('')
        setOverrideVitals({})
        setOverrideValid(true)
        setOverrideReset((value) => value + 1)
      }
      if (endpoint === 'unresolved' || endpoint === 'resolve') setReviewReason('')
      setNotice(message)
      void loadLogs()
      onChange()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="patient-detail">
      <button className="text-button" onClick={onClose}>
        <ArrowLeft size={17} />
        Back to dashboard
      </button>
      <header className="detail-heading">
        <div>
          <p className="eyebrow">PATIENT ASSESSMENT · {p.demo_id}</p>
          <h1 tabIndex={-1} ref={heading}>
            Token #{p.token} <span>{p.name}</span>
          </h1>
          <p>
            {p.age} years · {p.sex.toLowerCase()} · Pregnancy:{' '}
            {p.pregnancy_status.toLowerCase().replaceAll('_', ' ')}
          </p>
        </div>
        <Badge priority={p.priority} />
      </header>
      {p.input.demo_scenario && (
        <div className="alert info demo-scenario">
          <strong>{p.input.demo_scenario.title}</strong>
          <p>{p.input.demo_scenario.briefing}</p>
        </div>
      )}
      <div className="doctor-review-shortcut">
        <p>
          {p.unresolved
            ? `Doctor review requested · Unresolved: ${p.unresolved_reason}`
            : p.assessment.needs_staff_review || p.assessment.ai_status === 'UNAVAILABLE'
              ? 'The assessment needs staff attention. If you cannot assess this case, request doctor review.'
              : 'Need a doctor’s assessment? Request review with a reason; no measurement is required.'}
        </p>
        <button className="secondary" onClick={() => reviewInput.current?.focus()}>
          Go to doctor review
        </button>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
          <button
            className="text-button"
            onClick={() =>
              api<Patient>(`/encounters/${p.id}`)
                .then(setP)
                .catch((e) => setError(e.message))
            }
          >
            Refresh patient
          </button>
        </div>
      )}
      {notice && (
        <div className="alert success" role="status" aria-label="Staff action result">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {hasUrgentAlert(p.assessment) && (
        <div className="alert urgent">
          <ShieldAlert size={24} />
          <div>
            <strong>Immediate staff assessment requested</strong>
            <p>
              {p.assessment.red_flags.length > 0
                ? `Source safety rules: ${p.assessment.red_flags.map((r) => r.id).join(', ')}.`
                : 'An AI assessment suggested Immediate. This is a model suggestion, not a verified clinical finding.'}{' '}
              The original alert remains visible after a staff priority override.
            </p>
          </div>
          <button
            className="secondary"
            disabled={busy || p.alert_acknowledged}
            onClick={() =>
              action(
                'acknowledge',
                { version: p.version },
                'Alert acknowledged. Safety evidence is retained.',
              )
            }
          >
            {p.alert_acknowledged ? 'Acknowledged' : 'Acknowledge alert'}
          </button>
        </div>
      )}
      {p.unresolved && (
        <div className="alert warning">
          <AlertCircle size={21} />
          <div>
            <strong>Unresolved · Doctor review requested</strong>
            <p>{p.unresolved_reason}</p>
          </div>
        </div>
      )}
      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel">
            <div className="section-title">
              <h2>What the patient reported</h2>
              <span className="tag">{p.input.input_methods.join(' + ')}</span>
            </div>
            <SymptomReport patient={p} selections={selections} />
            <div className="history-grid">
              <div>
                <p className="field-title">Relevant history</p>
                <p>
                  {p.input.history_status === 'PROVIDED'
                    ? p.input.history
                    : p.input.history_status === 'NONE'
                      ? 'None reported'
                      : 'Not provided'}
                </p>
              </div>
              <div>
                <p className="field-title">Current medicines</p>
                <p>
                  {p.input.medication_status === 'PROVIDED'
                    ? p.input.medications
                    : p.input.medication_status === 'NONE'
                      ? 'None reported'
                      : 'Not provided'}
                </p>
              </div>
            </div>
            <details>
              <summary>
                Structured interpretation <ChevronDown size={16} />
              </summary>
              {p.assessment.structured_symptoms.length ? (
                <ul>
                  {p.assessment.structured_symptoms.map((s, i) => (
                    <li key={i}>
                      {selections.find((item) => item.id === s.name)?.en ||
                        catalog.facts.find((f) => f.id === s.name)?.label ||
                        s.name}
                      :{' '}
                      <strong>
                        {s.value === null ? 'Unknown' : s.value ? 'Reported' : 'Absent'}
                      </strong>
                      <small> · {String(s.evidence.quote || s.evidence.source)}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No supported phrase extracted. Original text remains available to staff.</p>
              )}
              {p.assessment.ambiguous_mentions.map((m, i) => (
                <p key={i}>
                  Not used as a positive finding: “{m.phrase}” (
                  {m.status.toLowerCase().replaceAll('_', ' ')}).
                </p>
              ))}
            </details>
          </section>
          <section className="panel">
            <h2>Available vitals</h2>
            <p className="muted">
              Missing measurements are unknown. They are never replaced with normal values.
            </p>
            <div className="vital-readings">
              {(Object.keys(vitalLabels) as VitalKey[]).map((key) => {
                const v = p.vitals[key]
                return (
                  <div key={key}>
                    <span>{vitalLabels[key]}</span>
                    <strong>{measurementLabel(v)}</strong>
                    {v?.measured_at && <small>{new Date(v.measured_at).toLocaleString()}</small>}
                  </div>
                )
              })}
            </div>
          </section>
          <section className="panel">
            <h2>Record observations</h2>
            <p className="muted">
              Enter the measurements relevant to your assessment. A nurse, intern or JR needs at
              least one recorded vital to override.
            </p>
            <VitalEditor value={vitals} onChange={setVitals} />
            <label>
              New symptom or observation
              <textarea
                value={newSymptoms}
                onChange={(e) => setNewSymptoms(e.target.value)}
                rows={2}
                maxLength={4000}
                placeholder="Describe what you observed…"
              />
            </label>
            <details>
              <summary>
                Clinical context & source-rule conditions <ChevronDown size={16} />
              </summary>
              <p className="muted">
                Confirm the complete condition. Unknown is not the same as absent. These are
                unvalidated demonstration rules.
              </p>
              <div className="context-grid">
                {catalog.facts.map((f) => (
                  <label key={f.id}>
                    {f.label}
                    <select
                      value={
                        f.id in facts ? String(facts[f.id]) : String(p.input.facts[f.id] ?? null)
                      }
                      onChange={(e) =>
                        setFacts((old) => ({
                          ...old,
                          [f.id]: e.target.value === 'null' ? null : e.target.value === 'true',
                        }))
                      }
                    >
                      <option value="null">Unknown / not assessed</option>
                      <option value="true">Present / confirmed</option>
                      <option value="false">Absent / not applicable</option>
                    </select>
                  </label>
                ))}
              </div>
            </details>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                action(
                  'reassess',
                  { version: p.version, vitals, new_symptoms: newSymptoms, facts },
                  'Observations saved and agent reassessed. Existing staff overrides are preserved.',
                )
              }
            >
              Save & reassess
            </button>
          </section>
          <section className="panel">
            <h2>Audit history</h2>
            <AuditList logs={logs} />
          </section>
        </div>
        <aside className="detail-side">
          {p.assessment.staff_decision && (
            <section className="panel">
              <p className="eyebrow">ACTIVE STAFF DECISION</p>
              <Badge priority={p.priority} />
              <h2>{p.assessment.staff_decision.reason}</h2>
              <p>
                Recorded by {p.assessment.staff_decision.actor}. Reassessment preserves this
                priority.
              </p>
            </section>
          )}
          <section className="panel assessment-panel">
            <p className="eyebrow">AGENT SUGGESTION</p>
            <Badge priority={p.assessment.suggested_priority} />
            <h2>{p.assessment.reason}</h2>
            <p className="muted">
              {['AI_WITH_SAFETY_GATE', 'OPENAI_WITH_SAFETY_GATE'].includes(p.assessment.source)
                ? `${p.assessment.ai_provider ?? 'OpenAI'} · ${p.assessment.model_version ?? 'model'} + source safety gate`
                : 'Local source rules / provisional demo routing'}
            </p>
            <p className="ai-status-label" role="status" aria-label="AI assessment status">
              {aiStatusLabel(p.assessment)}
            </p>
            {p.assessment.ai_status === 'PENDING' && (
              <p className="alert info">
                The displayed priority is provisional while AI is working. Staff may act
                immediately.
              </p>
            )}
            {p.assessment.carried_ai_priority && (
              <p className="alert info">
                The earlier AI priority ({p.assessment.carried_ai_priority.priority.toLowerCase()}){' '}
                remains active until a new assessment succeeds or staff change it.
              </p>
            )}
            {p.assessment.ai_proposal?.applied === false && (
              <p className="alert warning">
                AI proposed {p.assessment.ai_proposal.priority.toLowerCase()}, but a source rule,
                staff decision or incomplete context prevented applying it.
              </p>
            )}
            {p.assessment.needs_staff_review && (
              <p className="alert warning">
                Staff attention is needed. Missing information remains unknown.
              </p>
            )}
            {p.assessment.ai_status === 'UNAVAILABLE' && (
              <p className="alert warning">
                AI unavailable ({p.assessment.ai_error ?? 'provider error'}). No new AI decision was
                applied. Check the connection, then use Save & reassess to try again.
              </p>
            )}
            {p.assessment.policy_gap && (
              <p className="alert warning">
                {p.assessment.source === 'AI_WITH_SAFETY_GATE'
                  ? 'The source matrix does not fully cover this report. The displayed AI suggestion is not clinically validated.'
                  : 'Source coverage is incomplete. The displayed local priority is a demo fallback, not a validated clinical classification.'}
              </p>
            )}
            {p.assessment.triggered_rules.map((r) => (
              <div className="rule-evidence" key={r.id}>
                <strong>
                  Rule {r.id} · {r.domain}
                </strong>
                <p>{r.trigger}</p>
                <small>
                  Workbook: Safety Matrix, row {r.source_row}. Source attribution: {r.basis}.
                  Approval not established.
                </small>
              </div>
            ))}
            {p.override_active && (
              <p className="alert info">
                A staff override controls the current queue priority. Reassessment preserves that
                decision.
              </p>
            )}
          </section>
          <section className="panel override-panel">
            <h2>Change queue priority</h2>
            <fieldset disabled={busy}>
              <p className="muted">The token stays #{p.token}. Every change is recorded.</p>
              <label>
                New priority
                <select
                  aria-label="New priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  {priorities.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Reason for changing priority
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                  placeholder="Explain your observations and decision…"
                />
              </label>
              <OverrideMeasurements
                key={overrideReset}
                onChange={(entries, valid) => {
                  setOverrideVitals(entries)
                  setOverrideValid(valid)
                }}
              />
              {!overrideValid && (
                <p className="error">
                  Complete each selected measurement with a valid reading, or remove that row.
                </p>
              )}
              {user.role !== 'DOCTOR' && (
                <p className={'requirement ' + (measured ? 'met' : '')}>
                  {measured
                    ? `${measured} vital measurement(s) ready`
                    : 'Enter a reason and select at least one numeric reading in this box.'}
                </p>
              )}
              <button
                className="primary full-width"
                disabled={busy || !canOverride}
                onClick={() =>
                  action(
                    'override',
                    { version: p.version, priority, reason, vitals: overrideVitals },
                    'Staff priority applied. Token unchanged; audit recorded.',
                  )
                }
              >
                Apply staff override
              </button>
            </fieldset>
          </section>
          <section className="panel">
            <h2>
              {p.unresolved && user.role === 'DOCTOR'
                ? 'Resolve doctor review'
                : 'Doctor review (Unresolved)'}
            </h2>
            <label>
              {p.unresolved && user.role === 'DOCTOR'
                ? 'Doctor’s review note'
                : 'Reason for doctor review'}
              <textarea
                ref={reviewInput}
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                maxLength={2000}
                rows={3}
              />
            </label>
            <button
              className="secondary full-width"
              disabled={busy || !reviewReason.trim()}
              onClick={() =>
                action(
                  p.unresolved && user.role === 'DOCTOR' ? 'resolve' : 'unresolved',
                  { version: p.version, reason: reviewReason },
                  p.unresolved && user.role === 'DOCTOR'
                    ? 'Doctor review resolved.'
                    : 'Doctor review requested. Marked Unresolved; current priority is retained.',
                )
              }
            >
              {p.unresolved && user.role === 'DOCTOR' ? 'Resolve review' : 'Request doctor review'}
            </button>
            <p className="muted">
              The doctor can find this case in the Unresolved dashboard filter. No vital is required
              to request assistance. To change priority, use the override action.
            </p>
          </section>
        </aside>
      </div>
    </section>
  )
}

export function AuditList({ logs }: { logs: Audit[] }) {
  return (
    <div className="audit-list">
      {logs.length ? (
        logs.map((log) => (
          <details className="audit-item" key={log.id}>
            <summary>
              <span className="audit-dot" />
              <span>
                <strong>{log.type.replaceAll('_', ' ')}</strong>
                <small>
                  {log.actor} · {new Date(log.created_at).toLocaleString()}
                </small>
              </span>
            </summary>
            <pre>{JSON.stringify(log.payload, null, 2)}</pre>
          </details>
        ))
      ) : (
        <p className="muted">No audit events to display.</p>
      )}
    </div>
  )
}
