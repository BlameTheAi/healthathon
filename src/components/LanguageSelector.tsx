import type { LanguageCode } from '../types/registration'
import { getTranslation } from '../data/translations'

type Props = {
  language: LanguageCode
  onSelect: (language: LanguageCode) => void
}

export const LanguageSelector = ({ language, onSelect }: Props) => {
  const options: Array<{ code: LanguageCode; label: string }> = [
    { code: 'en', label: getTranslation('en', 'english') },
    { code: 'hi', label: getTranslation('hi', 'hindi') },
    { code: 'gu', label: getTranslation('gu', 'gujarati') },
  ]

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold text-slate-900">{getTranslation(language, 'selectLanguage')}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.code}
            type="button"
            className={`rounded-2xl border p-5 text-left font-semibold transition ${
              language === option.code
                ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            }`}
            onClick={() => onSelect(option.code)}
          >
            <div className="text-lg">{option.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
