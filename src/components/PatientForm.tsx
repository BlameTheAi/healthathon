import { useState } from 'react'
import { getTranslation } from '../data/translations'
import type { LanguageCode, PatientDetails } from '../types/registration'
import { calculateAge } from '../utils/age'

type Props = {
  formData: PatientDetails
  setFormData: (data: PatientDetails) => void
  visitReason: string
  setVisitReason: (value: string) => void
  language: LanguageCode
  onContinue: () => void
  onLoadDemo: () => void
}

export const PatientForm = ({
  formData,
  setFormData,
  visitReason,
  setVisitReason,
  language,
  onContinue,
  onLoadDemo,
}: Props) => {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const t = (key: string) => getTranslation(language, key)

  const validate = () => {
    const nextErrors: Record<string, string> = {}

    if (!formData.name.trim()) nextErrors.name = t('nameRequired')
    if (!formData.date_of_birth.trim()) nextErrors.date_of_birth = t('dobRequired')
    else if (calculateAge(formData.date_of_birth) === null) nextErrors.date_of_birth = t('dobInvalid')
    if (!formData.gender.trim()) nextErrors.gender = t('genderRequired')
    if (!formData.phone.trim()) nextErrors.phone = t('phoneRequired')
    else if (!/^[0-9]{7,15}$/.test(formData.phone.replace(/\D/g, ''))) {
      nextErrors.phone = t('phoneInvalid')
    }
    if (!visitReason.trim()) nextErrors.visit_reason = t('visitReasonRequired')

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleFieldChange = (field: keyof PatientDetails, value: string) => {
    setFormData({ ...formData, [field]: value })
    setErrors((current) => ({ ...current, [field]: '' }))
  }
  const calculatedAge = calculateAge(formData.date_of_birth)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">{t('patientDetails')}</h2>
        <button
          type="button"
          className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700"
          onClick={onLoadDemo}
        >
          {t('loadDemoPatient')}
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">{t('fullName')}</span>
          <input
            value={formData.name}
            onChange={(event) => handleFieldChange('name', event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            placeholder={t('fullName')}
          />
          {errors.name && <span className="mt-2 block text-sm text-rose-600">{errors.name}</span>}
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">{t('dateOfBirth')}</span>
          <input
            type="date"
            value={formData.date_of_birth}
            onChange={(event) => handleFieldChange('date_of_birth', event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
          />
          {errors.date_of_birth && <span className="mt-2 block text-sm text-rose-600">{errors.date_of_birth}</span>}
        </label>

        <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3.5 text-sm text-slate-700">
          <span className="mb-1 block font-semibold">{t('age')}</span>
          {calculatedAge === null ? 'Enter a valid date of birth to calculate age.' : `${calculatedAge} years`}
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-slate-700">{t('gender')}</span>
          <select
            value={formData.gender}
            onChange={(event) => handleFieldChange('gender', event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
          >
            <option value="">Select</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
          </select>
          {errors.gender && <span className="mt-2 block text-sm text-rose-600">{errors.gender}</span>}
        </label>

        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">{t('phoneNumber')}</span>
          <input
            value={formData.phone}
            onChange={(event) => handleFieldChange('phone', event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            placeholder="9876543210"
          />
          {errors.phone && <span className="mt-2 block text-sm text-rose-600">{errors.phone}</span>}
        </label>

        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">{t('reasonTitle')}</span>
          <textarea
            value={visitReason}
            onChange={(event) => {
              setVisitReason(event.target.value)
              setErrors((current) => ({ ...current, visit_reason: '' }))
            }}
            className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
            placeholder={t('reasonTitle')}
          />
          {errors.visit_reason && <span className="mt-2 block text-sm text-rose-600">{errors.visit_reason}</span>}
        </label>

        <label className="block md:col-span-2">
          <span className="mb-2 block text-sm font-semibold text-slate-700">{t('preferredLanguage')}</span>
          <select
            value={formData.preferred_language}
            onChange={(event) => handleFieldChange('preferred_language', event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white"
          >
            <option value="English">English</option>
            <option value="Hindi">हिंदी</option>
            <option value="Gujarati">ગુજરાતી</option>
          </select>
        </label>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (validate()) onContinue()
          }}
          className="rounded-2xl bg-slate-900 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-800"
        >
          {t('next')}
        </button>
      </div>
    </div>
  )
}
