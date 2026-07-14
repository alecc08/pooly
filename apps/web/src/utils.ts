import type { Action, InstallationWaterParams } from './types'

// ── Water status ──────────────────────────────────────────────────────────────

export type WaterStatus = 'clear' | 'cloudy' | 'green'

// Sel, stabilisant (CYA), CC and dureté are tracked/displayed but deliberately
// excluded from the clear/cloudy/green heuristic below (same precedent as durete).
export type WaterParams = {
  ph: number | null
  chlore: number | null
  tac: number | null
  brome?: number | null
}

/**
 * Per-installation range overrides. Each key is optional; absent keys fall back to PARAM_RANGES.
 */
export type DynamicRanges = {
  ph?: { ideal: [number, number]; acceptable: [number, number] }
  chlore?: { ideal: [number, number]; acceptable: [number, number] }
  brome?: { ideal: [number, number]; acceptable: [number, number] }
  tac?: { ideal: [number, number]; acceptable: [number, number] }
  temp?: { ideal: [number, number]; acceptable: [number, number] }
  sel?: { ideal: [number, number]; acceptable: [number, number] }
  stabilisant?: { ideal: [number, number]; acceptable: [number, number] }
  cc?: { ideal: [number, number]; acceptable: [number, number] }
}

/** Convert API InstallationWaterParams to DynamicRanges (cl→chlore, br→brome, salt→sel, cya→stabilisant). */
export function installationParamsToRanges(params: InstallationWaterParams): DynamicRanges {
  return {
    ph: params.ph,
    tac: params.tac,
    temp: params.temp,
    chlore: params.cl,
    brome: params.br,
    sel: params.salt,
    stabilisant: params.cya,
    cc: params.cc,
  }
}

/** Centralised reference ranges. Use these everywhere — never duplicate. */
export const PARAM_RANGES = {
  ph:          { ideal: [7.0, 7.6]     as [number, number], acceptable: [6.8, 7.8]     as [number, number] },
  chlore:      { ideal: [0.5, 3.0]     as [number, number], acceptable: [0.3, 4.0]     as [number, number] },
  tac:         { ideal: [80, 180]      as [number, number], acceptable: [60, 200]      as [number, number] },
  temp:        { ideal: [24, 28]       as [number, number], acceptable: [15, 35]       as [number, number] },
  brome:       { ideal: [2, 5]         as [number, number], acceptable: [1, 10]        as [number, number] },
  durete:      { ideal: [100, 500]     as [number, number], acceptable: [50, 1000]     as [number, number] },
  sel:         { ideal: [2700, 3400]   as [number, number], acceptable: [2500, 4500]   as [number, number] },
  stabilisant: { ideal: [60, 80]       as [number, number], acceptable: [30, 100]      as [number, number] },
  cc:          { ideal: [0, 0.2]       as [number, number], acceptable: [0, 0.5]       as [number, number] },
}

/**
 * Bandelette-specific OK thresholds — used for summary pills.
 * Source of truth shared between the form and getWaterStatus.
 */
export const BANDELETTE_OK_RANGES = {
  ph:     PARAM_RANGES.ph.acceptable,
  tac:    PARAM_RANGES.tac.ideal,
  brome:  PARAM_RANGES.brome.ideal,
  durete: PARAM_RANGES.durete.ideal,
}

/** Action types that carry water-quality measurements. */
const MEASURE_ACTION_TYPES = ['Mesure de pH', 'Mesure']

/** Extracts the most recent pH, chlore libre and TAC values from actions. */
export function extractWaterParams(actions: Action[]): WaterParams {
  const sorted = [...actions].sort((a, b) => b.date.localeCompare(a.date))
  let ph: number | null = null
  let chlore: number | null = null
  let tac: number | null = null

  for (const action of sorted) {
    // pH: dedicated measurement stores value in qty
    if (ph === null && MEASURE_ACTION_TYPES.includes(action.action_type) && action.qty) {
      const v = parseFloat(action.qty)
      if (!isNaN(v)) ph = v
    }
    // pH fallback: parse from notes (e.g. "pH 7.2")
    if (ph === null && action.notes) {
      const m = action.notes.match(/pH\s*([\d.]+)/i)
      if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) ph = v }
    }
    // Chlore libre: parse from notes (e.g. "chlore libre: 1.5")
    if (chlore === null && action.notes) {
      const m = action.notes.match(/chlore?\s*(?:libre)?\s*:?\s*([\d.]+)/i)
      if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) chlore = v }
    }
    // TAC: parse from notes (e.g. "TAC: 120")
    if (tac === null && action.notes) {
      const m = action.notes.match(/TAC\s*:?\s*([\d.]+)/i)
      if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) tac = v }
    }
    if (ph !== null && chlore !== null && tac !== null) break
  }

  return { ph, chlore, tac }
}

