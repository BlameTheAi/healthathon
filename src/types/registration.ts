export type LanguageCode = 'en' | 'hi' | 'gu'
export type SpeechLanguageCode = 'en-IN' | 'hi-IN' | 'gu-IN'
export type InputMethod = 'typed' | 'speech'

export interface PatientDetails {
  name: string
  age: string
  date_of_birth: string
  gender: string
  phone: string
  preferred_language: string
}

export interface QuestionConfig {
  id: string
  question: string | Record<LanguageCode, string>
  required: boolean
  enabled: boolean
}

export interface ConversationTurn {
  role: 'assistant' | 'patient'
  text: string
}

export interface PatientInputRecord {
  question_id: string
  text: string
  language: SpeechLanguageCode
  input_method: InputMethod
}

export interface QuestionAnswer {
  answer: string | boolean | number
  input_method: InputMethod
  language: SpeechLanguageCode
}

export type QuestionAnswerMap = Record<string, QuestionAnswer>

export interface StaffVerifiedInformation {
  patient: PatientDetails
  answers: QuestionAnswerMap
}

export type VisitInformation = Record<string, string | boolean | number | QuestionAnswer>

export interface RegistrationRecord {
  registration_id: string
  patient: {
    name: string
    age: number
    date_of_birth: string
    gender: string
    phone: string
    preferred_language: string
  }
  visit_information: VisitInformation
  conversation: ConversationTurn[]
  patient_inputs: PatientInputRecord[]
  answers: Array<{ question_id: string } & QuestionAnswer>
  ai_extracted: Record<string, string | boolean | number>
  staff_verified_information: StaffVerifiedInformation
  status: 'verified' | 'draft'
  verification: {
    status: 'verified' | 'draft'
  }
  staff_verified: boolean
  created_at: string
  language: LanguageCode
}

// --- Async Patient Kiosk <-> Staff Dashboard queue -------------------------
//
// The kiosk and the staff dashboard are two separate devices that only ever
// communicate through the backend queue below. `patient_data` is a loose
// bag of whatever the kiosk collected (full_name, date_of_birth,
// visit_reason, triage_level, ...); staff may add or correct fields when
// verifying, so it stays untyped rather than pinned to one fixed shape.
export type RegistrationStatus = 'PENDING_VERIFICATION' | 'VERIFIED'

export type PatientData = Record<string, string>

export interface QueueRegistration {
  id: string
  patient_data: PatientData
  status: RegistrationStatus
  created_at: string
}

export type ScreenName =
  | 'welcome'
  | 'language'
  | 'details'
  | 'reason'
  | 'questions'
  | 'review'
  | 'verification'
  | 'complete'
  | 'settings'
