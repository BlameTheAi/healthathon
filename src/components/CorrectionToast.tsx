import type { CorrectionToastState } from '../hooks/useCorrectionToast'

type Props = {
  toast: CorrectionToastState
}

export const CorrectionToast = ({ toast }: Props) => {
  if (!toast) return null

  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900 shadow-lg"
    >
      <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white">
        ✓
      </span>
      {toast.text}
    </div>
  )
}
