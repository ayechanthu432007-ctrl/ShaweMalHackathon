export type AgentRegistrationFormValues = {
  name: string
  nrc: string
  nrcFrontPhotoPath: string
  nrcBackPhotoPath: string
  profilePhotoPath: string
  email: string
  phone: string
  telegram: string
  viber: string
  address1: string
  address2: string
  cityId: string
  stateId: string
  serviceRegionId: string
  hasRentingExperience: 'yes' | 'no'
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateAgentRegistrationForm(
  values: AgentRegistrationFormValues,
  t: (key: string) => string,
) {
  const errors: Partial<Record<keyof AgentRegistrationFormValues, string>> = {}

  const requiredKeys: Array<keyof AgentRegistrationFormValues> = [
    'name',
    'nrc',
    'nrcFrontPhotoPath',
    'nrcBackPhotoPath',
    'email',
    'phone',
    'address1',
    'cityId',
    'stateId',
    'serviceRegionId',
  ]

  for (const key of requiredKeys) {
    if (!String(values[key] ?? '').trim()) {
      errors[key] = t('auth.required')
    }
  }

  if (values.nrc.trim() && values.nrc.trim().length !== 15) {
    errors.nrc = t('agent.nrcLength')
  }

  if (values.email.trim() && !EMAIL_REGEX.test(values.email.trim())) {
    errors.email = t('auth.invalidEmail')
  }

  return errors
}
