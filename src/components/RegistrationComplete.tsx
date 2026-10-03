type Props = {
  patientName: string
  token: string
  submitError?: string | null
  onStartNew: () => void
}

/**
 * The Patient Kiosk's final screen. This is a dead end on purpose: the
 * patient never sees staff verification. The record has already been
 * handed off to the backend queue with status PENDING_VERIFICATION, and a
 * staff member will pick it up on the Staff Dashboard, on a different
 * device, in their own time.
 */
export const RegistrationComplete = ({ patientName, token, submitError, onStartNew }: Props) => (
  <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700">
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden="true">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
        {patientName ? `Thank you, ${patientName}` : 'Thank you'}
      </p>

      <h2 className="mt-2 text-xl font-semibold text-slate-900">
        Your information has been sent to the front desk.
      </h2>
      <p className="mt-2 text-slate-600">Please have a seat. A staff member will call your token shortly.</p>

      {submitError && (
        <div role="alert" className="mt-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-950">
          We could not confirm this reached the front desk system ({submitError}). Please let a staff member know.
        </div>
      )}

      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 py-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Token</p>
        <p className="mt-1 text-4xl font-bold tracking-wide text-slate-900">#{token || '—'}</p>
      </div>

      <button
        type="button"
        onClick={onStartNew}
        className="mt-8 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Register Another Patient
      </button>
    </div>
  </div>
)
