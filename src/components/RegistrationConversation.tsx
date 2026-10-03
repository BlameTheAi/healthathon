import { useMemo, useRef, useState } from 'react'
import { sendConversation, RegistrationApiError } from '../services/registrationApi'
import type { ConversationResult, ExtractedValue } from '../services/registrationApi'
import { speak, stopSpeaking, toSpokenText } from '../utils/speech'
import { getQuestionText } from '../utils/questionText'
import { useCorrectionToast } from '../hooks/useCorrectionToast'
import { CorrectionToast } from './CorrectionToast'
import type {
  ConversationTurn,
  InputMethod,
  LanguageCode,
  PatientDetails,
  PatientInputRecord,
  QuestionAnswerMap,
  QuestionConfig,
  SpeechLanguageCode,
} from '../types/registration'
import { SpeechInput } from './SpeechInput'

type ScalarValue = string | boolean | number

type Props = {
  language: LanguageCode
  patient: PatientDetails
  questions: QuestionConfig[]
  answers: QuestionAnswerMap
  onAnswer: (id: string, value: ScalarValue, method: InputMethod, answerLanguage: SpeechLanguageCode) => void
  conversation: ConversationTurn[]
  onConversationChange: (conversation: ConversationTurn[]) => void
  patientInputs: PatientInputRecord[]
  onPatientInputsChange: (inputs: PatientInputRecord[]) => void
  aiExtracted: Record<string, ScalarValue>
  onAiExtractedChange: (fields: Record<string, ScalarValue>) => void
  onPatientUpdate?: (fields: Partial<PatientDetails>) => void
  onComplete: () => void
}

// This hands-free voice flow is English-only for now, regardless of the
// `language` prop (which still drives the rest of the app's UI copy).
const VOICE_LANGUAGE: SpeechLanguageCode = 'en-IN'

type Phase = 'not_started' | 'speaking' | 'listening' | 'processing' | 'error'

const FIELD_LABELS: Record<string, string> = {
  full_name: 'your name',
  date_of_birth: 'your date of birth',
  gender: 'your gender',
  phone: 'your mobile number',
  visit_reason: 'your reason for visit',
}

const copy = {
  startTitle: "Let's get you registered",
  startBody:
    "I'll ask you a couple of quick questions out loud — just answer naturally and I'll take it from there. No typing needed.",
  startButton: '🎙 Start Conversation',
  speaking: '🔊 Speaking…',
  listening: '🎙 Listening — go ahead, speak whenever you’re ready.',
  thinking: 'One moment…',
  unavailable: "We couldn't process your response right now. You can try again or switch to typing.",
  rate_limit: 'The service is temporarily busy. Please try again in a moment.',
  invalid_response: 'We could not validate that response. You can try again or switch to typing.',
  tryAgain: 'Try again',
  typeInstead: 'Switch to typing',
  continue: 'Continue',
}

const describeCorrection = (fields: string[]): string => {
  if (fields.length === 0) return 'Caught a correction and updated your answer.'
  const labels = fields.map((id) => FIELD_LABELS[id] ?? id.replace(/_/g, ' '))
  return `Caught a correction and updated ${labels.join(' and ')}.`
}

// Drops nulls and blanks so the stored state only ever holds real answers.
const toScalarRecord = (values: Record<string, ExtractedValue>): Record<string, ScalarValue> => {
  const out: Record<string, ScalarValue> = {}
  Object.entries(values).forEach(([id, value]) => {
    if (value !== null && value !== undefined && value !== '') out[id] = value
  })
  return out
}

