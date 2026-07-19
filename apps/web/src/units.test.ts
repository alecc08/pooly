import { describe, it, expect } from 'vitest'
import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  ppmToGramsPerLiter,
  gramsPerLiterToPpm,
  ppmToGermanDegrees,
  germanDegreesToPpm,
  ppmToFrenchDegrees,
  frenchDegreesToPpm,
  convertRange,
  formatUnitRange,
  gramsToDisplay,
  mlToDisplay,
} from './units'

describe('temperature conversion', () => {
  it('0°C = 32°F', () => {
    expect(celsiusToFahrenheit(0)).toBe(32)
    expect(fahrenheitToCelsius(32)).toBe(0)
  })
  it('100°C = 212°F', () => {
    expect(celsiusToFahrenheit(100)).toBe(212)
    expect(fahrenheitToCelsius(212)).toBe(100)
  })
  it('24°C ≈ 75.2°F', () => {
    expect(celsiusToFahrenheit(24)).toBeCloseTo(75.2, 5)
    expect(fahrenheitToCelsius(75.2)).toBeCloseTo(24, 5)
  })
})

describe('salt conversion', () => {
  it('3000ppm = 3g/L', () => {
    expect(ppmToGramsPerLiter(3000)).toBe(3)
    expect(gramsPerLiterToPpm(3)).toBe(3000)
  })
})

describe('hardness conversion', () => {
  it('178.48ppm ≈ 10°dH', () => {
    expect(ppmToGermanDegrees(178.48)).toBeCloseTo(10, 5)
    expect(germanDegreesToPpm(10)).toBeCloseTo(178.48, 5)
  })
  it('100ppm = 10°f', () => {
    expect(ppmToFrenchDegrees(100)).toBe(10)
    expect(frenchDegreesToPpm(10)).toBe(100)
  })
})

describe('convertRange', () => {
  it('applies converter across ideal and acceptable pairs', () => {
    const range = { ideal: [24, 28] as [number, number], acceptable: [15, 35] as [number, number] }
    const converted = convertRange(range, celsiusToFahrenheit)
    expect(converted.ideal[0]).toBeCloseTo(75.2, 5)
    expect(converted.ideal[1]).toBeCloseTo(82.4, 5)
    expect(converted.acceptable[0]).toBeCloseTo(59, 5)
    expect(converted.acceptable[1]).toBeCloseTo(95, 5)
  })
})

describe('formatUnitRange', () => {
  it('rounds to avoid floating point noise', () => {
    expect(formatUnitRange([celsiusToFahrenheit(24), celsiusToFahrenheit(28)])).toBe('75.2 – 82.4')
  })
  it('drops trailing zeros for whole numbers', () => {
    expect(formatUnitRange([100, 500])).toBe('100 – 500')
  })
})

describe('gramsToDisplay', () => {
  it('stays in grams under the kg threshold (metric)', () => {
    expect(gramsToDisplay(999, 'L')).toEqual({ value: 999, unit: 'g' })
  })
  it('crosses to kg at 1000g (metric)', () => {
    expect(gramsToDisplay(1000, 'L')).toEqual({ value: 1, unit: 'kg' })
  })
  it('defaults to metric when volumeUnit is omitted', () => {
    expect(gramsToDisplay(500)).toEqual({ value: 500, unit: 'g' })
  })
  it('stays in oz under the lb threshold (imperial)', () => {
    const { unit, value } = gramsToDisplay(400, 'gal')
    expect(unit).toBe('oz')
    expect(value).toBeCloseTo(14.1, 1)
  })
  it('crosses to lb at 16oz (imperial)', () => {
    const { unit, value } = gramsToDisplay(500, 'gal')
    expect(unit).toBe('lb')
    expect(value).toBeCloseTo(1.1, 1)
  })
})

describe('mlToDisplay', () => {
  it('stays in mL under the L threshold (metric)', () => {
    expect(mlToDisplay(999, 'L')).toEqual({ value: 999, unit: 'mL' })
  })
  it('crosses to L at 1000mL (metric)', () => {
    expect(mlToDisplay(1000, 'L')).toEqual({ value: 1, unit: 'L' })
  })
  it('stays in fl oz under the gal threshold (imperial)', () => {
    const { unit, value } = mlToDisplay(500, 'gal')
    expect(unit).toBe('fl_oz')
    expect(value).toBeCloseTo(16.9, 1)
  })
  it('crosses to gal at 3785.41mL (imperial)', () => {
    const { unit, value } = mlToDisplay(3785.41, 'gal')
    expect(unit).toBe('gal')
    expect(value).toBeCloseTo(1, 2)
  })
})
