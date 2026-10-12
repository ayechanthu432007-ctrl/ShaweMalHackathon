export type LoginFormValues = {
  email: string
  password: string
  rememberMe: boolean
}

export type RegisterFormValues = {
  name: string
  email: string
  phone: string
  occupationId: string
  password: string
  confirmPassword: string
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateLoginForm(values: LoginFormValues, t: (key: string) => string) {
  const errors: Partial<Record<keyof LoginFormValues, string>> = {}

  if (!values.email.trim()) {
    errors.email = t('auth.required')
  } else if (!EMAIL_REGEX.test(values.email)) {
    errors.email = t('auth.invalidEmail')
  }

  if (!values.password) {
    errors.password = t('auth.required')
  }

  return errors
}

export function validateRegisterForm(values: RegisterFormValues, t: (key: string) => string) {
  const errors: Partial<Record<keyof RegisterFormValues, string>> = {}

  if (!values.name.trim()) {
    errors.name = t('auth.required')
  }

  if (!values.email.trim()) {
    errors.email = t('auth.required')
  } else if (!EMAIL_REGEX.test(values.email)) {
    errors.email = t('auth.invalidEmail')
  }

  if (!values.phone.trim()) {
    errors.phone = t('auth.required')
  }

  if (!values.occupationId) {
    errors.occupationId = t('auth.required')
  }

  if (!values.password) {
    errors.password = t('auth.required')
  } else if (values.password.length < 8) {
    errors.password = t('auth.minPassword')
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = t('auth.required')
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = t('auth.passwordMismatch')
  }

  return errors
}
