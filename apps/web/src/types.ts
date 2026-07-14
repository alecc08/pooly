import type { TempUnit, SaltUnit, ConcUnit, DureteUnit } from './units'

export type Product = {
  id: number
  name: string
  type: string
  unit_default: string
}

export type User = {
  id: number
  email: string
  first_name: string
  created_at: string
}

export type Action = {
  id: number
  date: string
  action_type: string
  user_id: number | null
  installation_id?: number | null
  product_id: number | null
  qty: string
  unit: string
  notes: string
  created_at: string
}

export type Installation = {
  id: number
  user_id: number
  name: string
  type: 'piscine' | 'spa'
  sanitizer: 'brome' | 'chlore' | 'sel'
  volume?: number | null
  volume_unit?: 'L' | 'gal'
  temp_unit?: TempUnit
  salt_unit?: SaltUnit
  conc_unit?: ConcUnit
  durete_unit?: DureteUnit
  created_at: string
}

export type InstallationWaterParams = {
  ph: { ideal: [number, number]; acceptable: [number, number] }
  tac: { ideal: [number, number]; acceptable: [number, number] }
  temp: { ideal: [number, number]; acceptable: [number, number] }
  cl?: { ideal: [number, number]; acceptable: [number, number] }
  br?: { ideal: [number, number]; acceptable: [number, number] }
  salt?: { ideal: [number, number]; acceptable: [number, number] }
  cya?: { ideal: [number, number]; acceptable: [number, number] }
  cc?: { ideal: [number, number]; acceptable: [number, number] }
}
