import type { LanguageCode } from '../types/registration'
import { getTranslation } from '../data/translations'

type Props = {
  mode: 'patient' | 'staff'
  setMode: (value: 'patient' | 'staff') => void
  language: LanguageCode
  onStaffSettings: () => void
}

export const Header = ({ mode, setMode, language, onStaffSettings }: Props) => {
  const t = (key: string) => getTranslation(language, key)

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-600 text-lg font-bold text-white shadow-sm">
            C
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">{t('appName')}</p>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{t('subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === 'patient'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setMode('patient')}
          >
            {t('patientMode')}
          </button>

          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              mode === 'staff'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
            onClick={() => setMode('staff')}
            title="Switch to the Staff Dashboard, a separate device/screen from the Patient Kiosk"
          >
            {t('staffMode')}
          </button>

          {mode === 'staff' && (
            <button
              type="button"
              onClick={onStaffSettings}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Question Settings
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
