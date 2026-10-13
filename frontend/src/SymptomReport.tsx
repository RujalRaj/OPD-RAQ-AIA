import { useEffect, useState } from 'react'
import { api, post } from './api'
import type { Patient, SymptomLabel } from './types'

type Translation = {
  status: 'NOT_REQUESTED' | 'PENDING' | 'COMPLETE' | 'UNAVAILABLE' | 'EMPTY'
  text: string
  source_language: string
  target_language: string
  provider: string
  model: string
  error: string | null
}

export default function SymptomReport({
  patient,
  selections,
}: {
  patient: Patient
  selections: SymptomLabel[]
}) {
  const [translation, setTranslation] = useState<Translation | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const hindi = patient.input.language === 'hi-IN'
  const originalLanguage = hindi ? 'hi' : 'en'
  const targetLanguage = hindi ? 'en' : 'hi'
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    setTranslation(null)
    setFailed(false)
    async function request(start: boolean) {
      try {
        const endpoint = `/encounters/${patient.id}/translation`
        const result = start
          ? await post<Translation>(endpoint, {})
          : await api<Translation>(endpoint)
        if (cancelled) return
        setTranslation(result)
        if (result.status === 'PENDING') timer = setTimeout(() => void request(false), 1500)
      } catch {
        if (!cancelled) setFailed(true)
      }
    }
    void request(true)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [patient.id, attempt])
  const selected = (language: 'hi' | 'en') =>
    selections.length > 0 && (
      <div className="reported-selections">
        <p className="field-title">{language === 'hi' ? 'चुने गए लक्षण' : 'Selected symptoms'}</p>
        <ul lang={language}>
          {selections.map((item) => (
            <li key={item.id}>
              {item.section && <strong>{item.section[language]}: </strong>}
              {item[language]}
            </li>
          ))}
        </ul>
      </div>
    )
  return (
    <>
      <div className="symptom-language-grid">
        <section className="symptom-language-box" aria-label="Original symptoms">
          <h3>Original</h3>
          <p className="muted">{hindi ? 'Hindi' : 'English'} · original input preserved</p>
          {patient.original_text ? (
            <blockquote lang={originalLanguage}>{patient.original_text}</blockquote>
          ) : (
            <p className="muted">No original free-text or voice report.</p>
          )}
          {selected(originalLanguage)}
        </section>
        <section className="symptom-language-box translated" aria-label="Translated symptoms">
          <h3>Translated in {hindi ? 'English' : 'Hindi'}</h3>
          <div role="status" aria-live="polite">
            {translation?.status === 'COMPLETE' ? (
              <>
                <p className="muted">
                  {translation.provider === 'DEMO_PHRASEBOOK'
                    ? 'Prepared demo translation'
                    : 'Machine translation · check against the original'}
                </p>
                <blockquote lang={targetLanguage}>{translation.text}</blockquote>
              </>
            ) : failed || translation?.status === 'UNAVAILABLE' ? (
              <>
                <p>Text translation is unavailable. The original report is kept above.</p>
                <button className="text-button" onClick={() => setAttempt((value) => value + 1)}>
                  Retry translation
                </button>
              </>
            ) : translation?.status === 'EMPTY' ? (
              <p className="muted">No free-text or voice report to translate.</p>
            ) : (
              <p>Translating the original report…</p>
            )}
          </div>
          {selected(targetLanguage)}
          {selections.length > 0 && (
            <p className="muted">Checkbox labels use the bilingual catalog.</p>
          )}
        </section>
      </div>
      {selections.length > 0 && (
        <p className="muted">An unchecked option is not a confirmed absence.</p>
      )}
      <p className="field-title">Confirmed description & staff updates</p>
      <p className="preserve-text">
        {patient.confirmed_text || 'No free-text description provided.'}
      </p>
    </>
  )
}