/**
 * Pure function — returns the water status from measured parameters.
 * Priority: green > cloudy > clear.
 * hasData is false when no measurement has been recorded yet.
 */
export function getWaterStatus(params: WaterParams, ranges?: DynamicRanges): { status: WaterStatus; hasData: boolean } {
  const { ph, chlore, tac, brome = null } = params
  const hasData = ph !== null || chlore !== null || tac !== null || brome !== null

  if (!hasData) return { status: 'clear', hasData: false }

  const rph    = ranges?.ph     ?? PARAM_RANGES.ph
  const rcl    = ranges?.chlore ?? PARAM_RANGES.chlore
  const rbr    = ranges?.brome  ?? PARAM_RANGES.brome
  const rtac   = ranges?.tac    ?? PARAM_RANGES.tac

  // Green — most severe, checked first
  if (
    (ph     !== null && !inRange(ph,     rph.acceptable))  ||
    (chlore !== null && !inRange(chlore, rcl.acceptable))  ||
    (brome  !== null && !inRange(brome,  rbr.acceptable))  ||
    (tac    !== null && !inRange(tac,    rtac.acceptable))
  ) {
    return { status: 'green', hasData: true }
  }

  // Cloudy
  if (
    (ph     !== null && !inRange(ph,     rph.ideal))  ||
    (chlore !== null && !inRange(chlore, rcl.ideal))  ||
    (brome  !== null && !inRange(brome,  rbr.ideal))  ||
    (tac    !== null && !inRange(tac,    rtac.ideal))
  ) {
    return { status: 'cloudy', hasData: true }
  }

  return { status: 'clear', hasData: true }
}

export function getActionsThisMonth(actions: Action[], yearMonth: string): Action[] {
  return actions.filter(a => a.date.startsWith(yearMonth))
}

export function daysSinceLastAction(actions: Action[]): number {
  if (actions.length === 0) return 0
  const sorted = [...actions].sort((a, b) => b.date.localeCompare(a.date))
  const [year, month, day] = sorted[0].date.split('-').map(Number)
  const lastUtc = Date.UTC(year, month - 1, day)
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((todayUtc - lastUtc) / (1000 * 60 * 60 * 24))
}

export function extractLastPh(actions: Action[]): string {
  const sorted = [...actions].sort((a, b) => b.date.localeCompare(a.date))
  for (const action of sorted) {
    const match = action.notes.match(/pH\s*([\d.]+)/)
    if (match) return match[1]
  }
  return '—'
}

// ── Extended measured params ───────────────────────────────────────────────

export type MeasuredParams = {
  ph: number | null
  chlore: number | null
  tac: number | null
  temp: number | null
  brome: number | null
  durete: number | null
  salt: number | null
  stabilisant: number | null
  cc: number | null
  date: string | null
}

export type ParamStatus = 'normal' | 'warn' | 'bad'

export type PhPoint = { date: string; ph: number }

export type TodoItem = {
  id: string
  icon: string
  iconBg: string
  title: string
  subtitle: string
  delay: string
  isOverdue: boolean
}

/**
 * Extracts the most recent measured values for pH, chlore, TAC and temperature
 * from the action log. Also returns the date of the most recent contributing entry.
 */
