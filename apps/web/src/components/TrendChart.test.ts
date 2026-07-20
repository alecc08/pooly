import { describe, it, expect } from 'vitest'
import { pointStatus, computeDomain } from './TrendChart'

describe('pointStatus', () => {
  it('returns ok inside the ideal band', () => {
    expect(pointStatus(7.2, 7.0, 7.6, 6.8, 7.8)).toBe('ok')
    expect(pointStatus(7.0, 7.0, 7.6, 6.8, 7.8)).toBe('ok')
    expect(pointStatus(7.6, 7.0, 7.6, 6.8, 7.8)).toBe('ok')
  })

  it('returns warn between ideal and acceptable', () => {
    expect(pointStatus(6.9, 7.0, 7.6, 6.8, 7.8)).toBe('warn')
    expect(pointStatus(7.7, 7.0, 7.6, 6.8, 7.8)).toBe('warn')
  })

  it('returns danger outside the acceptable band', () => {
    expect(pointStatus(6.5, 7.0, 7.6, 6.8, 7.8)).toBe('danger')
    expect(pointStatus(8.5, 7.0, 7.6, 6.8, 7.8)).toBe('danger')
  })

  it('falls back to warn outside ideal when no acceptable band given', () => {
    expect(pointStatus(6.5, 7.0, 7.6)).toBe('warn')
    expect(pointStatus(7.2, 7.0, 7.6)).toBe('ok')
  })

  it('returns ok when no bands at all', () => {
    expect(pointStatus(42)).toBe('ok')
  })
})

describe('computeDomain', () => {
  it('covers data and ideal band with 8% padding', () => {
    const [min, max] = computeDomain(
      [{ date: '2026-01-01', value: 7.2 }, { date: '2026-01-08', value: 7.4 }],
      7.0,
      7.6,
    )
    expect(min).toBeLessThan(7.0)
    expect(max).toBeGreaterThan(7.6)
    // Padding is 8% of the raw spread (0.6)
    expect(min).toBeCloseTo(7.0 - 0.6 * 0.08, 5)
    expect(max).toBeCloseTo(7.6 + 0.6 * 0.08, 5)
  })

  it('handles flat data with a ±1 spread', () => {
    const [min, max] = computeDomain([
      { date: '2026-01-01', value: 5 },
      { date: '2026-01-02', value: 5 },
    ])
    expect(min).toBeLessThan(5)
    expect(max).toBeGreaterThan(5)
    expect(max - min).toBeGreaterThanOrEqual(2)
  })

  it('returns [0,1] for no data and no bands', () => {
    expect(computeDomain([])).toEqual([0, 1])
  })

  it('extends below the data when the ideal band sits lower', () => {
    const [min] = computeDomain([{ date: '2026-01-01', value: 200 }, { date: '2026-01-02', value: 210 }], 80, 180)
    expect(min).toBeLessThan(80)
  })
})
