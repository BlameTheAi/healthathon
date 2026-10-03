import { useEffect, useMemo, useRef } from 'react'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'

type InputMethod = 'typed' | 'speech'

type SpeechInputProps = {
  language: 'en-IN' | 'hi-IN' | 'gu-IN'
  value: string
  inputMethod?: InputMethod
  onChange: (value: string, inputMethod: InputMethod) => void
  placeholder?: string
  /**
   * Bump this number to make the component start listening automatically,
   * without the user clicking the mic button. Used by the hands-free
   * conversation loop. Optional — existing callers are unaffected.
   */
  autoListenToken?: number
  /**
   * Fired once, automatically, as soon as a spoken answer is finalized
   * (recognition stopped after the patient paused). Optional — existing
   * callers that rely on manual "Continue" buttons are unaffected.
   */
  onFinalTranscript?: (value: string) => void
  /** Overrides the default status copy under the textarea. */
  statusLabel?: string
  /** Disables the mic button and auto-listen triggers (e.g. while the AI is speaking). */
  disabled?: boolean
}

export const SpeechInput = ({
  language,
  value,
  inputMethod = 'typed',
  onChange,
  placeholder,
  autoListenToken,
  onFinalTranscript,
  statusLabel,
  disabled = false,
}: SpeechInputProps) => {
  const {
    transcript,
    isListening,
    status,
    error,
    retryable,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition(language)
  const onChangeRef = useRef(onChange)
  const onFinalRef = useRef(onFinalTranscript)
  const firedFinalRef = useRef(false)
  const lastAutoTokenRef = useRef<number | undefined>(undefined)
  const noSpeechRetriesRef = useRef(0)
  const retryTimerRef = useRef<number | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    onFinalRef.current = onFinalTranscript
  }, [onFinalTranscript])

  useEffect(() => {
    if (transcript) {
      onChangeRef.current(transcript, 'speech')
    }
  }, [transcript])

  useEffect(
    () => () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current)
      }
    },
    [],
  )

  // Hands-free: fire the finished answer upward exactly once per session.
  useEffect(() => {
    if (status === 'finished' && transcript.trim() && !firedFinalRef.current) {
      firedFinalRef.current = true
      onFinalRef.current?.(transcript.trim())
    }
    if (status === 'listening' || status === 'processing') {
      firedFinalRef.current = false
    }
  }, [status, transcript])

  // Hands-free: let a parent request a new listening session automatically.
  useEffect(() => {
    if (autoListenToken === undefined) return
    if (disabled) return
    if (lastAutoTokenRef.current === autoListenToken) return
    lastAutoTokenRef.current = autoListenToken
    noSpeechRetriesRef.current = 0
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    firedFinalRef.current = false
    resetTranscript()
    void startListening()
    // We intentionally only react to the token/disabled changing, not to
    // startListening/resetTranscript identity, to avoid re-triggering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoListenToken, disabled])

  useEffect(() => {
    if (
      autoListenToken === undefined ||
      disabled ||
      status !== 'finished' ||
      transcript.trim() ||
      !retryable
    ) {
      return
    }

    noSpeechRetriesRef.current += 1
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null
      void startListening()
    }, Math.min(1500, 350 + noSpeechRetriesRef.current * 250))

    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    }
  }, [autoListenToken, disabled, retryable, startListening, status, transcript])

  const buttonText = useMemo(() => {
    if (isListening) return '🔴 Listening...'
    if (status === 'processing') return 'Processing...'
    return '🎙 Dictate'
  }, [isListening, status])

  const handleToggle = async () => {
    if (disabled) return
    if (isListening) {
      stopListening()
      return
    }

    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    noSpeechRetriesRef.current = 0
    firedFinalRef.current = false
    resetTranscript()
    await startListening()
  }

  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={(event) => {
          const nextValue = event.target.value
          onChange(nextValue, inputMethod)
        }}
        placeholder={placeholder}
        disabled={disabled}
        className="min-h-[140px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-teal-500 focus:bg-white disabled:opacity-60"
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          {error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : statusLabel ? (
            <p className="inline-flex items-center gap-2 text-sm font-medium text-teal-700">
              {isListening && <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />}
              {statusLabel}
            </p>
          ) : isListening ? (
            <p className="inline-flex items-center gap-2 text-sm font-medium text-teal-700">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
              Speak naturally.
            </p>
          ) : status === 'finished' ? (
            <p className="text-sm text-slate-500">Your answer</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isListening
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {isListening ? 'Stop Dictation' : buttonText}
        </button>
      </div>
    </div>
  )
}
