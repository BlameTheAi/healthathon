import { useMemo, useState } from 'react'
import { LanguageSelector } from '../components/LanguageSelector'
import { PatientForm } from '../components/PatientForm'
import { PatientReview } from '../components/PatientReview'
import { ProgressBar } from '../components/ProgressBar'
import { QuestionFlow } from '../components/QuestionFlow'
import { RegistrationConversation } from '../components/RegistrationConversation'
import { getTranslation } from '../data/translations'
import type {
  InputMethod,
  ConversationTurn,
  LanguageCode,
  PatientInputRecord,
  PatientDetails,
  QuestionAnswerMap,
  QuestionConfig,
  ScreenName,
  SpeechLanguageCode,
} from '../types/registration'

type Props = {
  language: LanguageCode
  setLanguage: (value: LanguageCode) => void
  patient: PatientDetails
  setPatient: (value: PatientDetails) => void
  questions: QuestionConfig[]
  answers: QuestionAnswerMap
  setAnswer: (id: string, value: string | boolean | number, inputMethod?: InputMethod, answerLanguage?: SpeechLanguageCode) => void
  conversation: ConversationTurn[]
  onConversationChange: (value: ConversationTurn[]) => void
  patientInputs: PatientInputRecord[]
  onPatientInputsChange: (value: PatientInputRecord[]) => void
  aiExtracted: Record<string, string | boolean | number>
  onAiExtractedChange: (value: Record<string, string | boolean | number>) => void
  submitError: string | null
  isSubmitting: boolean
  onPatientUpdate: (fields: Partial<PatientDetails>) => void
  onComplete: () => void
  onSubmitRegistration: () => void
  onBack: () => void
  onReview: () => void
  currentScreen: ScreenName
  onLoadDemo: () => void
}

export const Registration = ({
  language,
  setLanguage,
  patient,
  setPatient,
  questions,
  answers,
  setAnswer,
  conversation,
  onConversationChange,
  patientInputs,
  onPatientInputsChange,
  aiExtracted,
  onAiExtractedChange,
  submitError,
  isSubmitting,
  onPatientUpdate,
  onComplete,
  onSubmitRegistration,
  onBack,
  onReview,
  currentScreen,
  onLoadDemo,
}: Props) => {
  const t = (key: string) => getTranslation(language, key)
  const [manualDetails, setManualDetails] = useState(false)

  const currentStep = useMemo(() => {
    if (currentScreen === 'language') return 0
    if (currentScreen === 'details') return 1
    if (currentScreen === 'reason' || currentScreen === 'questions') return 2
    if (currentScreen === 'review') return 4
    return 0
  }, [currentScreen])

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <ProgressBar currentStep={currentStep} language={language} />

      <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6 shadow-[0_12px_40px_rgba(15,23,42,0.04)] sm:p-8">
        {currentScreen === 'language' && (
          <div className="space-y-5">
            <LanguageSelector language={language} onSelect={setLanguage} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onComplete}
                className="rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800"
              >
                {t('next')}
              </button>
            </div>
          </div>
        )}

        {currentScreen === 'details' &&
          (manualDetails ? (
            <PatientForm
              formData={patient}
              setFormData={setPatient}
              visitReason={String(aiExtracted.visit_reason ?? '')}
              setVisitReason={(value) => onAiExtractedChange({ ...aiExtracted, visit_reason: value })}
              language={language}
              onContinue={onComplete}
              onLoadDemo={onLoadDemo}
            />
          ) : (
            <>
              <RegistrationConversation
                language={language}
                patient={patient}
                questions={questions}
                answers={answers}
                onAnswer={setAnswer}
                conversation={conversation}
                onConversationChange={onConversationChange}
                patientInputs={patientInputs}
                onPatientInputsChange={onPatientInputsChange}
                aiExtracted={aiExtracted}
                onAiExtractedChange={onAiExtractedChange}
                onPatientUpdate={onPatientUpdate}
                onComplete={onComplete}
              />
              <div className="mt-4 flex justify-center gap-4 text-xs text-slate-400">
                <button type="button" className="underline" onClick={() => setManualDetails(true)}>
                  Prefer to fill this in by hand?
                </button>
                <button type="button" className="underline" onClick={onLoadDemo}>
                  {t('loadDemoPatient')}
                </button>
              </div>
            </>
          ))}

        {currentScreen === 'reason' && (
          <RegistrationConversation
            language={language}
            patient={patient}
            questions={questions}
            answers={answers}
            onAnswer={setAnswer}
            conversation={conversation}
            onConversationChange={onConversationChange}
            patientInputs={patientInputs}
            onPatientInputsChange={onPatientInputsChange}
            aiExtracted={aiExtracted}
            onAiExtractedChange={onAiExtractedChange}
            onPatientUpdate={onPatientUpdate}
            onComplete={onReview}
          />
        )}

        {currentScreen === 'questions' && (
          <QuestionFlow
            questions={questions}
            answers={answers}
            language={language}
            onAnswerChange={setAnswer}
            onComplete={onReview}
            onBack={onBack}
          />
        )}

        {currentScreen === 'review' && (
          <PatientReview
            patient={patient}
            extracted={aiExtracted}
            questions={questions}
            onPatientUpdate={onPatientUpdate}
            onExtractedChange={onAiExtractedChange}
            onSubmit={onSubmitRegistration}
            isSubmitting={isSubmitting}
            submitError={submitError}
          />
        )}
      </div>
    </div>
  )
}