export const RegistrationConversation = ({
  patient,
  questions,
  onAnswer,
  conversation,
  onConversationChange,
  patientInputs,
  onPatientInputsChange,
  aiExtracted,
  onAiExtractedChange,
  onPatientUpdate,
  onComplete,
}: Props) => {
  const enabledQuestions = useMemo(
    () => questions.filter((question) => question.enabled && question.required),
    [questions],
  )
  const [currentQuestionId, setCurrentQuestionId] = useState(() => enabledQuestions[0]?.id ?? '')
  const [currentQuestionPrompt, setCurrentQuestionPrompt] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('not_started')
  const [draft, setDraft] = useState('')
  const [listenToken, setListenToken] = useState(0)
  const [errorCode, setErrorCode] = useState<RegistrationApiError['code'] | ''>('')
  const [manualMode, setManualMode] = useState(false)
  const { toast, show: showToast } = useCorrectionToast()

  // Refs keep the async submit handler reading the latest state, not a stale closure.
  const conversationRef = useRef(conversation)
  conversationRef.current = conversation
  const stateRef = useRef<Record<string, ScalarValue>>(aiExtracted)
  stateRef.current = aiExtracted

  const currentQuestion = enabledQuestions.find((question) => question.id === currentQuestionId)
  const rawQuestionText = currentQuestion ? getQuestionText(currentQuestion, 'en') : ''
  const currentQuestionText = currentQuestionPrompt ?? toSpokenText(rawQuestionText)
  const currentIndex = Math.max(0, enabledQuestions.findIndex((question) => question.id === currentQuestionId))

  /**
   * Applies the backend's cumulative state. The backend has already merged
   * corrections and kept earlier answers, so this replaces local state wholesale.
   */
  const applyResult = (result: ConversationResult, priorState: Record<string, ScalarValue>, inputMethod: InputMethod) => {
    const cumulative = toScalarRecord(result.extracted_information)
    onAiExtractedChange(cumulative)

    Object.entries(cumulative).forEach(([id, value]) => {
      if (priorState[id] !== value) onAnswer(id, value, inputMethod, VOICE_LANGUAGE)
    })

    const fullName = cumulative.full_name
    const dateOfBirth = cumulative.date_of_birth
    const patientUpdates: Partial<PatientDetails> = {}
    if (typeof fullName === 'string') patientUpdates.name = fullName.trim()
    if (typeof dateOfBirth === 'string') patientUpdates.date_of_birth = dateOfBirth.trim()
    if (typeof cumulative.gender === 'string') patientUpdates.gender = cumulative.gender.trim()
    if (typeof cumulative.phone === 'string' || typeof cumulative.phone === 'number') {
      patientUpdates.phone = String(cumulative.phone)
    }
    if (Object.keys(patientUpdates).length > 0) onPatientUpdate?.(patientUpdates)
  }

  const speakThenListen = async (text: string) => {
    setPhase('speaking')
    await speak(text)
    setPhase('listening')
    setListenToken((token) => token + 1)
  }

  const handleStart = () => {
    setErrorCode('')
    setManualMode(false)
    void speakThenListen(currentQuestionText)
  }

  const submitAnswer = async (value: string) => {
    if (!currentQuestion || !value.trim()) return
    const patientText = value.trim()
    setPhase('processing')
    setErrorCode('')

    const history = [...conversationRef.current]
    const lastTurn = history[history.length - 1]
    if (lastTurn?.role !== 'assistant' || lastTurn.text !== currentQuestionText) {
      history.push({ role: 'assistant', text: currentQuestionText })
    }
    history.push({ role: 'patient', text: patientText })

    const priorState = stateRef.current

    try {
      const result = await sendConversation('en', history, questions, priorState)
      const inputMethod: InputMethod = manualMode ? 'typed' : 'speech'

      applyResult(result, priorState, inputMethod)
      onPatientInputsChange([
        ...patientInputs,
        {
          question_id: currentQuestion.id,
          text: patientText,
          language: VOICE_LANGUAGE,
          input_method: inputMethod,
        },
      ])

      if (result.detected_correction) {
        showToast(describeCorrection(result.corrected_fields))
      }

      const spokenText = toSpokenText(result.spoken_reply)
      onConversationChange([...history, { role: 'assistant', text: spokenText }])
      setDraft('')

      if (result.is_registration_complete) {
        // Let the closing line finish before navigating, so the correction
        // toast stays on screen while the patient hears it.
        setPhase('speaking')
        await speak(spokenText)
        onComplete()
        return
      }

      if (result.next_question) {
        setCurrentQuestionId(result.next_question.id)
        setCurrentQuestionPrompt(toSpokenText(result.next_question.text))
        if (manualMode) {
          setPhase('listening')
        } else {
          await speakThenListen(spokenText)
        }
      } else {
        setErrorCode('invalid_response')
        setPhase('error')
      }
    } catch (error) {
      setErrorCode(error instanceof RegistrationApiError ? error.code : 'unavailable')
      setPhase('error')
    }
  }

  const handleFinalTranscript = (value: string) => {
    void submitAnswer(value)
  }

  const switchToTyping = () => {
    stopSpeaking()
    setManualMode(true)
    setErrorCode('')
    setPhase('listening')
  }

  const retry = () => {
    setErrorCode('')
    if (manualMode) {
      setPhase('listening')
    } else {
      void speakThenListen(currentQuestionText)
    }
  }

  if (!currentQuestion) {
    return <p className="text-slate-600">No voice registration questions are configured.</p>
  }

  if (phase === 'not_started') {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-teal-200 bg-teal-50 p-8 text-center shadow-sm">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
          {patient.name ? `Welcome back, ${patient.name}` : 'Voice Registration'}
        </p>
        <h2 className="text-2xl font-semibold text-slate-900">{copy.startTitle}</h2>
        <p className="mx-auto mt-3 max-w-md text-slate-600">{copy.startBody}</p>
        <button
          type="button"
          onClick={handleStart}
          className="mt-6 rounded-2xl bg-slate-900 px-6 py-3 text-base font-semibold text-white transition hover:bg-slate-800"
        >
          {copy.startButton}
        </button>
      </div>
    )
  }

  const statusLabel =
    phase === 'speaking' ? copy.speaking : phase === 'processing' ? copy.thinking : phase === 'listening' ? copy.listening : undefined

  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy={phase === 'processing'}>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-teal-800">
        Question {currentIndex + 1} of {enabledQuestions.length}
      </p>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-live="polite">
        <h2 className="text-2xl font-semibold text-slate-900">{currentQuestionText}</h2>

        <div className="mt-6">
          {manualMode ? (
            <div className="space-y-3">
              <SpeechInput
                language={VOICE_LANGUAGE}
                value={draft}
                inputMethod="typed"
                placeholder="Type your answer…"
                onChange={(value) => setDraft(value)}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void submitAnswer(draft)}
                  disabled={!draft.trim() || phase === 'processing'}
                  className="min-h-12 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {phase === 'processing' ? copy.thinking : copy.continue}
                </button>
              </div>
            </div>
          ) : (
            <SpeechInput
              language={VOICE_LANGUAGE}
              value={draft}
              inputMethod="speech"
              onChange={(value) => setDraft(value)}
              autoListenToken={listenToken}
              onFinalTranscript={handleFinalTranscript}
              disabled={phase !== 'listening'}
              statusLabel={statusLabel}
            />
          )}
        </div>
      </section>

      {errorCode && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p>{copy[errorCode]}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={retry}
              className="min-h-11 rounded-xl border border-amber-700 px-4 font-semibold hover:bg-amber-100"
            >
              {copy.tryAgain}
            </button>
            {!manualMode && (
              <button
                type="button"
                onClick={switchToTyping}
                className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold text-slate-700 hover:bg-slate-100"
              >
                {copy.typeInstead}
              </button>
            )}
          </div>
        </div>
      )}

      {!manualMode && !errorCode && (
        <div className="text-center">
          <button type="button" onClick={switchToTyping} className="text-sm font-semibold text-slate-500 underline">
            {copy.typeInstead}
          </button>
        </div>
      )}

      <p className="sr-only">
        {patient.name ? `${patient.name}, ` : ''}
        {Object.keys(aiExtracted).length} fields collected
      </p>

      <CorrectionToast toast={toast} />
    </div>
  )
}
