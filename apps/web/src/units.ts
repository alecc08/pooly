export type TempUnit = 'C' | 'F'
export type SaltUnit = 'ppm' | 'g/L'
export type ConcUnit = 'mg/L' | 'ppm'
export type HardnessUnit = 'ppm' | '°dH' | '°f'

export const celsiusToFahrenheit = (c: number) => c * 9 / 5 + 32
export const fahrenheitToCelsius = (f: number) => (f - 32) * 5 / 9
export const ppmToGramsPerLiter = (ppm: number) => ppm / 1000
export const gramsPerLiterToPpm = (gpl: number) => gpl * 1000
export const ppmToGermanDegrees = (ppm: number) => ppm / 17.848
export const germanDegreesToPpm = (dh: number) => dh * 17.848
export const ppmToFrenchDegrees = (ppm: number) => ppm / 10
export const frenchDegreesToPpm = (of: number) => of * 10

type Range = { ideal: [number, number]; acceptable: [number, number] }

/** Applies a converter across an {ideal, acceptable} range pair (identity if unit === canonical). */
export function convertRange(range: Range, convert: (n: number) => number): Range {
  return {
    ideal: [convert(range.ideal[0]), convert(range.ideal[1])],
    acceptable: [convert(range.acceptable[0]), convert(range.acceptable[1])],
  }
}

type UnitSettings = { temp_unit?: TempUnit; salt_unit?: SaltUnit; hardness_unit?: HardnessUnit }

/**
 * Single source of truth for "which converter applies to this param, given an
 * installation's chosen units". Only temp/salt/hardness ever convert — every
 * other param (ph, cl, br, cc, tac) is display-label-only. Returns null for identity
 * (no conversion needed), so callers do `const c = metricToDisplayConverter(...); c ? c(v) : v`.
 */
export function metricToDisplayConverter(param: string, installation?: UnitSettings): ((n: number) => number) | null {
  if (param === 'temp' && installation?.temp_unit === 'F') return celsiusToFahrenheit
  if (param === 'salt' && installation?.salt_unit === 'g/L') return ppmToGramsPerLiter
  if (param === 'hardness') {
    if (installation?.hardness_unit === '°dH') return ppmToGermanDegrees
    if (installation?.hardness_unit === '°f') return ppmToFrenchDegrees
  }
  return null
}

export function displayToMetricConverter(param: string, installation?: UnitSettings): ((n: number) => number) | null {
  if (param === 'temp' && installation?.temp_unit === 'F') return fahrenheitToCelsius
  if (param === 'salt' && installation?.salt_unit === 'g/L') return gramsPerLiterToPpm
  if (param === 'hardness') {
    if (installation?.hardness_unit === '°dH') return germanDegreesToPpm
    if (installation?.hardness_unit === '°f') return frenchDegreesToPpm
  }
  return null
}

/** Rounds for display purposes (avoid "75.19999999999999°F"). */
export function formatUnitRange([min, max]: [number, number], decimals = 1): string {
  const round = (n: number) => {
    const factor = 10 ** decimals
    return Math.round(n * factor) / factor
  }
  return `${round(min)} – ${round(max)}`
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(n * factor) / factor
}

export type MassDisplay = { value: number; unit: 'g' | 'kg' | 'oz' | 'lb' }
export type VolumeDisplay = { value: number; unit: 'mL' | 'L' | 'fl_oz' | 'gal' }

const G_PER_OZ = 28.3495
const G_PER_LB = 453.592
const ML_PER_FL_OZ = 29.5735
const ML_PER_GAL = 3785.41

/** Converts a dosage mass (always given in grams — dosage.py's canonical unit) to a
 * display-friendly value+unit pair, imperial when the installation's volume is tracked
 * in gallons, metric otherwise. Crosses to the coarser unit past a natural threshold
 * (1000g -> kg, 16oz -> lb) so amounts don't read as "1400 g" or "20 oz". */
export function gramsToDisplay(grams: number, volumeUnit?: 'L' | 'gal'): MassDisplay {
  if (volumeUnit === 'gal') {
    const oz = grams / G_PER_OZ
    if (oz >= 16) return { value: roundTo(grams / G_PER_LB, 2), unit: 'lb' }
    return { value: roundTo(oz, 1), unit: 'oz' }
  }
  if (grams >= 1000) return { value: roundTo(grams / 1000, 2), unit: 'kg' }
  return { value: roundTo(grams, 1), unit: 'g' }
}

/** Same idea as gramsToDisplay for liquid dosage amounts (dosage.py returns mL). */
export function mlToDisplay(mL: number, volumeUnit?: 'L' | 'gal'): VolumeDisplay {
  if (volumeUnit === 'gal') {
    const flOz = mL / ML_PER_FL_OZ
    if (mL >= ML_PER_GAL) return { value: roundTo(mL / ML_PER_GAL, 2), unit: 'gal' }
    return { value: roundTo(flOz, 1), unit: 'fl_oz' }
  }
  if (mL >= 1000) return { value: roundTo(mL / 1000, 2), unit: 'L' }
  return { value: roundTo(mL, 1), unit: 'mL' }
}
