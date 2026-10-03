import { useEffect, useRef, useState } from 'react'
import { StaffVerification } from '../components/StaffVerification'
import { deletePendingRegistration, fetchStaffQueue, RegistrationQueueError } from '../services/registrationApi'
import type { QueueRegistration } from '../types/registration'

const POLL_INTERVAL_MS = 5000

const triageBadgeClasses: Record<string, string> = {
  Urgent: 'bg-red-50 text-red-700 border border-red-200',
  Moderate: 'bg-amber-50 text-amber-700 border border-amber-200',
  Routine: 'bg-slate-100 text-slate-600 border border-slate-200',
}

const formatTime = (isoTimestamp: string): string => {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/**
 * The Staff Dashboard: a separate device/screen from the Patient Kiosk.
 * It never receives data directly from the kiosk - it only ever polls the
 * backend queue, the same way a second workstation at a real front desk
 * would.
 */
export const Staff = () => {
  const [queue, setQueue] = useState<QueueRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const isMounted = useRef(true)

  const loadQueue = async () => {
    try {
      const records = await fetchStaffQueue()
      if (!isMounted.current) return
      setQueue(records)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      if (!isMounted.current) return
      setError(err instanceof RegistrationQueueError ? err.message : 'Could not load the pending queue.')
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  useEffect(() => {
    isMounted.current = true
    void loadQueue()
    const interval = window.setInterval(() => void loadQueue(), POLL_INTERVAL_MS)
    return () => {
      isMounted.current = false
      window.clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = queue.find((record) => record.id === selectedId) ?? null

  const handleVerified = (updated: QueueRegistration) => {
    setQueue((current) => current.filter((record) => record.id !== updated.id))
    setSelectedId(null)
  }

  const handleDelete = async (record: QueueRegistration) => {
    const patientName = record.patient_data.full_name || 'this patient'
    if (!window.confirm(`Delete the registration for ${patientName}? This cannot be undone.`)) return

    setDeletingId(record.id)
    setError(null)
    try {
      await deletePendingRegistration(record.id)
      setQueue((current) => current.filter((item) => item.id !== record.id))
      setSelectedId((current) => (current === record.id ? null : current))
    } catch (err) {
      setError(err instanceof RegistrationQueueError ? err.message : 'Could not delete this registration.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Staff Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Pending Verifications Queue</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex h-2 w-2 rounded-full bg-teal-500" aria-hidden="true" />
          <span>
            {loading
              ? 'Refreshing…'
              : lastUpdated
                ? `Last updated ${lastUpdated.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'Not yet loaded'}
          </span>
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Refresh now
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="w-1/2 px-5 py-3">Patient Name</th>
              <th className="w-1/5 px-5 py-3">Triage Level</th>
              <th className="w-1/5 px-5 py-3">Time</th>
              <th className="w-1/6 px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                  No pending registrations. New kiosk check-ins will appear here automatically.
                </td>
              </tr>
            )}
            {queue.map((record) => {
              const triage = record.patient_data.triage_level || 'Routine'
              return (
                <tr
                  key={record.id}
                  className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                >
                  <td
                    className="px-5 py-3 font-medium text-slate-900"
                    onClick={() => setSelectedId(record.id)}
                  >
                    {record.patient_data.full_name || 'Unnamed Patient'}
                  </td>
                  <td className="px-5 py-3" onClick={() => setSelectedId(record.id)}>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        triageBadgeClasses[triage] ?? triageBadgeClasses.Routine
                      }`}
                    >
                      {triage}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600" onClick={() => setSelectedId(record.id)}>
                    {formatTime(record.created_at)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(record)}
                      disabled={deletingId === record.id}
                      className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      {deletingId === record.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setSelectedId(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <StaffVerification
              registration={selected}
              onCancel={() => setSelectedId(null)}
              onVerified={handleVerified}
            />
          </div>
        </div>
      )}
    </div>
  )
}
