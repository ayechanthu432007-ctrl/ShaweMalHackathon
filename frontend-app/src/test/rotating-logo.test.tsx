import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RotatingLogo } from '@/features/home/components/RotatingLogo'
import { renderWithProviders } from '@/test/utils'

describe('rotating 3D logo', () => {
  it('is one labelled image built from stacked copies of the original logo', () => {
    renderWithProviders(<RotatingLogo alt="Shawe Mal logo" />)

    const logo = screen.getByRole('img', { name: 'Shawe Mal logo' })
    const layers = [...logo.querySelectorAll('img')]
    // Every layer is the same untouched artwork; only its depth differs.
    expect(layers.length).toBeGreaterThanOrEqual(12)
    expect(new Set(layers.map((layer) => layer.getAttribute('src'))).size).toBe(1)
    expect(new Set(layers.map((layer) => layer.style.transform)).size).toBe(layers.length)

    // The outer copies are the sharp faces, the ones between them form the darker edge.
    expect(layers[0]).toHaveClass('logo3d-face')
    expect(layers.at(-1)).toHaveClass('logo3d-face')
    expect(layers.slice(1, -1).every((layer) => layer.classList.contains('logo3d-edge'))).toBe(true)
    // Screen readers hear one logo, not sixteen.
    expect(layers.every((layer) => layer.getAttribute('aria-hidden') === 'true')).toBe(true)
  })
})
