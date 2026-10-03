import type {
  ConversationTurn,
  LanguageCode,
  PatientData,
  QuestionConfig,
  QueueRegistration,
  RegistrationRecord,
} from '../types/registration'

export type SpeechLanguage = 'en-IN' | 'hi-IN' | 'gu-IN'
export type ExtractedValue = string | boolean | number | null

export type ConversationResult = {
  spoken_reply: string
  detected_correction: boolean
  corrected_fields: string[]
  is_registration_complete: boolean
  /** Cumulative state after this turn. Replace local state with this on every response. */
  extracted_information: Record<string, ExtractedValue>
  next_question: { id: string; text: string } | null
  missing_required_fields: string[]
}

export class RegistrationApiError extends Error {
  code: 'rate_limit' | 'unavailable' | 'invalid_response'

  constructor(code: RegistrationApiError['code']) {
    super(code)
    this.code = code
  }
}

const getSpeechLanguage = (language: LanguageCode): SpeechLanguage => {
  if (language === 'hi') return 'hi-IN'
  if (language === 'gu') return 'gu-IN'
  return 'en-IN'
}

const isConversationResult = (value: unknown): value is ConversationResult => {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  const next = result.next_question
  const missingFields = result.missing_required_fields
  const nextValid =
    next === null ||
    (typeof next === 'object' &&
      next !== null &&
      typeof (next as { id?: unknown }).id === 'string' &&
      typeof (next as { text?: unknown }).text === 'string')
  const completionConsistent =
    typeof result.is_registration_complete === 'boolean' &&
    Array.isArray(missingFields) &&
    (result.is_registration_complete
      ? missingFields.length === 0 && next === null
      : missingFields.length > 0 &&
        missingFields.every((field) => typeof field === 'string') &&
        typeof next === 'object' &&
        next !== null &&
        (next as { id?: unknown }).id === missingFields[0])

  return (
    typeof result.spoken_reply === 'string' &&
    typeof result.detected_correction === 'boolean' &&
    Array.isArray(result.corrected_fields) &&
    result.corrected_fields.every((field) => typeof field === 'string') &&
    completionConsistent &&
    !!result.extracted_information &&
    typeof result.extracted_information === 'object' &&
    !Array.isArray(result.extracted_information) &&
    nextValid
  )
}

export const sendConversation = async (
  language: LanguageCode,
  conversation: ConversationTurn[],
  questions: QuestionConfig[],
  currentState: Record<string, ExtractedValue>,
): Promise<ConversationResult> => {
  let response: Response
  try {
    response = await fetch('/api/registration/conversation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: getSpeechLanguage(language),
        conversation,
        questions,
        current_state: currentState,
      }),
    })
  } catch {
    throw new RegistrationApiError('unavailable')
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const code = payload?.detail?.code
    if (code === 'rate_limit') throw new RegistrationApiError('rate_limit')
    if (code === 'invalid_response') throw new RegistrationApiError('invalid_response')
    throw new RegistrationApiError('unavailable')
  }

  if (!isConversationResult(payload)) {
    throw new RegistrationApiError('invalid_response')
  }
  return payload
}

export class RegistrationStorageError extends Error {}

/**
 * Persists the finalized, staff-verified registration to the FastAPI backend,
 * which stores it in SQLite. Throws RegistrationStorageError if the server could
 * not be reached or rejected the record; callers should keep the localStorage
 * copy as a fallback either way.
 */
export const submitRegistration = async (record: RegistrationRecord): Promise<void> => {
  let response: Response
  try {
    response = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
  } catch {
    throw new RegistrationStorageError('Could not reach the server to save this registration.')
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new RegistrationStorageError(payload?.detail?.message ?? 'The server could not save this registration.')
  }
}

// --- Async Patient Kiosk <-> Staff Dashboard queue -------------------------

export class RegistrationQueueError extends Error {}

export type SubmitRegistrationResult = {
  id: string
  status: 'PENDING_VERIFICATION'
  token: string
}

/**
 * Called by the Patient Kiosk once the AI conversation finishes. Saves the
 * extracted data with status PENDING_VERIFICATION and returns the token the
 * kiosk shows the patient - it does NOT return anything staff-facing, and
 * the kiosk never sees the verification screen.
 */
export const submitPendingRegistration = async (patientData: PatientData): Promise<SubmitRegistrationResult> => {
  let response: Response
  try {
    response = await fetch('/api/registration/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_data: patientData }),
    })
  } catch {
    throw new RegistrationQueueError('Could not reach the front desk system.')
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new RegistrationQueueError(payload?.detail?.message ?? 'The front desk system rejected this registration.')
  }
  return payload as SubmitRegistrationResult
}

/** Called by the Staff Dashboard's polling loop. */
export const fetchStaffQueue = async (): Promise<QueueRegistration[]> => {
  let response: Response
  try {
    response = await fetch('/api/staff/queue')
  } catch {
    throw new RegistrationQueueError('Could not reach the server to load the queue.')
  }
  if (!response.ok) {
    throw new RegistrationQueueError('Could not load the pending registrations queue.')
  }
  return (await response.json()) as QueueRegistration[]
}

/** Called when a staff member clicks "Confirm & Save" in StaffVerification. */
export const verifyPatientRegistration = async (id: string, patientData: PatientData): Promise<QueueRegistration> => {
  let response: Response
  try {
    response = await fetch(`/api/staff/verify/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_data: patientData }),
    })
  } catch {
    throw new RegistrationQueueError('Could not reach the server to save this verification.')
  }

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new RegistrationQueueError(payload?.detail?.message ?? 'The server rejected this verification.')
  }
  return payload as QueueRegistration
}

/** Removes a pending patient from the staff queue. */
export const deletePendingRegistration = async (id: string): Promise<void> => {
  let response: Response
  try {
    response = await fetch(`/api/staff/queue/${id}`, { method: 'DELETE' })
  } catch {
    throw new RegistrationQueueError('Could not reach the server to delete this registration.')
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new RegistrationQueueError(payload?.detail?.message ?? 'The server could not delete this registration.')
  }
}
