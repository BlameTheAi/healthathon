import { useEffect, useState } from 'react'
import { Header } from './components/Header'
import { RegistrationComplete } from './components/RegistrationComplete'
import { Welcome } from './pages/Welcome'
import { Registration } from './pages/Registration'
import { Staff } from './pages/Staff'
import { QuestionSettings } from './pages/QuestionSettings'
import type {
  InputMethod,
  ConversationTurn,
  LanguageCode,
  PatientInputRecord,
  PatientDetails,
  QuestionAnswer,
  QuestionAnswerMap,
  QuestionConfig,
  ScreenName,
  SpeechLanguageCode,
} from './types/registration'
import { getStoredLanguage, getStoredQuestions, saveStoredLanguage, saveStoredQuestions } from './utils/storage'
import { RegistrationQueueError, submitPendingRegistration } from './services/registrationApi'

const initialPatient: PatientDetails = {
  name: '',
  age: '',
  date_of_birth: '',
  gender: '',
  phone: '',
  preferred_language: 'Gujarati',
}

const getSpeechLanguage = (language: LanguageCode): SpeechLanguageCode => {
  if (language === 'hi') return 'hi-IN'
  if (language === 'gu') return 'gu-IN'
  return 'en-IN'
}

const createAnswer = (
  value: string,
  inputMethod: InputMethod = 'typed',
  language: LanguageCode = 'en',
): QuestionAnswer => ({
  answer: value,
  input_method: inputMethod,
  language: getSpeechLanguage(language),
})

const createEmptyAnswers = (questions: QuestionConfig[], language: LanguageCode = 'en'): QuestionAnswerMap => {
  const answers: QuestionAnswerMap = { visit_reason: createAnswer('', 'typed', language) }
  questions
    .filter((question) => question.enabled && question.id !== 'visit_reason')
    .forEach((question) => {
      answers[question.id] = createAnswer('', 'typed', language)
    })
  return answers
}

