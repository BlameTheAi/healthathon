import { getTranslation } from '../data/translations'
import type { LanguageCode } from '../types/registration'

type Props = {
  currentStep: number
  language: LanguageCode
}

const steps = ['progressLanguage', 'progressDetails', 'progressInformation', 'progressQuestions', 'progressReview']

export const ProgressBar = ({ currentStep, language }: Props) => {
  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {steps.map((stepKey, index) => {
          const isActive = index === currentStep
          const isCompleted = index < currentStep
          const label = getTranslation(language, stepKey)

          return (
            <div key={stepKey} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm'
                    : isCompleted
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {index + 1}
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-slate-900' : 'text-slate-600'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
