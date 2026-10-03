import { useState } from 'react'
import { CORE_REQUIRED_QUESTION_IDS, createQuestion } from '../data/questions'
import { getTranslation } from '../data/translations'
import type { LanguageCode, QuestionConfig } from '../types/registration'
import { getQuestionText } from '../utils/questionText'

type Props = {
  questions: QuestionConfig[]
  setQuestions: (questions: QuestionConfig[]) => void
  language: LanguageCode
}

export const QuestionSettings = ({ questions, setQuestions, language }: Props) => {
  const t = (key: string) => getTranslation(language, key)
  const [draft, setDraft] = useState('')

  const updateQuestion = (id: string, next: Partial<QuestionConfig>) => {
    setQuestions(
      questions.map((question) =>
        question.id === id ? { ...question, ...next } : question,
      ),
    )
  }

  const addQuestion = () => {
    if (!draft.trim()) return
    setQuestions([...questions, createQuestion(draft.trim())])
    setDraft('')
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">{t('medicalTeam')}</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-900">{t('questionSettings')}</h2>
        </div>
        <div className="flex gap-3">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-teal-500 sm:w-80"
            placeholder="Add new question"
          />
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-2xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
          >
            {t('addQuestion')}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((question) => {
          const isCoreRequired = CORE_REQUIRED_QUESTION_IDS.includes(question.id)
          return (
            <div key={question.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="grid flex-1 gap-3 md:grid-cols-3">
                  {([
                    ['en', 'English'],
                    ['hi', 'हिंदी'],
                    ['gu', 'ગુજરાતી'],
                  ] as const).map(([code, label]) => (
                    <label key={code} className="space-y-1 text-xs font-semibold text-slate-600">
                      {label}
                      <input
                        value={getQuestionText(question, code)}
                        onChange={(event) => {
                          const current = typeof question.question === 'string'
                            ? { en: question.question, hi: '', gu: '' }
                            : question.question
                          updateQuestion(question.id, {
                            question: { ...current, [code]: event.target.value },
                          })
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-500"
                      />
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={question.enabled}
                      disabled={isCoreRequired}
                      onChange={(event) => updateQuestion(question.id, { enabled: event.target.checked })}
                    />
                    {t('enable')}
                  </label>

                  <label className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={question.required}
                      disabled={isCoreRequired}
                      onChange={(event) => updateQuestion(question.id, { required: event.target.checked })}
                    />
                    {isCoreRequired ? t('mandatory') : t('required')}
                  </label>

                  <button
                    type="button"
                    disabled={isCoreRequired}
                    onClick={() => setQuestions(questions.filter((item) => item.id !== question.id))}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t('delete')}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
