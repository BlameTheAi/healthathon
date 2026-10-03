import { useMemo, useState } from 'react'
import { getTranslation } from '../data/translations'
import type { InputMethod, LanguageCode, QuestionAnswerMap, QuestionConfig, SpeechLanguageCode } from '../types/registration'
import { getQuestionText } from '../utils/questionText'
import { SpeechInput } from './SpeechInput'

type Props = {
  questions: QuestionConfig[]
  answers: QuestionAnswerMap
  language: LanguageCode
  onAnswerChange: (id: string, value: string, inputMethod?: InputMethod, answerLanguage?: SpeechLanguageCode) => void
  onComplete: () => void
  onBack: () => void
}

export const QuestionFlow = ({ questions, answers, language, onAnswerChange, onComplete, onBack }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0)

  const enabledQuestions = useMemo(
    () => questions.filter((question) => question.enabled && question.id !== 'visit_reason'),
    [questions],
  )

  const currentQuestion = enabledQuestions[currentIndex]

  const handleNext = () => {
    if (!currentQuestion) return

    const currentAnswer = String(answers[currentQuestion.id]?.answer ?? '')
    if (currentQuestion.required && !currentAnswer.trim()) {
      return
    }

    if (currentIndex < enabledQuestions.length - 1) {
      setCurrentIndex((value) => value + 1)
      return
    }

    onComplete()
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex((value) => value - 1)
    } else {
      onBack()
    }
  }

  if (!currentQuestion) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-600">
        {getTranslation(language, 'noQuestions')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
          Question {currentIndex + 1} of {enabledQuestions.length}
        </p>
        <h2 className="text-2xl font-semibold text-slate-900">{getQuestionText(currentQuestion, language)}</h2>

        <div className="mt-6 space-y-4">
          <SpeechInput
            language={language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'gu-IN'}
            value={String(answers[currentQuestion.id]?.answer ?? '')}
            inputMethod={answers[currentQuestion.id]?.input_method ?? 'typed'}
            placeholder={getTranslation(language, 'voicePlaceholder')}
            onChange={(nextValue, inputMethod) =>
              onAnswerChange(currentQuestion.id, nextValue, inputMethod, language === 'en' ? 'en-IN' : language === 'hi' ? 'hi-IN' : 'gu-IN')
            }
          />

        </div>
      </div>

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={handlePrevious}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {getTranslation(language, 'previous')}
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="rounded-2xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800"
        >
          {currentIndex === enabledQuestions.length - 1 ? getTranslation(language, 'finishQuestions') : getTranslation(language, 'next')}
        </button>
      </div>
    </div>
  )
}
