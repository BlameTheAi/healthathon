import { getTranslation } from '../data/translations'
import type { LanguageCode, PatientDetails, QuestionAnswerMap, QuestionConfig } from '../types/registration'
import { getQuestionText } from '../utils/questionText'

type Props = {
  patient: PatientDetails
  questions: QuestionConfig[]
  answers: QuestionAnswerMap
  language: LanguageCode
  onEdit: (section: 'patient' | 'visit') => void
  onSubmit: () => void
}

export const ReviewScreen = ({ patient, questions, answers, language, onEdit, onSubmit }: Props) => {
  const t = (key: string) => getTranslation(language, key)

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold text-slate-900">{t('reviewTitle')}</h2>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-2xl font-semibold text-slate-900">{t('patientInfo')}</h3>
          <button type="button" className="text-sm font-semibold text-teal-700" onClick={() => onEdit('patient')}>
            {t('edit')}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div><p className="text-sm text-slate-500">{t('fullName')}</p><p className="font-medium text-slate-900">{patient.name}</p></div>
          <div><p className="text-sm text-slate-500">{t('age')}</p><p className="font-medium text-slate-900">{patient.age}</p></div>
          <div><p className="text-sm text-slate-500">{t('gender')}</p><p className="font-medium text-slate-900">{patient.gender}</p></div>
          <div><p className="text-sm text-slate-500">{t('phoneNumber')}</p><p className="font-medium text-slate-900">{patient.phone}</p></div>
          <div className="md:col-span-2"><p className="text-sm text-slate-500">{t('preferredLanguage')}</p><p className="font-medium text-slate-900">{patient.preferred_language}</p></div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-2xl font-semibold text-slate-900">{t('visitInfo')}</h3>
          <button type="button" className="text-sm font-semibold text-teal-700" onClick={() => onEdit('visit')}>
            {t('edit')}
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">{t('reasonTitle')}</p>
            <p className="mt-1 font-medium text-slate-900">{String(answers.visit_reason?.answer ?? '—')}</p>
          </div>

          {questions
            .filter((question) => question.enabled && question.id !== 'visit_reason')
            .map((question) => (
              <div key={question.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">{getQuestionText(question, language)}</p>
                <p className="mt-1 font-medium text-slate-900">{String(answers[question.id]?.answer ?? '—')}</p>
              </div>
            ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-2xl bg-slate-900 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-800"
        >
          {t('continueToReview')}
        </button>
      </div>
    </div>
  )
}
