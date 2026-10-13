import { useState } from 'react'
import { ChevronDown, LockKeyhole, X } from 'lucide-react'
import type { Catalog } from './types'

export default function SymptomPicker({
  catalog,
  hi,
  value,
  onChange,
}: {
  catalog: Catalog
  hi: boolean
  value: string[]
  onChange: (value: string[]) => void
}) {
  const [open, setOpen] = useState<string[]>([])
  const t = (en: string, hindi: string) => (hi ? hindi : en)
  const label = (item: { en: string; hi: string }) => (hi ? item.hi : item.en)
  const options = catalog.patient_options.filter((item) => !item.hidden)
  const chosen = catalog.patient_options.filter((item) => value.includes(item.id))
  const groups = catalog.patient_groups || []
  return (
    <div className="symptom-picker">
      <div className="picker-heading">
        <h2>{t('Where do you need help?', 'किस परेशानी के लिए मदद चाहिए?')}</h2>
      </div>
      <p className="picker-hint" id="section-instructions">
        {t(
          'Tick a section to open its choices, then select only the symptoms that apply. Closing a section keeps your selections.',
          'विकल्प देखने के लिए किसी खंड पर टिक करें, फिर केवल अपने लक्षण चुनें। खंड बंद करने पर चुने हुए लक्षण बने रहेंगे।',
        )}
      </p>
      <div className="symptom-sections" aria-describedby="section-instructions">
        {groups.map((group, index) => {
          const expanded = open.includes(group.id)
          const children = options.filter((item) => item.group === group.id)
          const count = children.filter((item) => value.includes(item.id)).length
          return (
            <section key={group.id} className={`symptom-section ${expanded ? 'expanded' : ''}`}>
              <h3>
                <label className="symptom-section-toggle">
                  <input
                    type="checkbox"
                    checked={expanded}
                    aria-controls={`section-${group.id}`}
                    aria-expanded={expanded}
                    onChange={(event) =>
                      setOpen(
                        event.target.checked
                          ? [...open, group.id]
                          : open.filter((id) => id !== group.id),
                      )
                    }
                  />
                  <span className="symptom-section-title">
                    {index + 1}. {label(group)}
                  </span>
                  <ChevronDown size={19} aria-hidden="true" className={expanded ? 'turned' : ''} />
                </label>
              </h3>
              {count > 0 && (
                <p className="section-selected">
                  {count} {t('selected', 'चुने गए')}
                </p>
              )}
              <div
                id={`section-${group.id}`}
                hidden={!expanded}
                className="symptom-section-content"
              >
                {group.private_note && (
                  <p className="private-question-note">
                    <LockKeyhole size={18} aria-hidden="true" />
                    {label(group.private_note)}
                  </p>
                )}
                <fieldset>
                  <legend className="sr-only">{label(group)}</legend>
                  <div className="symptom-grid">
                    {children.map((option) => (
                      <label
                        className={
                          'symptom-option ' + (value.includes(option.id) ? 'selected' : '')
                        }
                        key={option.id}
                      >
                        <input
                          type="checkbox"
                          checked={value.includes(option.id)}
                          onChange={(event) =>
                            onChange(
                              event.target.checked
                                ? [...value, option.id]
                                : value.filter((id) => id !== option.id),
                            )
                          }
                        />
                        <span>{label(option)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </section>
          )
        })}
      </div>
      <div className="symptom-selections">
        <p role="status" aria-live="polite">
          {t('Selected symptoms', 'चुने हुए लक्षण')} · {value.length}
        </p>
        {chosen.length > 0 && (
          <ul aria-label={t('Selected symptoms', 'चुने हुए लक्षण')}>
            {chosen.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  aria-label={t(`Remove ${option.en}`, `${option.hi} हटाएँ`)}
                  onClick={() => onChange(value.filter((id) => id !== option.id))}
                >
                  {label(option)}
                  <X size={15} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