export function extractMeasuredParams(actions: Action[]): MeasuredParams {
  const sorted = [...actions].sort((a, b) => b.date.localeCompare(a.date))
  let ph: number | null = null
  let chlore: number | null = null
  let tac: number | null = null
  let temp: number | null = null
  let brome: number | null = null
  let durete: number | null = null
  let salt: number | null = null
  let stabilisant: number | null = null
  let cc: number | null = null
  let date: string | null = null

  for (const action of sorted) {
    let contributed = false

    // pH: dedicated measurement stores value in qty
    if (ph === null && MEASURE_ACTION_TYPES.includes(action.action_type) && action.qty) {
      const v = parseFloat(action.qty)
      if (!isNaN(v)) { ph = v; contributed = true }
    }
    // pH fallback: parse from notes
    if (ph === null && action.notes) {
      const m = action.notes.match(/pH\s*([\d.]+)/i)
      if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) { ph = v; contributed = true } }
    }
    // Chlore libre
    if (chlore === null && action.notes) {
      const m = action.notes.match(/chlore?\s*(?:libre)?\s*:?\s*([\d.]+)/i)
      if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) { chlore = v; contributed = true } }
    }
    // TAC
    if (tac === null && action.notes) {
      const m = action.notes.match(/TAC\s*:?\s*([\d.]+)/i)
      if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) { tac = v; contributed = true } }
    }
    // Température
    if (temp === null && action.notes) {
      const m = action.notes.match(/temp[eé]rature?\s*:?\s*([\d.]+)|T°?\s*:?\s*([\d.]+)/i)
      if (m) {
        const v = parseFloat(m[1] ?? m[2])
        if (!isNaN(v)) { temp = v; contributed = true }
      }
    }
    // Brome total
    if (brome === null && action.notes) {
      const m = action.notes.match(/brome\s*(?:total)?\s*:?\s*([\d.]+)/i)
      if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) { brome = v; contributed = true } }
    }
    // Dureté totale
    if (durete === null && action.notes) {
      const m = action.notes.match(/dur[eé]t[eé]\s*(?:totale?)?\s*:?\s*([\d.]+)/i)
      if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) { durete = v; contributed = true } }
    }
    // Sel (ppm)
    if (salt === null && action.notes) {
      const m = action.notes.match(/sel\s*:?\s*([\d.]+)|salt\s*:?\s*([\d.]+)/i)
      if (m) {
        const v = parseFloat(m[1] ?? m[2])
        if (!isNaN(v)) { salt = v; contributed = true }
      }
    }
    // Stabilisant / acide cyanurique (CYA)
    if (stabilisant === null && action.notes) {
      const m = action.notes.match(/(?:stabilisant|acide cyanurique|cya)\s*:?\s*([\d.]+)/i)
      if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) { stabilisant = v; contributed = true } }
    }
    // Chlore combiné (CC) — deliberately does not contain "chlore" as a substring,
    // so it never interacts with the free-chlore regex above.
    if (cc === null && action.notes) {
      const m = action.notes.match(/combin[ée]?\s*:?\s*([\d.]+)/i)
      if (m) { const v = parseFloat(m[1]); if (!isNaN(v)) { cc = v; contributed = true } }
    }

    if (contributed && date === null) date = action.date

    if (
      ph !== null && chlore !== null && tac !== null && temp !== null &&
      brome !== null && durete !== null && salt !== null && stabilisant !== null && cc !== null
    ) break
  }

  return { ph, chlore, tac, temp, brome, durete, salt, stabilisant, cc, date }
}

function inRange(v: number, [min, max]: [number, number]): boolean {
  return v >= min && v <= max
}

/** pH: normal=7.0–7.6, warn=6.8–7.8, bad=outside */
export function getPhStatus(ph: number, ranges?: DynamicRanges): ParamStatus {
  const r = ranges?.ph ?? PARAM_RANGES.ph
  if (inRange(ph, r.ideal)) return 'normal'
  if (inRange(ph, r.acceptable)) return 'warn'
  return 'bad'
}

/** Chlore: normal=0.5–3.0, warn=0.3–4.0, bad=outside */
export function getChloreStatus(c: number, ranges?: DynamicRanges): ParamStatus {
  const r = ranges?.chlore ?? PARAM_RANGES.chlore
  if (inRange(c, r.ideal)) return 'normal'
  if (inRange(c, r.acceptable)) return 'warn'
  return 'bad'
}

/** TAC: normal=80–180, warn=60–200, bad=outside */
export function getTacStatus(tac: number, ranges?: DynamicRanges): ParamStatus {
  const r = ranges?.tac ?? PARAM_RANGES.tac
  if (inRange(tac, r.ideal)) return 'normal'
  if (inRange(tac, r.acceptable)) return 'warn'
  return 'bad'
}

/** Temp: normal=24–28, warn=15–35, bad=outside */
export function getTempStatus(temp: number, ranges?: DynamicRanges): ParamStatus {
  const r = ranges?.temp ?? PARAM_RANGES.temp
  if (inRange(temp, r.ideal)) return 'normal'
  if (inRange(temp, r.acceptable)) return 'warn'
  return 'bad'
}

/** Brome total: normal=2–5 mg/L, warn=1–10 mg/L, bad=outside */
export function getBromeStatus(v: number, ranges?: DynamicRanges): ParamStatus {
  const r = ranges?.brome ?? PARAM_RANGES.brome
  if (inRange(v, r.ideal)) return 'normal'
  if (inRange(v, r.acceptable)) return 'warn'
  return 'bad'
}

