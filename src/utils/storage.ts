import { CORE_REQUIRED_QUESTION_IDS, defaultQuestions } from '../data/questions'
import type { LanguageCode, QuestionConfig, RegistrationRecord } from '../types/registration'

export const STORAGE_KEYS = {
  registrations: 'careflow_registrations',
  questions: 'careflow_questions',
  language: 'careflow_language',
}

const readStorage = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback

  try {
    const value = localStorage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    return fallback
  }
}

const writeStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return

  localStorage.setItem(key, JSON.stringify(value))
}

export const getStoredRegistrations = (): RegistrationRecord[] =>
  readStorage<RegistrationRecord[]>(STORAGE_KEYS.registrations, [])

export const saveStoredRegistrations = (records: RegistrationRecord[]) => {
  writeStorage(STORAGE_KEYS.registrations, records)
}

// Backfill mandatory registration questions from older browser settings while
// retaining other custom questions. Age is derived from date of birth, not asked.
export const getStoredQuestions = (): QuestionConfig[] => {
  const stored = readStorage<QuestionConfig[]>(STORAGE_KEYS.questions, defaultQuestions)
  const normalized =
    stored.length === 0
      ? defaultQuestions
      : stored.map((question) => {
          const isCoreRequired = CORE_REQUIRED_QUESTION_IDS.includes(question.id)
          const defaultQuestion = defaultQuestions.find((item) => item.id === question.id)
          const questionText =
            typeof question.question === 'string'
              ? defaultQuestion && typeof defaultQuestion.question !== 'string'
                ? { ...defaultQuestion.question, en: question.question }
                : { en: question.question, hi: '', gu: '' }
              : question.question

          return {
            ...question,
            question: questionText,
            ...(isCoreRequired ? { required: true, enabled: true } : {}),
          }
        })

  const coreQuestions = CORE_REQUIRED_QUESTION_IDS.map((id) => {
    const configured = normalized.find((question) => question.id === id)
    const fallback = defaultQuestions.find((question) => question.id === id)
    const question = configured ?? fallback
    if (!question) throw new Error(`Missing required default registration question: ${id}`)
    return { ...question, required: true, enabled: true }
  })
  const optionalQuestions = normalized.filter(
    (question) =>
      question.id !== 'age' &&
      !CORE_REQUIRED_QUESTION_IDS.includes(question.id),
  )
  return [...coreQuestions, ...optionalQuestions]
}

export const saveStoredQuestions = (questions: QuestionConfig[]) => {
  writeStorage(STORAGE_KEYS.questions, questions)
}

export const getStoredLanguage = (): LanguageCode => {
  const stored = readStorage<LanguageCode | null>(STORAGE_KEYS.language, 'en')
  return stored === 'en' || stored === 'hi' || stored === 'gu' ? stored : 'en'
}

export const saveStoredLanguage = (language: LanguageCode) => {
  writeStorage(STORAGE_KEYS.language, language)
}
