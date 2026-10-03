// Text-to-speech helper for the hands-free voice receptionist flow.
// English-only for now, by design.

const MARKDOWN_PATTERN = /[*_`#>~]+/g

/**
 * Strips markdown-ish formatting characters so text sounds natural when
 * read aloud by the TTS engine (asterisks, underscores, etc. would
 * otherwise be read out or make the voice sound robotic).
 */
export const toSpokenText = (text: string): string =>
  text
    .replace(MARKDOWN_PATTERN, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

const pickEnglishVoice = (): SpeechSynthesisVoice | null => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  return (
    voices.find((voice) => /en-US|en_US/i.test(voice.lang) && /female|samantha|victoria|zira|google us english/i.test(voice.name)) ||
    voices.find((voice) => /en-US|en_US/i.test(voice.lang)) ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ||
    voices[0] ||
    null
  )
}

/** Cancels any speech currently in progress. Safe to call anytime. */
export const stopSpeaking = () => {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

/**
 * Speaks `text` aloud and resolves once speech has finished (or immediately
 * if speech synthesis isn't available in this browser). Always resolves —
 * never rejects — so the hands-free conversation loop can keep going even
 * if TTS fails for some reason.
 */
export const speak = (text: string): Promise<void> => {
  const cleaned = toSpokenText(text)

  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !cleaned) {
      resolve()
      return
    }

    try {
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(cleaned)
      const voice = pickEnglishVoice()
      if (voice) utterance.voice = voice
      utterance.lang = voice?.lang || 'en-US'
      utterance.rate = 0.98
      utterance.pitch = 1.03
      utterance.volume = 1

      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }

      utterance.onend = finish
      utterance.onerror = finish

      window.speechSynthesis.speak(utterance)

      // Safety net: some browsers occasionally never fire onend/onerror.
      const estimatedMs = Math.max(1200, cleaned.length * 70) + 4000
      setTimeout(finish, estimatedMs)
    } catch {
      resolve()
    }
  })
}

/**
 * Nudges the browser to load its voice list early (voice lists load
 * asynchronously and are empty on the very first call in some browsers).
 * Call this once, e.g. on app mount or on the "Start" button press.
 */
export const warmUpVoices = () => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.getVoices()
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices()
}
