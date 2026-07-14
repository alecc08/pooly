import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Timeline from './Timeline'
import { LocaleContext } from '../context/LocaleContext'
import { translations } from '../i18n/translations'

describe('Timeline — English locale', () => {
  it('renders table headers in English, including Detail', () => {
    render(
      <LocaleContext.Provider value={{ locale: 'en', setLocale: vi.fn(), t: key => (translations.en as Record<string, string>)[key] ?? key }}>
        <Timeline actions={[]} products={[]} />
      </LocaleContext.Provider>
    )

    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Detail')).toBeInTheDocument()
    expect(screen.getByText('Notes')).toBeInTheDocument()
  })
})
