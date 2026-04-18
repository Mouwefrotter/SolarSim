import { describe, expect, it } from 'vitest'
import {
  dayHourlyConsumptionFromDagNachtRegisters,
  dayHourlyConsumptionKwh,
  dayHourlyProductionKwh,
} from './dayHourlyProfile'
import type { ParsedPVGIS } from '../types/pvgis'

describe('dayHourlyProductionKwh', () => {
  it('splits monthly kWh across hours (weights sum to 1)', () => {
    const parsed: ParsedPVGIS = {
      monthlyEmKwhPerKwp: Array(12).fill(100),
      annualKwhPerKwp: 1200,
    }
    const monthKwh = 300
    const year = 2024
    const days = new Date(year, 6, 0).getDate()
    const hourly = dayHourlyProductionKwh(monthKwh, 6, year, 51, 35, parsed)
    expect(hourly.length).toBe(24)
    const sumDay = hourly.reduce((a, b) => a + b, 0)
    expect(sumDay).toBeCloseTo(monthKwh / days, 5)
  })
})

describe('dayHourlyConsumptionKwh', () => {
  it('uses flat split without hourly import', () => {
    const year = 2024
    const days = 30
    const monthKwh = 300
    const h = dayHourlyConsumptionKwh(monthKwh, 6, year, null, null, null, null, false)
    const cday = monthKwh / days
    expect(h.every((x) => Math.abs(x - cday / 24) < 1e-9)).toBe(true)
  })
})

describe('dayHourlyConsumptionFromDagNachtRegisters', () => {
  it('puts nacht on night hours and dag on day hours', () => {
    const Y = 2024
    const dag: Record<string, number> = {}
    const nacht: Record<string, number> = {}
    for (let d = 1; d <= 30; d++) {
      const key = `${Y}-06-${String(d).padStart(2, '0')}`
      dag[key] = 16
      nacht[key] = 8
    }
    const monthKwh = 300
    const h = dayHourlyConsumptionFromDagNachtRegisters(
      monthKwh,
      6,
      Y,
      dag,
      nacht,
      `${Y}-01-01`,
      `${Y}-12-31`,
      Y,
    )
    const cday = monthKwh / 30
    const sumDay = h.reduce((a, b) => a + b, 0)
    expect(sumDay).toBeCloseTo(cday, 5)
    const nightSum = [22, 23, 0, 1, 2, 3, 4, 5].reduce((a, hr) => a + h[hr]!, 0)
    const daySum = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].reduce(
      (a, hr) => a + h[hr]!,
      0,
    )
    expect(nightSum + daySum).toBeCloseTo(cday, 5)
    expect(nightSum).toBeCloseTo((cday * 8) / 24, 5)
  })
})
