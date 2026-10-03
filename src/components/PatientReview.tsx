import type { PatientDetails, QuestionConfig } from '../types/registration'
import { calculateAge } from '../utils/age'

type Props = {
  patient: PatientDetails
  questions: QuestionConfig[]
  extracted: Record<string, string | boolean | number>
  onPatientUpdate: (fields: Partial<PatientDetails>) => void
  onExtractedChange: (fields: Record<string, string | boolean | number>) => void
  onSubmit: () => void
  isSubmitting: boolean
  submitError: string | null
}

const CORE_FIELDS = new Set([
  'full_name',
  'date_of_birth',
  'gender',
  'phone',
  'visit_reason',
])

type ReviewFieldKey = Exclude<keyof PatientDetails, 'age'> | 'visit_reason'

const REVIEW_FIELDS: Array<{
  key: ReviewFieldKey
  label: string
  type?: string
  multiline?: boolean
}> = [
  { key: 'name', label: 'Full name' },
  { key: 'date_of_birth', label: 'Date of birth', type: 'date' },
  { key: 'gender', label: 'Gender' },
  { key: 'phone', label: 'Mobile number', type: 'tel' },
  { key: 'visit_reason', label: 'Reason for visit', multiline: true },
]

export const PatientReview = ({
  patient,
  questions,
  extracted,
  onPatientUpdate,
  onExtractedChange,
  onSubmit,
  isSubmitting,
  submitError,
}: Props) => {
  const updateField = (key: ReviewFieldKey, value: string) => {
    if (key === 'name') {
      onPatientUpdate({ name: value })
      onExtractedChange({ ...extracted, full_name: value })
    } else if (key === 'date_of_birth') {
      onPatientUpdate({ date_of_birth: value })
      onExtractedChange({ ...extracted, date_of_birth: value })
    } else if (key === 'gender') {
      onPatientUpdate({ gender: value })
      onExtractedChange({ ...extracted, gender: value })
    } else if (key === 'phone') {
      onPatientUpdate({ phone: value })
      onExtractedChange({ ...extracted, phone: value })
    } else {
      onExtractedChange({ ...extracted, visit_reason: value })
    }
  }

  const additionalFields = Object.keys(extracted).filter((fieldId) => !CORE_FIELDS.has(fieldId))
  const dateOfBirth = patient.date_of_birth || String(extracted.date_of_birth ?? '')
  const age = calculateAge(dateOfBirth)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-800">Final review</p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-900">Check your details</h2>
        <p className="mt-2 text-slate-600">
          Review everything below. You can change any answer before sending your registration to the front desk.
        </p>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
        {REVIEW_FIELDS.map(({ key, label, type, multiline }) => {
          const value =
            key === 'name'
              ? patient.name || String(extracted.full_name ?? '')
              : key === 'date_of_birth'
                ? patient.date_of_birth || String(extracted.date_of_birth ?? '')
                : key === 'gender'
                    ? patient.gender || String(extracted.gender ?? '')
                    : key === 'phone'
                      ? patient.phone || String(extracted.phone ?? '')
                      : String(extracted.visit_reason ?? '')

          return (
            <label
              key={key}
              className={`block text-sm font-semibold text-slate-700 ${multiline ? 'sm:col-span-2' : ''}`}
            >
              {label}
              {multiline ? (
                <textarea
                  value={value}
                  onChange={(event) => updateField(key, event.target.value)}
                  rows={3}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none focus:border-teal-500"
                />
              ) : (
                <input
                  type={type ?? 'text'}
                  min={type === 'number' ? 1 : undefined}
                  max={type === 'number' ? 120 : undefined}
                  value={value}
                  onChange={(event) => updateField(key, event.target.value)}
                  className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none focus:border-teal-500"
                />
              )}
            </label>
          )
        })}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
          Age
          <p className="mt-2 font-normal text-slate-900">
            {age === null ? 'Enter a valid date of birth to calculate age.' : `${age} years (calculated from date of birth)`}
          </p>
        </div>

        <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
          Preferred language
          <select
            value={patient.preferred_language}
            onChange={(event) => onPatientUpdate({ preferred_language: event.target.value })}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none focus:border-teal-500"
          >
            <option value="English">English</option>
            <option value="Hindi">हिंदी</option>
            <option value="Gujarati">ગુજરાતી</option>
          </select>
        </label>

        {additionalFields.map((fieldId) => {
          const question = questions.find((item) => item.id === fieldId)
          const label = !question
            ? fieldId.replace(/_/g, ' ')
            : typeof question.question === 'string'
              ? question.question
              : question.question.en || fieldId.replace(/_/g, ' ')
          return (
            <label key={fieldId} className="block text-sm font-semibold text-slate-700 sm:col-span-2">
              {label}
              <textarea
                value={String(extracted[fieldId] ?? '')}
                onChange={(event) =>
                  onExtractedChange({ ...extracted, [fieldId]: event.target.value })
                }
                rows={2}
                className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-normal text-slate-900 outline-none focus:border-teal-500"
              />
            </label>
          )
        })}
      </div>

      {submitError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {submitError}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? 'Sending…' : submitError ? 'Retry submission' : 'Confirm and submit'}
        </button>
      </div>
    </div>
  )
}