function App() {
  const [mode, setMode] = useState<'patient' | 'staff'>('patient')
  const [screen, setScreen] = useState<ScreenName>('welcome')
  const [language, setLanguageState] = useState<LanguageCode>(getStoredLanguage())
  const [patient, setPatient] = useState<PatientDetails>(initialPatient)
  const [questions, setQuestionsState] = useState<QuestionConfig[]>(() => getStoredQuestions())
  const [answers, setAnswers] = useState<QuestionAnswerMap>(() => createEmptyAnswers(getStoredQuestions(), getStoredLanguage()))
  const [conversation, setConversation] = useState<ConversationTurn[]>([])
  const [patientInputs, setPatientInputs] = useState<PatientInputRecord[]>([])
  const [aiExtracted, setAiExtracted] = useState<Record<string, string | boolean | number>>({})
  const [token, setToken] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    saveStoredLanguage(language)
  }, [language])

  useEffect(() => {
    saveStoredQuestions(questions)
    setAnswers((current) => {
      const next: QuestionAnswerMap = { ...current }
      next.visit_reason = current.visit_reason ?? createAnswer('', 'typed', language)
      questions
        .filter((question) => question.enabled && question.id !== 'visit_reason')
        .forEach((question) => {
          if (!(question.id in next)) {
            next[question.id] = createAnswer('', 'typed', language)
          }
        })
      return next
    })
  }, [questions, language])

  const updatePatientFields = (fields: Partial<PatientDetails>) => {
    setPatient((current) => ({ ...current, ...fields }))
  }

  const setLanguage = (nextLanguage: LanguageCode) => {
    setLanguageState(nextLanguage)
    const displayLanguage =
      nextLanguage === 'en' ? 'English' : nextLanguage === 'hi' ? 'Hindi' : 'Gujarati'

    setPatient((current) => ({
      ...current,
      preferred_language: displayLanguage,
    }))
  }

  const setQuestionAnswer = (
    id: string,
    value: string | boolean | number,
    inputMethod: InputMethod = 'typed',
    answerLanguage: SpeechLanguageCode = getSpeechLanguage(language),
  ) => {
    setAnswers((current) => ({
      ...current,
      [id]: {
        answer: value,
        input_method: inputMethod,
        language: answerLanguage,
      },
    }))
  }

  const resetRegistration = () => {
    setMode('patient')
    setScreen('welcome')
    setPatient(initialPatient)
    setAnswers(createEmptyAnswers(questions, language))
    setConversation([])
    setPatientInputs([])
    setAiExtracted({})
    setToken('')
    setSubmitError(null)
  }

  // Used once the hands-free voice conversation (or the manual fallback
  // form) has collected all mandatory registration information. This is
  // the Patient Kiosk half of the async queue workflow: it saves the
  // extracted data to the backend with status PENDING_VERIFICATION and
  // moves straight to the kiosk's own completion screen. It never shows
  // staff verification - that happens later, on the separate Staff
  // Dashboard device, once a staff member picks this record up from the
  // queue. The generic multi-question / review screens remain in the
  // codebase for later phases but are out of scope for the current
  // English-only voice registration demo.
  const finalizeRegistration = async () => {
    if (screen !== 'review' || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)

    const patientData = {
      full_name: patient.name.trim() || String(aiExtracted.full_name ?? ''),
      date_of_birth: patient.date_of_birth || String(aiExtracted.date_of_birth ?? ''),
      visit_reason: String(aiExtracted.visit_reason ?? '').trim(),
      phone: patient.phone || String(aiExtracted.phone ?? ''),
      gender: patient.gender || String(aiExtracted.gender ?? ''),
      preferred_language: patient.preferred_language,
    }

    try {
      const result = await submitPendingRegistration(patientData)
      setToken(result.token)
      setScreen('complete')
    } catch (error) {
      setToken('')
      setSubmitError(
        error instanceof RegistrationQueueError ? error.message : 'Could not reach the front desk system.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDemoLoad = () => {
    setPatient({
      name: 'Meera Shah',
      age: '52',
      date_of_birth: '1974-03-12',
      gender: 'Female',
      phone: '9876543210',
      preferred_language: 'English',
    })
    setAiExtracted({ visit_reason: 'Follow-up appointment' })
    setAnswers({
      full_name: createAnswer('Meera Shah', 'typed', language),
      date_of_birth: createAnswer('1974-03-12', 'typed', language),
      visit_reason: createAnswer('Follow-up appointment', 'typed', language),
      previous_visit: createAnswer('Yes', 'typed', language),
      previous_reports: createAnswer('Yes', 'typed', language),
      referral: createAnswer('No', 'typed', language),
    })
  }

  const renderScreen = () => {
    if (screen === 'settings') {
      return <QuestionSettings questions={questions} setQuestions={setQuestionsState} language={language} />
    }

    // The Staff Dashboard is a separate device in this workflow: it is
    // self-contained and polls the backend queue on its own, regardless of
    // whatever screen the Patient Kiosk happens to be on.
    if (mode === 'staff') {
      return <Staff />
    }

    if (screen === 'welcome') {
      return <Welcome language={language} onStart={() => setScreen('language')} />
    }

    if (screen === 'complete') {
      return (
        <RegistrationComplete
          patientName={patient.name || 'Patient'}
          token={token}
          submitError={submitError}
          onStartNew={resetRegistration}
        />
      )
    }

    return (
      <Registration
        language={language}
        setLanguage={setLanguage}
        patient={patient}
        setPatient={setPatient}
        questions={questions}
        answers={answers}
        setAnswer={setQuestionAnswer}
        conversation={conversation}
        onConversationChange={setConversation}
        patientInputs={patientInputs}
        onPatientInputsChange={setPatientInputs}
        aiExtracted={aiExtracted}
        onAiExtractedChange={setAiExtracted}
        submitError={submitError}
        isSubmitting={isSubmitting}
        onPatientUpdate={updatePatientFields}
        onComplete={() => {
          if (screen === 'language') setScreen('details')
          else if (screen === 'details') {
            setSubmitError(null)
            setScreen('review')
          } else if (screen === 'reason') setScreen('questions')
          else if (screen === 'questions') setScreen('review')
        }}
        onSubmitRegistration={() => void finalizeRegistration()}
        onBack={() => {
          if (screen === 'reason') setScreen('details')
          else if (screen === 'questions') setScreen('reason')
          else if (screen === 'review') setScreen('questions')
        }}
        onReview={() => setScreen('review')}
        currentScreen={screen}
        onLoadDemo={handleDemoLoad}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#f7faf9] text-slate-800">
      <Header
        mode={mode}
        setMode={(nextMode) => {
          setMode(nextMode)
          // 'settings' is reachable from staff mode via the header's
          // "Question Settings" button; clicking a mode button again should
          // always land back on that mode's main screen.
          if (nextMode === 'patient' || screen === 'settings') setScreen('welcome')
        }}
        language={language}
        onStaffSettings={() => setScreen('settings')}
      />
      {renderScreen()}
    </div>
  )
}

export default App
