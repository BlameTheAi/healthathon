import type { RegistrationRecord } from '../types/registration'

export const generateRegistrationId = (existingRecords: RegistrationRecord[] = []): string => {
  const now = new Date()
  const year = String(now.getFullYear()).slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const datePart = `${year}${month}${day}`

  const sequence = existingRecords.reduce((max, record) => {
    const match = /-(\d{3})$/.exec(record.registration_id)
    if (!match) return max

    return Math.max(max, Number(match[1]))
  }, 0)

  return `REG-${datePart}-${String(sequence + 1).padStart(3, '0')}`
}
