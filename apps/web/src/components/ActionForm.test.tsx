import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActionForm from './ActionForm'
import type { Action, Installation } from '../types'
import { translations } from '../i18n/translations'

const products = [{ id: 1, name: 'Chlore', type: 'seed', unit_default: 'g' }]

// Mocked directly rather than mounted via real providers: LocaleContext and
// InstallationContext are both unconditionally required by ActionForm, and the
// real InstallationProvider issues a `fetch('/api/installations')` on mount that
// hangs in jsdom. Mocking keeps these tests fast and deterministic.
vi.mock('../context/LocaleContext', () => ({
  useT: () => ({
    locale: 'fr',
    setLocale: vi.fn(),
    t: (key: string) => (translations.fr as Record<string, string>)[key] ?? key,
  }),
}))

const mockUseInstallation = vi.fn()
vi.mock('../context/InstallationContext', () => ({
  useInstallation: () => mockUseInstallation(),
}))

function makeInstallation(overrides: Partial<Installation> = {}): Installation {
  return {
    id: 1,
    user_id: 1,
    name: 'Ma piscine',
    type: 'piscine',
    sanitizer: 'chlore',
    created_at: '2026-01-01T00:00:00',
    ...overrides,
  }
}

function setActiveInstallation(installation: Installation) {
  mockUseInstallation.mockReturnValue({
    active: installation,
    ranges: null,
    installations: [installation],
    setActive: vi.fn(),
    refresh: vi.fn(),
    addInstallation: vi.fn(),
  })
}

function makeMesureAction(overrides: Partial<Action> = {}): Action {
  return {
    id: 1,
    date: '2026-02-24',
    action_type: 'Mesure',
    user_id: 1,
    product_id: null,
    qty: '7.4',
    unit: '',
    notes: '',
    created_at: '2026-02-24T00:00:00',
    ...overrides,
  }
}

beforeEach(() => {
  mockUseInstallation.mockReset()
  localStorage.clear()
  localStorage.setItem('pooly_mesure_mode', 'appareil')
})

describe('ActionForm', () => {
  it('calls onAdd with structured payload when submitted', () => {
    setActiveInstallation(makeInstallation())
    const onAdd = vi.fn()
    render(<ActionForm onAdd={onAdd} products={products} />)

    fireEvent.click(screen.getByText('Enregistrer'))

    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(onAdd).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          action_type: expect.any(String),
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      ])
    )
  })

  it('calls onClose after submit when provided', () => {
    setActiveInstallation(makeInstallation())
    const onAdd = vi.fn()
    const onClose = vi.fn()
    render(<ActionForm onAdd={onAdd} products={products} onClose={onClose} />)

    fireEvent.click(screen.getByText('Enregistrer'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sel installation, appareil mode: renders Sel, Stabilisant and Chlore combiné fields', () => {
    setActiveInstallation(makeInstallation({ sanitizer: 'sel' }))
    const editAction = makeMesureAction()
    render(<ActionForm products={products} editAction={editAction} onEdit={vi.fn()} />)

    expect(screen.getByText('Sel')).toBeInTheDocument()
    expect(screen.getByText('Stabilisant (CYA)')).toBeInTheDocument()
    expect(screen.getByText('Chlore combiné (CC)')).toBeInTheDocument()
  })

  it('chlore installation, appareil mode: renders Chlore combiné field', () => {
    setActiveInstallation(makeInstallation({ sanitizer: 'chlore' }))
    const editAction = makeMesureAction()
    render(<ActionForm products={products} editAction={editAction} onEdit={vi.fn()} />)

    expect(screen.getByText('Chlore combiné (CC)')).toBeInTheDocument()
  })

  it('brome installation, appareil mode: does not render Chlore combiné field', () => {
    setActiveInstallation(makeInstallation({ sanitizer: 'brome' }))
    const editAction = makeMesureAction()
    render(<ActionForm products={products} editAction={editAction} onEdit={vi.fn()} />)

    expect(screen.queryByText('Chlore combiné (CC)')).not.toBeInTheDocument()
  })

  it('filling sel/stabilisant/cc fields and submitting includes them in the payload notes', () => {
    setActiveInstallation(makeInstallation({ sanitizer: 'sel' }))
    const editAction = makeMesureAction()
    const onEdit = vi.fn()
    render(<ActionForm products={products} editAction={editAction} onEdit={onEdit} />)

    fireEvent.change(screen.getByPlaceholderText('3000'), { target: { value: '3000' } })
    fireEvent.change(screen.getByPlaceholderText('70'), { target: { value: '70' } })
    fireEvent.change(screen.getByPlaceholderText('0.1'), { target: { value: '0.3' } })

    fireEvent.click(screen.getByText('Enregistrer les modifications'))

    expect(onEdit).toHaveBeenCalledTimes(1)
    const [, payload] = onEdit.mock.calls[0]
    expect(payload.notes).toContain('sel: 3000')
    expect(payload.notes).toContain('stabilisant: 70')
    expect(payload.notes).toContain('combiné: 0.3')
  })

  it('bandelette mode for a sel installation does not render a salt/CYA/CC swatch panel', () => {
    localStorage.setItem('pooly_mesure_mode', 'bandelette')
    setActiveInstallation(makeInstallation({ sanitizer: 'sel' }))
    const editAction = makeMesureAction()
    render(<ActionForm products={products} editAction={editAction} onEdit={vi.fn()} />)

    expect(screen.queryByText('Sel')).not.toBeInTheDocument()
    expect(screen.queryByText('Stabilisant (CYA)')).not.toBeInTheDocument()
    expect(screen.queryByText('Chlore combiné (CC)')).not.toBeInTheDocument()
  })
})
