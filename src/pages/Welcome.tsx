import type { LanguageCode } from '../types/registration'
import { getTranslation } from '../data/translations'

type Props = {
  language: LanguageCode
  onStart: () => void
}

export const Welcome = ({ language, onStart }: Props) => {
  const t = (key: string) => getTranslation(language, key)

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-teal-700">{t('demoMode')}</p>
            <h1 className="mt-3 text-4xl font-bold text-slate-900 sm:text-5xl">{t('appName')}</h1>
          </div>
          <div className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
            {t('demoMode')}
          </div>
        </div>

        <p className="max-w-xl text-lg text-slate-600">{t('subtitle')}</p>
        <p className="mt-6 text-xl text-slate-700">{t('introText')}</p>

        <div className="mt-8 flex justify-start">
          <button
            type="button"
            onClick={onStart}
            className="rounded-2xl bg-teal-700 px-7 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-teal-600"
          >
            {t('startRegistration')}
          </button>
        </div>
      </div>
    </div>
  )
}
