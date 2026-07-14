import { describe, it, expect } from 'vitest'
import type { Action, InstallationWaterParams } from './types'
import {
  getActionsThisMonth,
  daysSinceLastAction,
  extractLastPh,
  getSelStatus,
  getStabilisantStatus,
  getCcStatus,
  extractMeasuredParams,
  installationParamsToRanges,
} from './utils'

const makeAction = (overrides: Partial<Action> = {}): Action => ({
  id: 1,
  date: '2026-02-24',
  action_type: 'Test',
  user_id: 1,
  product_id: null,
  qty: '',
  unit: '',
  notes: '',
  created_at: '2026-02-24T00:00:00',
  ...overrides,
})

describe('getActionsThisMonth', () => {
  it('returns actions matching the given year-month', () => {
    const actions = [
      makeAction({ id: 1, date: '2026-02-10' }),
      makeAction({ id: 2, date: '2026-01-15' }),
    ]
    expect(getActionsThisMonth(actions, '2026-02')).toHaveLength(1)
  })

  it('returns empty for no match', () => {
    const actions = [makeAction({ date: '2026-01-15' })]
    expect(getActionsThisMonth(actions, '2026-02')).toHaveLength(0)
  })
})

describe('daysSinceLastAction', () => {
  it('returns 0 for empty list', () => {
    expect(daysSinceLastAction([])).toBe(0)
  })
})

describe('extractLastPh', () => {
  it('returns — for empty list', () => {
    expect(extractLastPh([])).toBe('—')
  })

  it('returns — when no pH in notes', () => {
    const actions = [makeAction({ notes: 'eau claire' })]
    expect(extractLastPh(actions)).toBe('—')
  })

  it('extracts pH value from notes field', () => {
    const actions = [makeAction({ notes: 'pH 7.4, tout ok' })]
    expect(extractLastPh(actions)).toBe('7.4')
  })

  it('returns most recent pH when multiple actions', () => {
    const actions = [
      makeAction({ id: 1, date: '2026-02-24', notes: 'pH 7.4' }),
      makeAction({ id: 2, date: '2026-02-20', notes: 'pH 7.1' }),
    ]
    expect(extractLastPh(actions)).toBe('7.4')
  })
})

describe('getSelStatus', () => {
  it('normal within 2700-3400', () => {
    expect(getSelStatus(3000)).toBe('normal')
    expect(getSelStatus(2700)).toBe('normal')
    expect(getSelStatus(3400)).toBe('normal')
  })
  it('warn within acceptable band 2500-4500', () => {
    expect(getSelStatus(2600)).toBe('warn')
    expect(getSelStatus(4000)).toBe('warn')
  })
  it('bad outside acceptable band', () => {
    expect(getSelStatus(2000)).toBe('bad')
    expect(getSelStatus(5000)).toBe('bad')
  })
  it('respects custom ranges', () => {
    const ranges = { sel: { ideal: [1000, 2000] as [number, number], acceptable: [500, 3000] as [number, number] } }
    expect(getSelStatus(1500, ranges)).toBe('normal')
    expect(getSelStatus(2500, ranges)).toBe('warn')
    expect(getSelStatus(4000, ranges)).toBe('bad')
  })
})

describe('getStabilisantStatus', () => {
  it('normal within 60-80', () => {
    expect(getStabilisantStatus(70)).toBe('normal')
  })
  it('warn within acceptable band 30-100', () => {
    expect(getStabilisantStatus(40)).toBe('warn')
    expect(getStabilisantStatus(90)).toBe('warn')
  })
  it('bad outside acceptable band', () => {
    expect(getStabilisantStatus(10)).toBe('bad')
    expect(getStabilisantStatus(150)).toBe('bad')
  })
})

describe('getCcStatus', () => {
  it('normal within 0-0.2', () => {
    expect(getCcStatus(0)).toBe('normal')
    expect(getCcStatus(0.2)).toBe('normal')
  })
  it('warn within acceptable band 0-0.5', () => {
    expect(getCcStatus(0.4)).toBe('warn')
  })
  it('bad outside acceptable band', () => {
    expect(getCcStatus(0.8)).toBe('bad')
  })
})

describe('extractMeasuredParams — sel/stabilisant/cc', () => {
  it('parses sel, stabilisant, combiné from notes', () => {
    const actions = [makeAction({ action_type: 'Mesure', notes: 'sel: 3200. stabilisant: 65. combiné: 0.3' })]
    const p = extractMeasuredParams(actions)
    expect(p.salt).toBe(3200)
    expect(p.stabilisant).toBe(65)
    expect(p.cc).toBe(0.3)
  })

  it('is case-insensitive', () => {
    const actions = [makeAction({ action_type: 'Mesure', notes: 'SEL: 2900. STABILISANT: 55. COMBINÉ: 0.1' })]
    const p = extractMeasuredParams(actions)
    expect(p.salt).toBe(2900)
    expect(p.stabilisant).toBe(55)
    expect(p.cc).toBe(0.1)
  })

  it('parses English "salt" fallback for sel', () => {
    const actions = [makeAction({ action_type: 'Mesure', notes: 'salt: 3100' })]
    const p = extractMeasuredParams(actions)
    expect(p.salt).toBe(3100)
  })

  it('does not false-positive on unrelated text mentioning "sel"', () => {
    const actions = [makeAction({ action_type: 'Mesure', notes: 'Ajout de sel dans le bassin' })]
    const p = extractMeasuredParams(actions)
    expect(p.salt).toBeNull()
  })

  it('parses chlore and combiné independently without collision', () => {
    const actions = [makeAction({ action_type: 'Mesure', notes: 'chlore: 1.5. combiné: 0.3' })]
    const p = extractMeasuredParams(actions)
    expect(p.chlore).toBe(1.5)
    expect(p.cc).toBe(0.3)
  })
})

describe('installationParamsToRanges — salt/cya/cc', () => {
  it('maps salt→sel, cya→stabilisant, cc→cc', () => {
    const params: InstallationWaterParams = {
      ph: { ideal: [7.2, 7.6], acceptable: [6.8, 7.8] },
      tac: { ideal: [80, 180], acceptable: [60, 200] },
      temp: { ideal: [24, 28], acceptable: [15, 35] },
      salt: { ideal: [2700, 3400], acceptable: [2500, 4500] },
      cya: { ideal: [60, 80], acceptable: [30, 100] },
      cc: { ideal: [0, 0.2], acceptable: [0, 0.5] },
    }
    const ranges = installationParamsToRanges(params)
    expect(ranges.sel).toEqual({ ideal: [2700, 3400], acceptable: [2500, 4500] })
    expect(ranges.stabilisant).toEqual({ ideal: [60, 80], acceptable: [30, 100] })
    expect(ranges.cc).toEqual({ ideal: [0, 0.2], acceptable: [0, 0.5] })
  })
})
