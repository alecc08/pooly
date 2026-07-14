import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useInstallation } from '../context/InstallationContext'
import { useT } from '../context/LocaleContext'

type Props = {
  open: boolean
  onClose: () => void
}

export default function InstallationModal({ open, onClose }: Props) {
  const { t } = useT()
  const { addInstallation } = useInstallation()
  const [name, setName] = useState('')
  const [type, setType] = useState<'piscine' | 'spa'>('piscine')
  const [sanitizer, setSanitizer] = useState<'brome' | 'chlore' | 'sel'>('chlore')
  const [volume, setVolume] = useState('')
  const [volumeUnit, setVolumeUnit] = useState<'L' | 'gal'>('L')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError(t('modal_install_nom_requis')); return }
    setLoading(true)
    setError(null)
    try {
      const parsedVolume = volume.trim() ? parseFloat(volume) : undefined
      await addInstallation({
        name: name.trim(),
        type,
        sanitizer,
        ...(parsedVolume !== undefined && !isNaN(parsedVolume) ? { volume: parsedVolume, volume_unit: volumeUnit } : {}),
      })
      setName('')
      setType('piscine')
      setSanitizer('chlore')
      setVolume('')
      setVolumeUnit('L')
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const cardBase: React.CSSProperties = {
    flex: 1, padding: '14px 12px', borderRadius: 10, border: '2px solid',
    cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    fontFamily: '"Sora", sans-serif', fontSize: 13, fontWeight: 600,
    transition: 'border-color 0.15s, background 0.15s',
  }

  const pillBase: React.CSSProperties = {
    flex: 1, padding: '8px 12px', borderRadius: 8, border: '2px solid',
    cursor: 'pointer', textAlign: 'center',
    fontFamily: '"Sora", sans-serif', fontSize: 12, fontWeight: 600,
    transition: 'border-color 0.15s, background 0.15s',
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: '"Sora", sans-serif', fontWeight: 600 }}>
            {t('modal_install_title')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18, paddingTop: 4 }}>
          {/* Nom */}
          <div style={{ display: 'grid', gap: 6 }}>
            <Label htmlFor="inst-name">{t('modal_install_nom')}</Label>
            <Input
              id="inst-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ma piscine, Spa du jardin…"
            />
          </div>

          {/* Type */}
          <div style={{ display: 'grid', gap: 8 }}>
            <Label>{t('modal_install_type')}</Label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([['piscine', '🏊', t('modal_install_piscine')], ['spa', '🛁', t('modal_install_spa')]] as const).map(([tp, icon, label]) => (
                <button
                  key={tp}
                  type="button"
                  onClick={() => setType(tp)}
                  style={{
                    ...cardBase,
                    borderColor: type === tp ? 'rgba(56,189,248,0.35)' : 'var(--border)',
                    background: type === tp ? 'rgba(56,189,248,0.1)' : 'var(--bg-surface-2)',
                    color: type === tp ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  {label.replace(/^.\s/, '')}
                </button>
              ))}
            </div>
          </div>

          {/* Désinfectant */}
          <div style={{ display: 'grid', gap: 8 }}>
            <Label>{t('modal_install_desinfectant')}</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['chlore', t('modal_install_chlore')], ['brome', t('modal_install_brome')], ['sel', t('modal_install_sel')]] as const).map(([s, label]) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSanitizer(s)}
                  style={{
                    ...pillBase,
                    borderColor: sanitizer === s ? 'rgba(56,189,248,0.35)' : 'var(--border)',
                    background: sanitizer === s ? 'rgba(56,189,248,0.1)' : 'var(--bg-surface-2)',
                    color: sanitizer === s ? '#38bdf8' : 'var(--text-secondary)',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Capacité */}
          <div style={{ display: 'grid', gap: 8 }}>
            <Label htmlFor="inst-volume">Capacité (optionnel)</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                id="inst-volume"
                type="number"
                min="0"
                step="any"
                value={volume}
                onChange={e => setVolume(e.target.value)}
                placeholder="45000"
                style={{ flex: 1 }}
              />
              {(['L', 'gal'] as const).map(u => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setVolumeUnit(u)}
                  style={{
                    ...pillBase,
                    flex: 'none',
                    minWidth: 56,
                    borderColor: volumeUnit === u ? 'rgba(56,189,248,0.35)' : 'var(--border)',
                    background: volumeUnit === u ? 'rgba(56,189,248,0.1)' : 'var(--bg-surface-2)',
                    color: volumeUnit === u ? '#38bdf8' : 'var(--text-secondary)',
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{ fontFamily: '"Sora", sans-serif', fontSize: 13, color: 'var(--status-danger-text)', margin: 0 }}>
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? t('modal_install_creation') : t('modal_install_creer')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
