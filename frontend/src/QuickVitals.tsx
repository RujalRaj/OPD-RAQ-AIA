import { useEffect, useRef, useState } from 'react'
import { HeartPulse, X } from 'lucide-react'
import { api, post } from './api'
import { aiStatusLabel, Badge, hasUrgentAlert, MissingVitals, VitalEditor } from './components'
import type { Patient, Vitals } from './types'

export default function QuickVitals({
  initial,
  onClose,
  onSaved,
}: {
  initial: Patient
  onClose: () => void
  onSaved: (patient: Patient) => void
}) {
  const [patient, setPatient] = useState(initial)
  const [vitals, setVitals] = useState<Vitals>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const saving = useRef(false)
  useEffect(() => {
    const element = dialog.current!
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    heading.current?.focus()
    return () => {
      element.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  async function save() {
    if (saving.current || !Object.keys(vitals).length) return
    saving.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      // The existing authenticated endpoint handles audit, source checks and overrides.
      const updated = await post<Patient>(`/encounters/${patient.id}/vitals`, {
        version: patient.version,
        vitals,
      })
      onSaved(updated)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  async function reload() {
    setBusy(true)
    setError('')
    try {
      setPatient(await api<Patient>(`/encounters/${patient.id}`))
      setNotice('Saved readings refreshed. Your unsaved entries remain; check them before saving.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      className="quick-vitals-dialog"
      aria-labelledby="quick-vitals-heading"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <header className="quick-vitals-heading">
        <div>
          <p className="eyebrow">STAFF OBSERVATIONS · TOKEN #{patient.token}</p>
          <h2 id="quick-vitals-heading" ref={heading} tabIndex={-1}>
            Record available vitals
          </h2>
          <p>
            {patient.name} · {patient.age} years
          </p>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close vitals entry"
        >
          <X size={22} />
        </button>
      </header>
      <div className="quick-vitals-scroll">
        <div className="quick-vitals-status">
          <Badge priority={patient.priority} />
          <span>{aiStatusLabel(patient.assessment)}</span>
        </div>
        {hasUrgentAlert(patient.assessment) && (
          <p className="alert urgent" role="alert">
            An urgent assessment alert is already active. Notify the nurse or doctor for assessment.
          </p>
        )}
        {patient.override_active && (
          <p className="alert info">
            A staff override controls this priority. Saving measurements preserves that decision.
          </p>
        )}
        <MissingVitals vitals={patient.vitals} />
        <p className="muted">
          Enter new readings below. Leave a field untouched to keep its saved value or status. This
          action records observations, not a staff priority override.
        </p>
        <form
          id="quick-vitals-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <fieldset disabled={busy}>
            <legend className="sr-only">New measurements</legend>
            <VitalEditor
              value={vitals}
              onChange={setVitals}
              saved={patient.vitals}
              idPrefix="quick-vital"
            />
          </fieldset>
          {error && (
            <div className="alert error" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="text-button"
                onClick={() => void reload()}
                disabled={busy}
              >
                Reload saved readings
              </button>
            </div>
          )}
          {notice && <p role="status">{notice}</p>}
        </form>
      </div>
      <footer className="quick-vitals-actions">
        <button
          className="primary"
          type="submit"
          form="quick-vitals-form"
          disabled={busy || !Object.keys(vitals).length}
        >
          <HeartPulse size={18} aria-hidden="true" />
          {busy ? 'Saving…' : 'Save & reassess'}
        </button>
        <button className="secondary" type="button" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </footer>
    </dialog>
  )
}
