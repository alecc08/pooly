import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Installation, InstallationWaterParams } from '../types'
import { installationParamsToRanges, type DynamicRanges } from '../utils'

type InstallationCtx = {
  installations: Installation[]
  active: Installation | null
  ranges: DynamicRanges | null
  setActive: (id: number) => void
  refresh: () => Promise<void>
  addInstallation: (data: { name: string; type: 'piscine' | 'spa'; sanitizer: 'brome' | 'chlore' | 'sel'; volume?: number; volume_unit?: 'L' | 'gal' }) => Promise<Installation>
}

const InstallationContext = createContext<InstallationCtx | null>(null)

export function useInstallation(): InstallationCtx {
  const ctx = useContext(InstallationContext)
  if (!ctx) throw new Error('useInstallation must be used within InstallationProvider')
  return ctx
}

export function InstallationProvider({ children }: { children: React.ReactNode }) {
  const [installations, setInstallations] = useState<Installation[]>([])
  const [activeId, setActiveId] = useState<number | null>(() => {
    const stored = localStorage.getItem('pooly_active_installation')
    return stored ? parseInt(stored) : null
  })
  const [ranges, setRanges] = useState<DynamicRanges | null>(null)

  const active = installations.find(i => i.id === activeId) ?? installations[0] ?? null

  const fetchParams = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/installations/${id}/params`, { credentials: 'same-origin' })
      if (!res.ok) return
      const data: InstallationWaterParams = await res.json()
      setRanges(installationParamsToRanges(data))
    } catch { /* silently ignore */ }
  }, [])

  const fetchInstallations = useCallback(async () => {
    try {
      const res = await fetch('/api/installations', { credentials: 'same-origin' })
      if (!res.ok) return
      const data: Installation[] = await res.json()
      setInstallations(data)
      if (data.length > 0) {
        const stored = localStorage.getItem('pooly_active_installation')
        const storedId = stored ? parseInt(stored) : null
        const validId = storedId && data.find(i => i.id === storedId) ? storedId : data[0].id
        setActiveId(validId)
      }
    } catch { /* silently ignore */ }
  }, [])

  useEffect(() => {
    fetchInstallations()
  }, [fetchInstallations])

  useEffect(() => {
    if (active) {
      localStorage.setItem('pooly_active_installation', String(active.id))
      fetchParams(active.id)
    }
  }, [active?.id, fetchParams])

  const setActive = useCallback((id: number) => {
    setActiveId(id)
    localStorage.setItem('pooly_active_installation', String(id))
  }, [])

  const refresh = useCallback(async () => {
    await fetchInstallations()
  }, [fetchInstallations])

  const addInstallation = useCallback(async (data: { name: string; type: 'piscine' | 'spa'; sanitizer: 'brome' | 'chlore' | 'sel'; volume?: number; volume_unit?: 'L' | 'gal' }): Promise<Installation> => {
    const res = await fetch('/api/installations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error('Erreur lors de la création')
    const inst: Installation = await res.json()
    setInstallations(prev => [...prev, inst])
    setActiveId(inst.id)
    return inst
  }, [])

  return (
    <InstallationContext.Provider value={{ installations, active, ranges, setActive, refresh, addInstallation }}>
      {children}
    </InstallationContext.Provider>
  )
}
