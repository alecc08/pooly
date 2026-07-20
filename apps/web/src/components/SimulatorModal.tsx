import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useInstallation } from '../context/InstallationContext'
import { useT } from '../context/LocaleContext'
import { PARAM_GUIDANCE } from '../paramGuidance'
import { displayToMetricConverter, gramsToDisplay, mlToDisplay } from '../units'
import type { DosageOption, ParamKey } from '../types'
import type { TranslationKey } from '../i18n/translations'

// Params dosage.py's TREATMENT_TABLE has actionable guidance for -- cc and temp are
// deliberately absent, same as the real Recommendations page.
const SIMULATOR_DOSAGE_PARAMS: ParamKey[] = ['ph', 'cl', 'br', 'tac', 'salt', 'cya', 'hardness']

const GAL_TO_L = 3.78541

type Props = {
  open: boolean
  onClose: () => void
}

type Tab = 'dosage' | 'heating'

type DosageResult = {
  param: ParamKey
  current_value: number
  target_value: number
  direction: 'raise' | 'lower'
  volume_known: boolean
  options: DosageOption[]
}

type HeatingResult = {
  kwh: number
  delta_temp_c: number
  efficiency: number
}

const sectionStyle: React.CSSProperties = {
  display: 'grid', gap: 8,
}

// salt/hardness are entered in canonical ppm here (unlike the installation's own unit
// settings) to keep the freestyle what-if math unambiguous -- TREATMENT_TABLE's dosing
// constants are calibrated to ppm.
function unitLabelFor(param: ParamKey, concUnit: string): string {
  switch (param) {
    case 'cl': case 'br': return concUnit
    case 'tac': case 'cya': return 'ppm'
    case 'salt': return 'ppm'
    case 'hardness': return 'ppm'
    case 'ph': default: return ''
  }
}

export default function SimulatorModal({ open, onClose }: Props) {
  const { t } = useT()
  const { active } = useInstallation()
  const [tab, setTab] = useState<Tab>('dosage')

  const handleClose = () => onClose()

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: '"Sora", sans-serif', fontWeight: 600 }}>
            {t('simulator_title')}
          </DialogTitle>
        </DialogHeader>

        <div style={{ fontFamily: '"Sora", sans-serif', fontSize: 12, color: 'var(--text-muted)', marginTop: -8, marginBottom: 4 }}>
          {t('simulator_subtitle')}
        </div>

        <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
          {(['dosage', 'heating'] as Tab[]).map(tb => (
            <button
              key={tb}
              type="button"
              onClick={() => setTab(tb)}
              style={{
                padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: '"Sora", sans-serif', fontSize: 13, fontWeight: 600,
                color: tab === tb ? '#2dd4bf' : 'var(--text-secondary)',
                borderBottom: tab === tb ? '2px solid #2dd4bf' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {tb === 'dosage' ? t('simulator_tab_dosage') : t('simulator_tab_heating')}
            </button>
          ))}
        </div>

        {tab === 'dosage' ? <DosageTab installationVolume={active?.volume ?? undefined} volumeUnit={active?.volume_unit ?? 'L'} sanitizer={active?.sanitizer ?? 'chlorine'} concUnit={active?.conc_unit ?? 'mg/L'} /> : <HeatingTab installationVolume={active?.volume ?? undefined} volumeUnit={active?.volume_unit ?? 'L'} tempUnit={active?.temp_unit ?? 'C'} />}
      </DialogContent>
    </Dialog>
  )
}

