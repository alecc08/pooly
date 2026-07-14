import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InstallationModal from './InstallationModal'
import { translations } from '../i18n/translations'

vi.mock('../context/LocaleContext', () => ({
  useT: () => ({
    locale: 'fr',
    setLocale: vi.fn(),
    t: (key: string) => (translations.fr as Record<string, string>)[key] ?? key,
  }),
}))

const mockAddInstallation = vi.fn()
vi.mock('../context/InstallationContext', () => ({
  useInstallation: () => ({
    installations: [],
    active: null,
    ranges: null,
    setActive: vi.fn(),
    refresh: vi.fn(),
    addInstallation: mockAddInstallation,
  }),
}))

beforeEach(() => {
  mockAddInstallation.mockReset()
  mockAddInstallation.mockResolvedValue({ id: 1 })
})

describe('InstallationModal', () => {
  it('submits with volume and unit when provided', async () => {
    render(<InstallationModal open onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Ma piscine' } })
    fireEvent.change(screen.getByPlaceholderText('45000'), { target: { value: '45000' } })
    fireEvent.click(screen.getByText('gal'))
    fireEvent.click(screen.getByText("Créer l'installation"))

    await waitFor(() => expect(mockAddInstallation).toHaveBeenCalledTimes(1))
    expect(mockAddInstallation).toHaveBeenCalledWith(
      expect.objectContaining({ volume: 45000, volume_unit: 'gal' })
    )
  })

  it('omits volume when left empty', async () => {
    render(<InstallationModal open onClose={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Ma piscine' } })
    fireEvent.click(screen.getByText("Créer l'installation"))

    await waitFor(() => expect(mockAddInstallation).toHaveBeenCalledTimes(1))
    const arg = mockAddInstallation.mock.calls[0][0]
    expect(arg.volume).toBeUndefined()
  })
})
