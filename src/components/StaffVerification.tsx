import { useState } from 'react'
import { verifyPatientRegistration, RegistrationQueueError } from '../services/registrationApi'
import type { PatientData, QueueRegistration } from '../types/registration'

type Props = {
  registration: QueueRegistration
  onCancel: () => void
  onVerified: (updated: QueueRegistration) => void
}

const TRIAGE_LEVELS = ['Routine', 'Moderate', 'Urgent'] as const

// Fields every registration is expected to have, shown with proper labels
// and controls. Anything else in patient_data (future AI-extracted fields)
// is still rendered, generically, below these.
const KNOWN_FIELDS: Array<{ key: string; label: string; multiline?: boolean }> = [
  { key: 'full_name', label: 'Patient Name' },
  { key: 'date_of_birth', label: 'Date of Birth' },
  { key: 'phone', label: 'Phone' },
  { key: 'age', label: 'Age' },
  { key: 'gender', label: 'Gender' },
  { key: 'visit_reason', label: 'Reason for Visit', multiline: true },
]

const formatFieldLabel = (key: string): string =>
  key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

export const StaffVerification = ({ registration, onCancel, onVerified }: Props) => {
  const [fields, setFields] = useState<PatientData>(registration.patient_data)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateField = (key: string, value: string) => {
    setFields((current) => ({ ...current, [key]: value }))
  }

  const extraKeys = Object.keys(fields).filter(
    (key) => key !== 'triage_level' && !KNOWN_FIELDS.some((field) => field.key === key),
  )

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await verifyPatientRegistration(registration.id, fields)
      onVerified(updated)
    } catch (err) {
      setError(err instanceof RegistrationQueueError ? err.message : 'Could not save this verification.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Verify Patient Record</h2>
        <p className="text-sm text-slate-500">
          Confirm the details captured at the kiosk. Edit any field before saving if needed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {KNOWN_FIELDS.map(({ key, label, multiline }) => (
          <label
            key={key}
            className={`block rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
              multiline ? 'sm:col-span-2' : ''
            }`}
          >
            {label}
            {multiline ? (
              <textarea
                value={fields[key] ?? ''}
                onChange={(event) => updateField(key, event.target.value)}
                rows={3}
                className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            ) : (
              <input
                value={fields[key] ?? ''}
                onChange={(event) => updateField(key, event.target.value)}
                className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-900 focus:border-slate-500 focus:outline-none"
              />
            )}
          </label>
        ))}

        <label className="block rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Triage Level
          <select
            value={fields.triage_level ?? 'Routine'}
            onChange={(event) => updateField('triage_level', event.target.value)}
            className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-900 focus:border-slate-500 focus:outline-none"
          >
            {TRIAGE_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>

        {extraKeys.map((key) => (
          <label
            key={key}
            className="block rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {formatFieldLabel(key)}
            <input
              value={fields[key] ?? ''}
              onChange={(event) => updateField(key, event.target.value)}
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal normal-case text-slate-900 focus:border-slate-500 focus:outline-none"
            />
          </label>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={saving}
          className="rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Confirm & Save'}
        </button>
      </div>
    </div>
  )
}
