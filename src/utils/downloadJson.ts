import type { RegistrationRecord } from '../types/registration'

export const downloadRegistrationJson = (record: RegistrationRecord) => {
  const jsonText = JSON.stringify(record, null, 2)
  const blob = new Blob([jsonText], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${record.registration_id}.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
