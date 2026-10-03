import type { LanguageCode, QuestionConfig } from '../types/registration'

export const getQuestionText = (question: QuestionConfig, language: LanguageCode): string => {
  if (typeof question.question === 'string') return question.question
  return question.question[language] || question.question.en || question.id
}