import type { QuestionConfig } from '../types/registration'

export const CORE_REQUIRED_QUESTION_IDS = [
  'full_name',
  'date_of_birth',
  'gender',
  'phone',
  'visit_reason',
]

export const defaultQuestions: QuestionConfig[] = [
  {
    id: 'full_name',
    question: {
      en: 'Hi, welcome in. Could you tell me your full name, please?',
      hi: 'आपका पूरा नाम क्या है?',
      gu: 'તમારું પૂરું નામ શું છે?',
    },
    required: true,
    enabled: true,
  },
  {
    id: 'date_of_birth',
    question: {
      en: 'Thank you. And what is your date of birth?',
      hi: 'आपकी जन्मतिथि क्या है?',
      gu: 'તમારી જન્મતારીખ શું છે?',
    },
    required: true,
    enabled: true,
  },
  {
    id: 'gender',
    question: {
      en: 'What is your gender?',
      hi: 'आपका लिंग क्या है?',
      gu: 'તમારું લિંગ શું છે?',
    },
    required: true,
    enabled: true,
  },
  {
    id: 'phone',
    question: {
      en: 'What is the best mobile number to reach you?',
      hi: 'आपसे संपर्क करने के लिए सबसे अच्छा मोबाइल नंबर क्या है?',
      gu: 'તમારો સંપર્ક કરવા માટે શ્રેષ્ઠ મોબાઇલ નંબર કયો છે?',
    },
    required: true,
    enabled: true,
  },
  {
    id: 'visit_reason',
    question: {
      en: 'Got it, thank you. And last question, what brings you to the hospital today?',
      hi: 'आप आज अस्पताल क्यों आए हैं?',
      gu: 'તમે આજે હોસ્પિટલમાં શા માટે આવ્યા છો?',
    },
    required: true,
    enabled: true,
  },
  {
    id: 'previous_visit',
    question: {
      en: 'Have you visited this hospital before?',
      hi: 'क्या आप पहले इस अस्पताल में आए हैं?',
      gu: 'શું તમે પહેલા આ હોસ્પિટલમાં આવ્યા છો?',
    },
    required: true,
    enabled: false,
  },
  {
    id: 'previous_reports',
    question: {
      en: 'Have you brought any previous reports or documents?',
      hi: 'क्या आप पिछली रिपोर्ट या दस्तावेज़ लाए हैं?',
      gu: 'શું તમે અગાઉના રિપોર્ટ અથવા દસ્તાવેજો લાવ્યા છો?',
    },
    required: true,
    enabled: false,
  },
  {
    id: 'referral',
    question: {
      en: 'Were you referred by another doctor or hospital?',
      hi: 'क्या आपको किसी अन्य डॉक्टर या अस्पताल ने भेजा है?',
      gu: 'શું તમને બીજા ડૉક્ટર અથવા હૉસ્પિટલ દ્વારા મોકલવામાં આવ્યા છે?',
    },
    required: false,
    enabled: false,
  },
]

export const createQuestion = (questionText = 'New question'): QuestionConfig => ({
  id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  question: { en: questionText, hi: '', gu: '' },
  required: false,
  enabled: true,
})