/** Dureté totale: normal=100–500 ppm, warn=50–1000 ppm, bad=outside */
export function getDureteStatus(v: number): ParamStatus {
  if (inRange(v, PARAM_RANGES.durete.ideal)) return 'normal'
  if (inRange(v, PARAM_RANGES.durete.acceptable)) return 'warn'
  return 'bad'
}

/** Sel: normal=2700–3400 ppm, warn=2500–4500 ppm, bad=outside */
export function getSelStatus(v: number, ranges?: DynamicRanges): ParamStatus {
  const r = ranges?.sel ?? PARAM_RANGES.sel
  if (inRange(v, r.ideal)) return 'normal'
  if (inRange(v, r.acceptable)) return 'warn'
  return 'bad'
}

/** Stabilisant (CYA): normal=60–80 ppm, warn=30–100 ppm, bad=outside */
export function getStabilisantStatus(v: number, ranges?: DynamicRanges): ParamStatus {
  const r = ranges?.stabilisant ?? PARAM_RANGES.stabilisant
  if (inRange(v, r.ideal)) return 'normal'
  if (inRange(v, r.acceptable)) return 'warn'
  return 'bad'
}

/** Chlore combiné (CC): normal=0–0.2 mg/L, warn=0–0.5 mg/L, bad=outside */
export function getCcStatus(v: number, ranges?: DynamicRanges): ParamStatus {
  const r = ranges?.cc ?? PARAM_RANGES.cc
  if (inRange(v, r.ideal)) return 'normal'
  if (inRange(v, r.acceptable)) return 'warn'
  return 'bad'
}

/** Returns last `limit` pH measurements, oldest first. */
export function getPhHistory(actions: Action[], limit = 10): PhPoint[] {
  const measurements = actions
    .filter(a => MEASURE_ACTION_TYPES.includes(a.action_type) && a.qty)
    .map(a => ({ date: a.date, ph: parseFloat(a.qty) }))
    .filter(p => !isNaN(p.ph))
    .sort((a, b) => a.date.localeCompare(b.date))
  return measurements.slice(-limit)
}

/** Returns actions from the previous calendar month. */
export function getActionsLastMonth(actions: Action[]): Action[] {
  const now = new Date()
  let year = now.getUTCFullYear()
  let month = now.getUTCMonth() // 0-indexed
  if (month === 0) { year -= 1; month = 12 } else { month -= 1 }
  const ym = `${year}-${String(month).padStart(2, '0')}`
  return actions.filter(a => a.date.startsWith(ym))
}

/** Days since a date string, calculated in UTC (same approach as daysSinceLastAction). */
export function getDaysSince(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number)
  const dateUtc = Date.UTC(year, month - 1, day)
  const now = new Date()
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((todayUtc - dateUtc) / (1000 * 60 * 60 * 24))
}

/**
 * Days until the next pH measurement (7-day cycle).
 * Negative = overdue. null = never measured.
 */
export function getNextMeasureInDays(actions: Action[]): number | null {
  const phActions = actions.filter(a => MEASURE_ACTION_TYPES.includes(a.action_type) && a.qty)
  if (phActions.length === 0) return null
  const sorted = [...phActions].sort((a, b) => b.date.localeCompare(a.date))
  const daysSince = getDaysSince(sorted[0].date)
  return 7 - daysSince
}

/**
 * Treatment counts for a given year-month string (YYYY-MM).
 * maintenance = Nettoyage cartouche / filtre skimmer / Calibrage pH
 * additions   = Ajout de produit
 */
export function getTreatmentsThisMonth(
  actions: Action[],
  yearMonth: string,
): { total: number; maintenance: number; additions: number } {
  const MAINTENANCE_TYPES = ['Nettoyage cartouche', 'Nettoyage filtre skimmer', 'Calibrage pH']
  const monthActions = actions.filter(a => a.date.startsWith(yearMonth))
  const maintenance = monthActions.filter(a => MAINTENANCE_TYPES.includes(a.action_type)).length
  const additions = monthActions.filter(a => a.action_type === 'Ajout de produit').length
  return { total: monthActions.length, maintenance, additions }
}

/**
 * Computes recommended to-do items based on action history and measured params.
 */
