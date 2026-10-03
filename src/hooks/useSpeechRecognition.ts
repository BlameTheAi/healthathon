import { useCallback, useEffect, useRef, useState } from 'react'

type RecognitionState = 'idle' | 'listening' | 'processing' | 'finished'

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript?: string }> & { isFinal?: boolean }>
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition
  }
}

export const useSpeechRecognition = (language: 'en-IN' | 'hi-IN' | 'gu-IN') => {
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [status, setStatus] = useState<RecognitionState>('idle')
  const [error, setError] = useState('')
  const [retryable, setRetryable] = useState(false)
  const transcriptRef = useRef('')
  const finalTranscriptRef = useRef('')
  const manuallyStoppedRef = useRef(false)

  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onerror = null
      recognitionRef.current.onend = null
      try {
        recognitionRef.current.stop()
      } catch {
        // Recognition may already have ended during unmount.
      }
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => cleanupRecognition()
  }, [cleanupRecognition])

  const startListening = useCallback(async () => {
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition

    if (!SpeechRecognitionCtor) {
      setError('Dictate Mode is not supported in this browser. Please type your answer instead.')
      setRetryable(false)
      setStatus('finished')
      return false
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = language
    let canRetry = true
    manuallyStoppedRef.current = false

    recognition.onstart = () => {
      setStatus('listening')
      setIsListening(true)
      setError('')
      setRetryable(false)
    }

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const results = Array.from(event.results)
      const collected = results
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim()
      const finalized = results
        .filter((result) => result.isFinal)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim()

      if (collected) {
        transcriptRef.current = collected
        setTranscript(collected)
      }
      if (finalized) finalTranscriptRef.current = finalized
    }

    recognition.onerror = (event: { error?: string }) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        canRetry = false
        setError(
          'Microphone access is required for Dictate Mode. You can allow microphone access in your browser settings or type your answer instead.',
        )
      } else if (event.error === 'audio-capture') {
        canRetry = false
        setError('No microphone was found. Connect a microphone or type your answer instead.')
      } else if (event.error === 'network') {
        canRetry = false
        setError('Speech recognition is unavailable right now. Check your connection or type your answer instead.')
      } else if (event.error === 'no-speech') {
        setError("We couldn't hear anything. Please try again.")
      } else if (event.error === 'aborted') {
        setError("Dictation stopped unexpectedly. Reconnecting to the microphone…")
      } else {
        canRetry = false
        setError('Recognition error. Please try again.')
      }
      setRetryable(canRetry && !manuallyStoppedRef.current)
    }

    recognition.onend = () => {
      setIsListening(false)
      setStatus('finished')
      const finalTranscript = finalTranscriptRef.current || transcriptRef.current
      if (finalTranscript) {
        setTranscript(finalTranscript)
      } else {
        setError((currentError) => currentError || "We couldn't hear anything. Please try again.")
        setRetryable(canRetry && !manuallyStoppedRef.current)
      }
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    transcriptRef.current = ''
    finalTranscriptRef.current = ''
    setTranscript('')
    setError('')
    setRetryable(false)
    setStatus('processing')
    try {
      recognition.start()
    } catch {
      recognitionRef.current = null
      setIsListening(false)
      setStatus('finished')
      setError('Recognition error. Please try again.')
      setRetryable(false)
      return false
    }
    return true
  }, [language])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      manuallyStoppedRef.current = true
      setStatus('processing')
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  const resetTranscript = useCallback(() => {
    transcriptRef.current = ''
    finalTranscriptRef.current = ''
    setTranscript('')
    setError('')
    setRetryable(false)
    setStatus('idle')
  }, [])

  return {
    transcript,
    isListening,
    status,
    error,
    retryable,
    startListening,
    stopListening,
    resetTranscript,
  }
}
