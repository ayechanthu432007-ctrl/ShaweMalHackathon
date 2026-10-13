import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UserAvatar } from '@/components/common/UserAvatar'
import { SingleImageUploadField } from '@/components/uploads/SingleImageUploadField'
import { AgentContactCard } from '@/features/houses/components/AgentContactCard'
import { renderWithProviders } from '@/test/utils'

describe('agent profile photo', () => {
  it("shows the agent's uploaded photo on the agent card", () => {
    const { container } = renderWithProviders(
      <AgentContactCard house={{ id: 'h1', agent: { id: 'a1', name: 'Mg Mg', profilePicturePath: 'uploads/profile/agent.jpg' }, contact: {} }} />,
    )

    expect(container.querySelector('img')?.getAttribute('src')).toContain('uploads/profile/agent.jpg')
    expect(container.querySelector('[data-default-avatar]')).toBeNull()
  })

  it('falls back to a default avatar when the agent has no photo', () => {
    const { container } = renderWithProviders(<AgentContactCard house={{ id: 'h1', agent: { id: 'a1', name: 'Mg Mg' }, contact: {} }} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('[data-default-avatar]')).toHaveTextContent('M')
  })

  it('shows a generic avatar when there is neither a photo nor a name', () => {
    const { container } = renderWithProviders(<UserAvatar />)

    expect(container.querySelector('[data-default-avatar] svg')).not.toBeNull()
  })

  it('labels the upload button "Upload Photo", then "Replace photo" with a remove control once a photo is set', () => {
    const { rerender } = renderWithProviders(<SingleImageUploadField path="" onChange={() => {}} category="profile" />)
    expect(screen.getByRole('button', { name: 'Upload Photo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add photo/i })).not.toBeInTheDocument()

    rerender(<SingleImageUploadField path="uploads/profile/agent.jpg" onChange={() => {}} category="profile" />)
    expect(screen.getByRole('button', { name: /replace/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument()
    expect(document.querySelector('img')?.getAttribute('src')).toContain('uploads/profile/agent.jpg')
  })
})