export function getTodoItems(actions: Action[], params: MeasuredParams): TodoItem[] {
  const items: TodoItem[] = []

  // pH measurement: warn after 5 days, cycle 7 days
  const nextPh = getNextMeasureInDays(actions)
  if (nextPh === null || nextPh <= 5) {
    const overdue = nextPh !== null && nextPh < 0
    items.push({
      id: 'ph-measure',
      icon: '⚗️',
      iconBg: overdue ? '#feecec' : '#fff4e0',
      title: 'Mesure du pH',
      subtitle: 'Recommandé tous les 7 jours',
      delay: nextPh === null
        ? 'Jamais mesuré'
        : overdue
          ? `En retard (${Math.abs(nextPh)} j)`
          : `Dans ${nextPh} j`,
      isOverdue: overdue || nextPh === null,
    })
  }

  // Filter maintenance: warn after 14 days
  const filterTypes = ['Nettoyage cartouche', 'Nettoyage filtre skimmer', 'Contre-lavage']
  const lastFilter = [...actions]
    .filter(a => filterTypes.includes(a.action_type))
    .sort((a, b) => b.date.localeCompare(a.date))[0]
  const filterDays = lastFilter ? getDaysSince(lastFilter.date) : null
  if (filterDays === null || filterDays > 14) {
    items.push({
      id: 'filter-maintenance',
      icon: '🔧',
      iconBg: '#feecec',
      title: 'Entretien du filtre',
      subtitle: 'Nettoyage cartouche ou contre-lavage',
      delay: filterDays === null ? 'Jamais fait' : `En retard (${filterDays} j)`,
      isOverdue: true,
    })
  }

  // Chlore check
  if (params.chlore !== null && params.chlore < 1) {
    items.push({
      id: 'chlore-low',
      icon: '⚠️',
      iconBg: '#fff4e0',
      title: 'Chlore faible',
      subtitle: `Chlore libre : ${params.chlore} mg/L (min. recommandé : 1 mg/L)`,
      delay: 'Vérifier',
      isOverdue: false,
    })
  }

  return items
}

// ── Mesures page helpers ───────────────────────────────────────────────────

export type ChlorePoint = { date: string; chlore: number }

/**
 * Filter measure-type actions by rolling period.
 * months=1 → from the 1st of the current month.
 * months=3/6 → from the 1st of (currentMonth - months + 1).
 * months=null → all.
 * Returns sorted newest-first.
 */
export function getFilteredMeasureActions(actions: Action[], months: number | null): Action[] {
  const filtered = actions.filter(a => MEASURE_ACTION_TYPES.includes(a.action_type))
  if (months === null) return filtered.sort((a, b) => b.date.localeCompare(a.date))
  const now = new Date()
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1))
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return filtered
    .filter(a => a.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * pH trend for a given year-month: first vs last value.
 * trend='up' means improving toward 7.2, 'down' worsening, 'stable' if diff < 0.1.
 */
export function getPhTrend(
  actions: Action[],
  yearMonth: string,
): { first: number; last: number; trend: 'up' | 'down' | 'stable' } | null {
  const pts = actions
    .filter(a => MEASURE_ACTION_TYPES.includes(a.action_type) && a.date.startsWith(yearMonth) && a.qty)
    .map(a => ({ date: a.date, ph: parseFloat(a.qty) }))
    .filter(p => !isNaN(p.ph))
    .sort((a, b) => a.date.localeCompare(b.date))
  if (pts.length < 2) return null
  const first = pts[0].ph
  const last = pts[pts.length - 1].ph
  if (Math.abs(last - first) < 0.1) return { first, last, trend: 'stable' }
  const IDEAL = 7.2
  const improving = Math.abs(last - IDEAL) < Math.abs(first - IDEAL)
  return { first, last, trend: improving ? 'up' : 'down' }
}

/**
 * Last `limit` chlore libre values from the given actions, oldest-first.
 * Caller should pre-filter by period before passing.
 */
export function getChloreHistory(actions: Action[], limit = 7): ChlorePoint[] {
  const result: ChlorePoint[] = []
  for (const a of [...actions].sort((x, y) => x.date.localeCompare(y.date))) {
    if (!MEASURE_ACTION_TYPES.includes(a.action_type)) continue
    const m = a.notes.match(/chlore?\s*(?:libre)?\s*:?\s*([\d.]+)/i)
    if (m) {
      const v = parseFloat(m[1])
      if (!isNaN(v)) result.push({ date: a.date, chlore: v })
    }
  }
  return result.slice(-limit)
}
