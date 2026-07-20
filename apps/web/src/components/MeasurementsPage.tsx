import { useState, useMemo } from 'react'
import { TrendingUp, TrendingDown, MoveRight } from 'lucide-react'
import type { Action } from '../types'
import {
  PARAM_RANGES,
  getWaterStatus,
  getPhStatus,
  getChlorineStatus,
  getTacStatus,
  getTempStatus,
  getFilteredMeasureActions,
  getParamHistory,
  getPhTrend,
  getDaysSince,
  extractMeasuredParams,
} from '../utils'
import { useT } from '../context/LocaleContext'
import { useInstallation } from '../context/InstallationContext'
import type { Locale } from '../i18n/translations'
import type { DynamicRanges } from '../utils'
import TrendChart from './TrendChart'

// ── Types ──────────────────────────────────────────────────────────────────

type Period = 1 | 3 | 6 | null
type ParamStatus = 'normal' | 'warn' | 'bad'

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatShort(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

function formatDateLong(dateStr: string, locale: Locale): string {
  const [y, m, d] = dateStr.split('-')
  const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function valueColor(status: ParamStatus): string {
  if (status === 'normal') return 'var(--status-ok-text)'
  if (status === 'warn') return 'var(--status-warn-text)'
  return 'var(--status-danger-text)'
}

function cellValue(
  value: number | null,
  statusFn: (v: number) => ParamStatus,
  fmt: (v: number) => string,
): React.ReactNode {
  if (value === null) return <span style={{ color: 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace', fontSize: 12 }}>—</span>
  const s = statusFn(value)
  return (
    <span style={{ color: valueColor(s), fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, fontWeight: 600 }}>
      {fmt(value)}
    </span>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ ph, chlorine, tac, ranges }: { ph: number | null; chlorine: number | null; tac: number | null; ranges?: DynamicRanges }) {
  const { t } = useT()
  const { status, hasData } = getWaterStatus({ ph, chlorine, tac }, ranges)
  if (!hasData) return <span style={{ color: 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10 }}>—</span>
  const cfg = {
    clear:  { label: t('status_normal'),     color: 'var(--status-ok-text)',     bg: 'var(--status-ok-bg)'     },
    cloudy: { label: t('status_watch'), color: 'var(--status-warn-text)',   bg: 'var(--status-warn-bg)'   },
    green:  { label: t('status_out_of_range'), color: 'var(--status-danger-text)', bg: 'var(--status-danger-bg)' },
  }[status]
  return (
    <span style={{
      fontFamily: '"IBM Plex Mono", monospace',
      fontSize: 10, fontWeight: 600,
      color: cfg.color, background: cfg.bg,
      padding: '2px 6px', borderRadius: 4, display: 'inline-block', whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

// ── KPI styles ─────────────────────────────────────────────────────────────

const kpiLabel: React.CSSProperties = {
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: 11,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
}

const kpiValue: React.CSSProperties = {
  fontFamily: '"IBM Plex Mono", monospace',
  fontSize: 22,
  fontWeight: 500,
  color: 'var(--text-primary)',
  margin: '6px 0 4px',
  lineHeight: 1.2,
}

const kpiSub: React.CSSProperties = {
  fontFamily: '"Sora", sans-serif',
  fontSize: 11,
  color: 'var(--text-muted)',
}

// ── Main component ─────────────────────────────────────────────────────────

type Props = { actions: Action[] }

export default function MeasurementsPage({ actions }: Props) {
  const { t, locale } = useT()
  const { active, ranges } = useInstallation()
  const [period, setPeriod] = useState<Period>(1)

  const PERIODS: { label: string; value: Period }[] = [
    { label: t('measurements_filter_month'),  value: 1 },
    { label: t('measurements_filter_3months'), value: 3 },
    { label: t('measurements_filter_6months'), value: 6 },
    { label: t('measurements_filter_all'),  value: null },
  ]

  const today = new Date()
  const yearMonth = today.toISOString().slice(0, 7)

  // KPI 1: measurements this month
  const measuresThisMonth = useMemo(() =>
    actions.filter(a => {
      const isMeasure = a.action_type === 'Measurement' || a.action_type === 'pH Measurement'
      return isMeasure && a.date.startsWith(yearMonth)
    }).length
  , [actions, yearMonth])

  // KPI 2: pH trend this month
  const phTrend = useMemo(() => getPhTrend(actions, yearMonth), [actions, yearMonth])

  // KPI 3: last reading
  const lastMeasure = useMemo(() => {
    const ms = actions
      .filter(a => a.action_type === 'Measurement' || a.action_type === 'pH Measurement')
      .sort((a, b) => b.date.localeCompare(a.date))
    return ms[0] ?? null
  }, [actions])

  // Filtered set (charts + table)
  const filtered = useMemo(() => getFilteredMeasureActions(actions, period), [actions, period])

  const phRange = ranges?.ph ?? PARAM_RANGES.ph
  const clRange = ranges?.chlorine ?? PARAM_RANGES.chlorine

  const phPoints = useMemo(() => getParamHistory(filtered, 'ph', 30), [filtered])
  const clPoints = useMemo(() => getParamHistory(filtered, 'chlorine', 30), [filtered])

  const phLast = phPoints.length > 0 ? phPoints[phPoints.length - 1] : null
  const clLast = clPoints.length > 0 ? clPoints[clPoints.length - 1] : null

  // Table rows: one per measure action with at least one param, newest first
  const tableRows = useMemo(() =>
    filtered
      .map(a => {
        const p = extractMeasuredParams([a])
        return { action: a, ph: p.ph, chlorine: p.chlorine, tac: p.tac, temp: p.temp }
      })
      .filter(r => r.ph !== null || r.chlorine !== null || r.tac !== null || r.temp !== null)
  , [filtered])

  // ── Trend sub-text ────────────────────────────────────────────────────────
  function trendNode() {
    if (!phTrend) return <span style={kpiSub}>{t('measurements_not_enough_data')}</span>
    const { trend } = phTrend
    const cfg = {
      up:     { Icon: TrendingUp, label: t('measurements_rising'), color: 'var(--status-ok-text)'     },
      down:   { Icon: TrendingDown, label: t('measurements_falling'), color: 'var(--status-danger-text)' },
      stable: { Icon: MoveRight, label: t('measurements_stable'), color: 'var(--text-muted)'         },
    }[trend]
    return (
      <span style={{ ...kpiSub, color: cfg.color, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <cfg.Icon size={13} strokeWidth={1.75} aria-hidden="true" /> {cfg.label}
      </span>
    )
  }

  function daysAgoLabel(n: number): string {
    if (n === 0) return t('kpi_today')
    if (n === 1) return t('measurements_ago_1')
    return [t('measurements_ago_n'), String(n), t('measurements_days_ago')].filter(Boolean).join(' ')
  }

  const numTh: React.CSSProperties = {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: 11, fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)',
    padding: '0 8px 8px 0',
    borderBottom: '1px solid var(--border-subtle)',
    whiteSpace: 'nowrap',
  }

  return (
    <div>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-header-title">{t('page_measurements_title')}</h1>
          <div className="page-header-sub">{t('page_measurements_sub')}</div>
        </div>
        <div className="page-header-actions">
          <div className="segmented">
            {PERIODS.map(p => (
              <button
                key={String(p.value)}
                className={p.value === period ? 'active' : ''}
                onClick={() => setPeriod(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Zone 1: KPIs ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>

        {/* KPI 1 */}
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={kpiLabel}>{t('measurements_this_month')}</div>
          <div style={kpiValue}>{measuresThisMonth}</div>
          <div style={kpiSub}>{t('measurements_records_saved')}</div>
        </div>

        {/* KPI 2 — pH trend */}
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={kpiLabel}>{t('measurements_ph_trend')}</div>
          {phTrend ? (
            <div style={{ ...kpiValue, fontSize: 16 }}>
              {phTrend.first.toFixed(1)} → {phTrend.last.toFixed(1)}
            </div>
          ) : (
            <div style={{ ...kpiValue, fontSize: 16, color: 'var(--text-muted)' }}>—</div>
          )}
          {trendNode()}
        </div>

        {/* KPI 3 — Last reading */}
        <div className="card" style={{ padding: '12px 16px' }}>
          <div style={kpiLabel}>{t('measurements_last_record')}</div>
          {lastMeasure ? (
            <>
              <div style={{ ...kpiValue, fontSize: 16 }}>{formatDateLong(lastMeasure.date, locale)}</div>
              <div style={kpiSub}>{daysAgoLabel(getDaysSince(lastMeasure.date))}</div>
            </>
          ) : (
            <>
              <div style={{ ...kpiValue, color: 'var(--text-muted)' }}>—</div>
              <div style={kpiSub}>{t('measurements_no_record')}</div>
            </>
          )}
        </div>
      </div>

      {/* ── Zone 2: Charts ───────────────────────────────────────────────── */}
      <div className="measurements-charts">

        {/* pH chart */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="section-title" style={{ margin: 0 }}>{t('graph_ph_trend')}</div>
            {phLast && (
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, fontWeight: 500, color: valueColor(getPhStatus(phLast.value, ranges ?? undefined)) }}>
                {phLast.value.toFixed(1)}
              </span>
            )}
          </div>
          <TrendChart
            points={phPoints}
            idealMin={phRange.ideal[0]}
            idealMax={phRange.ideal[1]}
            acceptableMin={phRange.acceptable[0]}
            acceptableMax={phRange.acceptable[1]}
            height={140}
            formatValue={v => v.toFixed(1)}
            emptyLabel={phPoints.length === 0 ? t('measurements_no_ph_period') : t('graph_not_enough_data')}
          />
        </div>

        {/* Chlorine chart */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="section-title" style={{ margin: 0 }}>{t('graph_chlorine_trend')}</div>
            {clLast && (
              <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, fontWeight: 500, color: valueColor(getChlorineStatus(clLast.value, ranges ?? undefined)) }}>
                {clLast.value.toFixed(1)} {active?.conc_unit ?? 'mg/L'}
              </span>
            )}
          </div>
          <TrendChart
            points={clPoints}
            idealMin={clRange.ideal[0]}
            idealMax={clRange.ideal[1]}
            acceptableMin={clRange.acceptable[0]}
            acceptableMax={clRange.acceptable[1]}
            unit={active?.conc_unit ?? 'mg/L'}
            height={140}
            formatValue={v => v.toFixed(1)}
            emptyLabel={clPoints.length === 0 ? t('measurements_no_chlorine_period') : t('graph_not_enough_data')}
          />
        </div>
      </div>

      {/* ── Zone 3: Table ────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 16, marginTop: 14 }}>
        {/* Table header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>{t('measurements_all_records')}</div>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: 'var(--text-muted)' }}>
            {tableRows.length} {t('measurements_records_saved')}
          </div>
        </div>

        {tableRows.length === 0 ? (
          <p style={{ fontFamily: '"Sora", sans-serif', fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            {t('measurements_no_records_period')}
          </p>
        ) : (
          <div style={{ overflowX: 'auto', maxHeight: 420, overflowY: 'auto' }}>
            <table className="measurements-table">
              <thead>
                <tr>
                  <th style={{ ...numTh, textAlign: 'left' }}>{t('table_date')}</th>
                  <th style={{ ...numTh, textAlign: 'right' }}>{t('param_ph')}</th>
                  <th style={{ ...numTh, textAlign: 'right' }}>{t('param_chlorine')}</th>
                  <th style={{ ...numTh, textAlign: 'right' }}>{t('param_tac')}</th>
                  <th style={{ ...numTh, textAlign: 'right' }}>{t('param_temp_label')}</th>
                  <th style={{ ...numTh, textAlign: 'left', paddingLeft: 12 }}>{t('measurements_status')}</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(({ action, ph, chlorine, tac, temp }) => (
                  <tr key={action.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '9px 8px 9px 0', fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatShort(action.date)}
                    </td>
                    <td style={{ padding: '9px 8px 9px 0', textAlign: 'right' }}>
                      {cellValue(ph, v => getPhStatus(v, ranges ?? undefined), v => v.toFixed(1))}
                    </td>
                    <td style={{ padding: '9px 8px 9px 0', textAlign: 'right' }}>
                      {cellValue(chlorine, v => getChlorineStatus(v, ranges ?? undefined), v => `${v.toFixed(1)} ${active?.conc_unit ?? 'mg/L'}`)}
                    </td>
                    <td style={{ padding: '9px 8px 9px 0', textAlign: 'right' }}>
                      {cellValue(tac, v => getTacStatus(v, ranges ?? undefined), v => `${Math.round(v)} ${active?.conc_unit ?? 'mg/L'}`)}
                    </td>
                    <td style={{ padding: '9px 8px 9px 0', textAlign: 'right' }}>
                      {cellValue(temp, v => getTempStatus(v, ranges ?? undefined), v => `${v.toFixed(1)} °${active?.temp_unit ?? 'C'}`)}
                    </td>
                    <td style={{ padding: '9px 8px 9px 12px' }}>
                      <StatusBadge ph={ph} chlorine={chlorine} tac={tac} ranges={ranges ?? undefined} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
