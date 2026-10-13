import { apiRequest } from '@/lib/api/client'

export type AgentRegistrationInput = {
  name: string
  nrc: string
  nrcFrontPhotoPath: string
  nrcBackPhotoPath: string
  /** Optional; saved as the account's profile picture. */
  profilePhotoPath?: string
  email: string
  phone: string
  telegram?: string
  viber?: string
  address1: string
  address2?: string
  cityId: string
  stateId: string
  serviceRegionId: string
  hasRentingExperience: boolean
}

export const agentRegistrationApi = {
  submit(input: AgentRegistrationInput) {
    return apiRequest<{ profile: unknown }>('/registrations/agent', {
      method: 'POST',
      body: input,
    })
  },
}
