import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { vitalLabels } from './components'
import type { VitalKey, Vitals } from './types'

type Row = { id: number; type: VitalKey | ''; choice: string; custom: string }
const units: Record<VitalKey, string> = {
  temperature_c: '°C',
  spo2: '%',
  pr: 'beats/min',
  sbp: 'mmHg',
  dbp: 'mmHg',
  rr: 'breaths/min',
  rbs: 'mg/dL',
}
const choices: Record<VitalKey, number[]> = {
  temperature_c: [35, 35.5, 36, 36.5, 36.7, 37, 37.5, 38, 38.5, 39, 39.5, 40, 41],
  spo2: Array.from({ length: 31 }, (_, i) => 100 - i),
  pr: [40, 50, 60, 70, 80, 82, 90, 100, 110, 120, 130, 140, 150, 160],
  sbp: [80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 200],
  dbp: [40, 50, 60, 70, 80, 90, 100, 110, 120],
  rr: [10, 12, 14, 16, 18, 20, 22, 24, 25, 28, 30, 35, 40],
  rbs: [60, 70, 80, 90, 100, 110, 120, 140, 160, 180, 200, 250, 300],
}
export default function OverrideMeasurements({
  onChange,
}: {
  onChange: (vitals: Vitals, valid: boolean) => void
}) {
  const [rows, setRows] = useState<Row[]>([{ id: 1, type: '', choice: '', custom: '' }])
  function update(next: Row[]) {
    setRows(next)
    const vitals: Vitals = {}
    let valid = true
    for (const row of next) {
      if (!row.type) continue
      const text = row.choice === 'CUSTOM' ? row.custom : row.choice
      const value = Number(text)
      if (
        !text.trim() ||
        !Number.isFinite(value) ||
        value < (row.type === 'temperature_c' ? -273.15 : 0) ||
        (row.type === 'spo2' && value > 100)
      ) {
        valid = false
        continue
      }
      vitals[row.type] = { value, status: 'RECORDED' }
    }
    onChange(vitals, valid)
  }
  function edit(id: number, patch: Partial<Row>) {
    update(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }
  return (
    <div className="override-measurements">
      <h3>New vital measurements</h3>
      <p className="muted">
        Choose the measurement and its actual numeric reading, or enter another value. Saved
        readings are shown above for reference.
      </p>
      {rows.map((row, index) => (
        <div className="override-measurement-row" key={row.id}>
          <label>
            Type of measurement {index + 1}
            <select
              value={row.type}
              onChange={(e) =>
                edit(row.id, { type: e.target.value as VitalKey, choice: '', custom: '' })
              }
            >
              <option value="">Choose measurement</option>
              {(Object.keys(choices) as VitalKey[]).map((key) => (
                <option
                  key={key}
                  value={key}
                  disabled={rows.some((other) => other.id !== row.id && other.type === key)}
                >
                  {vitalLabels[key]} ({units[key]})
                </option>
              ))}
            </select>
          </label>
          <label>
            Value of measurement {index + 1}
            <select
              value={row.choice}
              disabled={!row.type}
              onChange={(e) => edit(row.id, { choice: e.target.value, custom: '' })}
            >
              <option value="">Choose reading</option>
              {row.type &&
                choices[row.type].map((value) => (
                  <option key={value} value={value}>
                    {value} {units[row.type as VitalKey]}
                  </option>
                ))}
              <option value="CUSTOM">Enter another value…</option>
            </select>
          </label>
          {row.choice === 'CUSTOM' && row.type && (
            <label>
              Numeric reading {index + 1} ({units[row.type]})
              <input
                type="number"
                step="any"
                min={row.type === 'temperature_c' ? -273.15 : 0}
                max={row.type === 'spo2' ? 100 : undefined}
                value={row.custom}
                onChange={(e) => edit(row.id, { custom: e.target.value })}
              />
            </label>
          )}
          <button
            type="button"
            className="text-button"
            aria-label={`Remove measurement ${index + 1}`}
            onClick={() => update(rows.filter((item) => item.id !== row.id))}
          >
            <X size={16} />
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={rows.length >= 7}
        onClick={() =>
          update([
            ...rows,
            { id: Math.max(0, ...rows.map((row) => row.id)) + 1, type: '', choice: '', custom: '' },
          ])
        }
      >
        <Plus size={17} />
        Add measurement
      </button>
    </div>
  )
}
