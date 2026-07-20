import { useEffect, useRef, useState } from 'react'

export type TrendPoint = { date: string; value: number }
export type TrendStatus = 'ok' | 'warn' | 'danger'

type Props = {
  points: TrendPoint[]
  idealMin?: number
  idealMax?: number
  acceptableMin?: number
  acceptableMax?: number
  unit?: string
  height?: number
  compact?: boolean
  formatValue?: (v: number) => string
  emptyLabel?: string
}

/** Status of a single value against the ideal / acceptable bands. */
export function pointStatus(
  value: number,
  idealMin?: number,
  idealMax?: number,
  acceptableMin?: number,
  acceptableMax?: number,
): TrendStatus {
  if (idealMin !== undefined && idealMax !== undefined && value >= idealMin && value <= idealMax) {
    return 'ok'
  }
  if (acceptableMin !== undefined && acceptableMax !== undefined) {
    return value >= acceptableMin && value <= acceptableMax ? 'warn' : 'danger'
  }
  if (idealMin === undefined || idealMax === undefined) return 'ok'
  return 'warn'
}

/**
 * Y domain: covers the data and the ideal band, padded by 8% so the line
 * never touches the frame. Degenerate (flat) domains get a ±1 spread.
 */
export function computeDomain(
  points: TrendPoint[],
  idealMin?: number,
  idealMax?: number,
): [number, number] {
  const values = points.map(p => p.value)
  if (idealMin !== undefined) values.push(idealMin)
  if (idealMax !== undefined) values.push(idealMax)
  if (values.length === 0) return [0, 1]
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) { min -= 1; max += 1 }
  const pad = (max - min) * 0.08
  return [min - pad, max + pad]
}

const STATUS_VAR: Record<TrendStatus, string> = {
  ok: 'var(--status-ok-text)',
  warn: 'var(--status-warn-text)',
  danger: 'var(--status-danger-text)',
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

export default function TrendChart({
  points,
  idealMin,
  idealMax,
  acceptableMin,
  acceptableMax,
  unit = '',
  height = 120,
  compact = false,
  formatValue = v => String(v),
  emptyLabel = '—',
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      setWidth(Math.round(entries[0].contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (points.length < 2) {
    return (
      <div
        ref={wrapRef}
        style={{
          height: compact ? 36 : height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: compact ? 'flex-start' : 'center',
          fontFamily: '"Sora", sans-serif',
          fontSize: compact ? 10 : 12,
          color: 'var(--text-muted)',
        }}
      >
        {compact ? '' : emptyLabel}
      </div>
    )
  }

  const H = compact ? 36 : height
  const padTop = compact ? 4 : 12
  const padBottom = compact ? 4 : 20
  const padLeft = compact ? 2 : 6
  const padRight = compact ? 2 : 6
  const plotW = Math.max(width - padLeft - padRight, 1)
  const plotH = Math.max(H - padTop - padBottom, 1)

  const [dMin, dMax] = computeDomain(points, idealMin, idealMax)
  const x = (i: number) => padLeft + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
  const y = (v: number) => padTop + plotH - ((v - dMin) / (dMax - dMin)) * plotH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${x(points.length - 1).toFixed(1)},${(padTop + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padTop + plotH).toFixed(1)} Z`

  const hasBand = idealMin !== undefined && idealMax !== undefined
  const bandTop = hasBand ? y(Math.min(idealMax!, dMax)) : 0
  const bandBottom = hasBand ? y(Math.max(idealMin!, dMin)) : 0

  const last = points[points.length - 1]
  const hovered = hover !== null ? points[hover] : null

  const gridYs = compact ? [] : [0.25, 0.5, 0.75].map(f => padTop + plotH * f)

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX
    if (clientX === undefined) return
    const px = clientX - rect.left - padLeft
    const idx = Math.round((px / plotW) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, idx)))
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width: '100%', height: H }}
      onMouseMove={compact ? undefined : handleMove}
      onMouseLeave={() => setHover(null)}
      onTouchStart={compact ? undefined : handleMove}
      onTouchMove={compact ? undefined : handleMove}
      onTouchEnd={() => setHover(null)}
    >
      {width > 0 && (
        <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
          {/* Ideal band */}
          {hasBand && bandBottom > bandTop && (
            <>
              <rect x={padLeft} y={bandTop} width={plotW} height={bandBottom - bandTop} fill="var(--status-ok-bg)" />
              <line x1={padLeft} x2={padLeft + plotW} y1={bandTop} y2={bandTop} stroke="var(--status-ok-text)" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 3" />
              <line x1={padLeft} x2={padLeft + plotW} y1={bandBottom} y2={bandBottom} stroke="var(--status-ok-text)" strokeOpacity={0.35} strokeWidth={1} strokeDasharray="3 3" />
            </>
          )}

          {/* Gridlines */}
          {gridYs.map((gy, i) => (
            <line key={i} x1={padLeft} x2={padLeft + plotW} y1={gy} y2={gy} stroke="var(--border-subtle)" strokeWidth={1} />
          ))}

          {/* Area + line */}
          <path d={areaPath} fill="var(--accent)" fillOpacity={0.08} />
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />

          {/* Dots (skipped in compact except the last point) */}
          {points.map((p, i) => {
            if (compact && i !== points.length - 1) return null
            const s = pointStatus(p.value, idealMin, idealMax, acceptableMin, acceptableMax)
            return (
              <circle
                key={i}
                cx={x(i)}
                cy={y(p.value)}
                r={hover === i ? 4 : 3}
                fill="var(--bg-surface)"
                stroke={STATUS_VAR[s]}
                strokeWidth={1.5}
              />
            )
          })}

          {/* Hover crosshair */}
          {hovered && hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={padTop} y2={padTop + plotH} stroke="var(--text-muted)" strokeOpacity={0.4} strokeWidth={1} />
          )}

          {/* X labels: first/last date */}
          {!compact && (
            <>
              <text x={padLeft} y={H - 4} fontFamily='"IBM Plex Mono", monospace' fontSize={9} fill="var(--text-muted)">
                {formatShortDate(points[0].date)}
              </text>
              <text x={padLeft + plotW} y={H - 4} textAnchor="end" fontFamily='"IBM Plex Mono", monospace' fontSize={9} fill="var(--text-muted)">
                {formatShortDate(last.date)}
              </text>
            </>
          )}

          {/* Last-value label */}
          {!compact && !hovered && (
            <text
              x={padLeft + plotW}
              y={Math.max(y(last.value) - 8, 10)}
              textAnchor="end"
              fontFamily='"IBM Plex Mono", monospace'
              fontSize={11}
              fontWeight={500}
              fill="var(--text-primary)"
            >
              {formatValue(last.value)}{unit ? ` ${unit}` : ''}
            </text>
          )}
        </svg>
      )}

      {/* Tooltip */}
      {hovered && hover !== null && !compact && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(Math.max(x(hover) - 40, 0), Math.max(width - 84, 0)),
            top: -6,
            transform: 'translateY(-100%)',
            background: 'var(--bg-raised)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-pop)',
            padding: '5px 8px',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
            {formatValue(hovered.value)}{unit ? ` ${unit}` : ''}
          </div>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: 'var(--text-muted)' }}>
            {formatShortDate(hovered.date)}
          </div>
        </div>
      )}
    </div>
  )
}