function DosageTab({
  installationVolume, volumeUnit, sanitizer, concUnit,
}: {
  installationVolume?: number
  volumeUnit: 'L' | 'gal'
  sanitizer: 'bromine' | 'chlorine' | 'salt'
  concUnit: string
}) {
  const { t } = useT()
  const [param, setParam] = useState<ParamKey>('ph')
  const [current, setCurrent] = useState('')
  const [target, setTarget] = useState('')
  const [volume, setVolume] = useState(installationVolume != null ? String(installationVolume) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DosageResult | null>(null)

  const unit = useMemo(() => unitLabelFor(param, concUnit), [param, concUnit])
  const guidance = PARAM_GUIDANCE[param]

  async function handleCalculate() {
    setError(null)
    setResult(null)
    const currentValue = parseFloat(current)
    const targetValue = parseFloat(target)
    const volumeValue = parseFloat(volume)
    if (isNaN(currentValue) || isNaN(targetValue) || isNaN(volumeValue)) {
      setError(t('simulator_dosage_error_generic'))
      return
    }
    const volumeL = volumeUnit === 'gal' ? volumeValue * GAL_TO_L : volumeValue

    setLoading(true)
    try {
      const res = await fetch('/api/simulate/dosage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          param, current_value: currentValue, target_value: targetValue,
          volume_L: volumeL, sanitizer,
        }),
      })
      if (!res.ok) {
        setError(currentValue === targetValue ? t('simulator_dosage_error_same_value') : t('simulator_dosage_error_generic'))
        return
      }
      setResult(await res.json())
    } catch {
      setError(t('simulator_dosage_error_generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={sectionStyle}>
        <Label>{t('simulator_dosage_param_label')}</Label>
        <Select value={param} onValueChange={v => { setParam(v as ParamKey); setResult(null) }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SIMULATOR_DOSAGE_PARAMS.map(p => (
              <SelectItem key={p} value={p}>{t(PARAM_GUIDANCE[p].labelKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ ...sectionStyle, flex: 1 }}>
          <Label htmlFor="sim-current">{t('simulator_dosage_current_label')}{unit ? ` (${unit})` : ''}</Label>
          <Input id="sim-current" type="number" step="any" value={current} onChange={e => setCurrent(e.target.value)} />
        </div>
        <div style={{ ...sectionStyle, flex: 1 }}>
          <Label htmlFor="sim-target">{t('simulator_dosage_target_label')}{unit ? ` (${unit})` : ''}</Label>
          <Input id="sim-target" type="number" step="any" value={target} onChange={e => setTarget(e.target.value)} />
        </div>
      </div>

      <div style={sectionStyle}>
        <Label htmlFor="sim-volume">{t('simulator_dosage_volume_label')} ({volumeUnit})</Label>
        <Input id="sim-volume" type="number" min="0" step="any" value={volume} onChange={e => setVolume(e.target.value)} />
      </div>

      {error && (
        <p style={{ fontFamily: '"Sora", sans-serif', fontSize: 13, color: 'var(--status-danger-text)', margin: 0 }}>
          {error}
        </p>
      )}

      <Button type="button" onClick={handleCalculate} disabled={loading} className="w-full">
        {t('simulator_dosage_calculate')}
      </Button>

      {result && (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
          background: 'var(--bg-surface-2)', display: 'grid', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: '"Sora", sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {guidance ? t(guidance.labelKey) : result.param}
            </div>
            <span style={{
              fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, fontWeight: 600,
              color: result.direction === 'raise' ? 'var(--status-warn-text)' : 'var(--status-danger-text)',
              padding: '2px 8px', borderRadius: 4,
            }}>
              {result.direction === 'raise' ? t('recommendations_raise') : t('recommendations_lower')}
            </span>
          </div>
          {result.options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {opt.product_id && (
                <div style={{ fontFamily: '"Sora", sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {t(`dosage_product_${opt.product_id}` as TranslationKey)}
                </div>
              )}
              {(opt.amount_grams !== null || opt.amount_ml !== null) && (
                <AmountLine grams={opt.amount_grams ?? undefined} mL={opt.amount_ml ?? undefined} volumeUnit={volumeUnit} />
              )}
              {opt.notes_key && (
                <div style={{ fontFamily: '"Sora", sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>
                  {t(opt.notes_key as TranslationKey)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AmountLine({ grams, mL, volumeUnit }: { grams?: number; mL?: number; volumeUnit: 'L' | 'gal' }) {
  const display = grams !== undefined ? gramsToDisplay(grams, volumeUnit) : mlToDisplay(mL as number, volumeUnit)
  return (
    <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
      {display.value} {display.unit === 'fl_oz' ? 'fl oz' : display.unit}
    </div>
  )
}

function HeatingTab({
  installationVolume, volumeUnit, tempUnit,
}: {
  installationVolume?: number
  volumeUnit: 'L' | 'gal'
  tempUnit: 'C' | 'F'
}) {
  const { t } = useT()
  const [currentTemp, setCurrentTemp] = useState('')
  const [targetTemp, setTargetTemp] = useState('')
  const [volume, setVolume] = useState(installationVolume != null ? String(installationVolume) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<HeatingResult | null>(null)

  async function handleCalculate() {
    setError(null)
    setResult(null)
    const currentValue = parseFloat(currentTemp)
    const targetValue = parseFloat(targetTemp)
    const volumeValue = parseFloat(volume)
    if (isNaN(currentValue) || isNaN(targetValue) || isNaN(volumeValue)) {
      setError(t('simulator_dosage_error_generic'))
      return
    }
    const volumeL = volumeUnit === 'gal' ? volumeValue * GAL_TO_L : volumeValue
    const toCelsius = displayToMetricConverter('temp', { temp_unit: tempUnit })
    const currentC = toCelsius ? toCelsius(currentValue) : currentValue
    const targetC = toCelsius ? toCelsius(targetValue) : targetValue

    setLoading(true)
    try {
      const res = await fetch('/api/simulate/heating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ volume_L: volumeL, current_temp_c: currentC, target_temp_c: targetC }),
      })
      if (!res.ok) { setError(t('simulator_dosage_error_generic')); return }
      setResult(await res.json())
    } catch {
      setError(t('simulator_dosage_error_generic'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ ...sectionStyle, flex: 1 }}>
          <Label htmlFor="sim-heat-current">{t('simulator_heating_current_temp_label')} (°{tempUnit})</Label>
          <Input id="sim-heat-current" type="number" step="any" value={currentTemp} onChange={e => setCurrentTemp(e.target.value)} />
        </div>
        <div style={{ ...sectionStyle, flex: 1 }}>
          <Label htmlFor="sim-heat-target">{t('simulator_heating_target_temp_label')} (°{tempUnit})</Label>
          <Input id="sim-heat-target" type="number" step="any" value={targetTemp} onChange={e => setTargetTemp(e.target.value)} />
        </div>
      </div>

      <div style={sectionStyle}>
        <Label htmlFor="sim-heat-volume">{t('simulator_heating_volume_label')} ({volumeUnit})</Label>
        <Input id="sim-heat-volume" type="number" min="0" step="any" value={volume} onChange={e => setVolume(e.target.value)} />
      </div>

      {error && (
        <p style={{ fontFamily: '"Sora", sans-serif', fontSize: 13, color: 'var(--status-danger-text)', margin: 0 }}>
          {error}
        </p>
      )}

      <Button type="button" onClick={handleCalculate} disabled={loading} className="w-full">
        {t('simulator_heating_calculate')}
      </Button>

      {result && (
        <div style={{
          border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px',
          background: 'var(--bg-surface-2)', display: 'grid', gap: 4,
        }}>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            {t('simulator_heating_result_label')}
          </div>
          <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            {result.kwh} kWh
          </div>
          <div style={{ fontFamily: '"Sora", sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>
            {t('simulator_heating_efficiency_note').replace('{pct}', String(Math.round(result.efficiency * 100)))}
          </div>
        </div>
      )}
    </div>
  )
}
