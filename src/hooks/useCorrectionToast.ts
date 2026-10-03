import { useCallback, useEffect, useRef, useState } from 'react'

const TOAST_DURATION_MS = 4000

export type CorrectionToastState = { id: number; text: string } | null

/**
 * Shows a short-lived confirmation when the AI catches and handles a
 * self-correction. Each call gets a new id, so repeated corrections re-mount
 * the toast and restart its visual cue.
 */
export const useCorrectionToast = () => {
  const [toast, setToast] = useState<CorrectionToastState>(null)
  const timerRef = useRef<number | null>(null)
  const idRef = useRef(0)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const show = useCallback(
    (text: string) => {
      clearTimer()
      idRef.current += 1
      setToast({ id: idRef.current, text })
      timerRef.current = window.setTimeout(() => {
        setToast(null)
        timerRef.current = null
      }, TOAST_DURATION_MS)
    },
    [clearTimer],
  )

  useEffect(() => clearTimer, [clearTimer])

  return { toast, show }
}
