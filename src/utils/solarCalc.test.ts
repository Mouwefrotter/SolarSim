import { describe, expect, it } from 'vitest'
import {
  computeMonthlyEnergyRows,
  computeSystemKwp,
  distributeAnnualConsumptionEvenly,
  evaluateWarnings,
  monthlyProductionKwh,
  rowsToAnnualTotals,
} from './solarCalc'

describe('computeSystemKwp', () => {
  it('converts roof area and efficiency', () => {
    expect(computeSystemKwp(30, 20)).toBeCloseTo(6, 5)
  })
})

describe('distributeAnnualConsumptionEvenly', () => {
  it('splits annual kWh across 12 months', () => {
    const m = distributeAnnualConsumptionEvenly(1200)
    expect(m).toHaveLength(12)
    expect(m[0]).toBe(100)
    expect(m.reduce((a, b) => a + b, 0)).toBe(1200)
  })
})

describe('computeMonthlyEnergyRows', () => {
  it('computes self-consumption and export', () => {
    const prod = Array(12).fill(100) as number[]
    const cons = Array(12).fill(50) as number[]
    const rows = computeMonthlyEnergyRows({
      monthlyProductionKwh: prod,
      monthlyConsumptionKwh: cons,
      selfConsumptionRate: 0.7,
    })
    expect(rows[0]!.selfConsumedKwh).toBeCloseTo(35)
    expect(rows[0]!.exportKwh).toBeCloseTo(65)
    const t = rowsToAnnualTotals(rows)
    expect(t.selfConsumedY + t.exportY).toBeCloseTo(12 * 100)
  })
})

describe('evaluateWarnings', () => {
  it('flags heavy export with digital meter', () => {
    const w = evaluateWarnings({
      roofTiltDeg: 35,
      digitalMeter: true,
      annualProductionKwh: 1000,
      annualConsumptionKwh: 500,
      annualExportKwh: 500,
      roofAreaM2: 30,
      panelEfficiencyPct: 20,
      annualKwhPerKwp: 1000,
    })
    expect(w.exportHeavyDigital).toBe(true)
  })

  it('suggests smaller roof when oversized', () => {
    const w = evaluateWarnings({
      roofTiltDeg: 35,
      digitalMeter: true,
      annualProductionKwh: 5000,
      annualConsumptionKwh: 1000,
      annualExportKwh: 2000,
      roofAreaM2: 40,
      panelEfficiencyPct: 20,
      annualKwhPerKwp: 1000,
    })
    expect(w.oversizeRecommendedSqm).not.toBeNull()
  })

  it('skips tilt warnings when requested', () => {
    const w = evaluateWarnings({
      roofTiltDeg: 5,
      skipTiltWarnings: true,
      digitalMeter: false,
      annualProductionKwh: 1000,
      annualConsumptionKwh: 1000,
      annualExportKwh: 0,
      roofAreaM2: 30,
      panelEfficiencyPct: 20,
      annualKwhPerKwp: 1000,
    })
    expect(w.tiltSuboptimalLow).toBe(false)
    expect(w.tiltSuboptimalHigh).toBe(false)
  })

  it('uses tilt override when provided', () => {
    const w = evaluateWarnings({
      roofTiltDeg: 30,
      roofTiltDegOverride: 5,
      digitalMeter: false,
      annualProductionKwh: 1000,
      annualConsumptionKwh: 1000,
      annualExportKwh: 0,
      roofAreaM2: 30,
      panelEfficiencyPct: 20,
      annualKwhPerKwp: 1000,
    })
    expect(w.tiltSuboptimalLow).toBe(true)
  })
})

describe('monthlyProductionKwh', () => {
  it('scales specific yield by kWp', () => {
    const em = Array(12).fill(50) as number[]
    const p = monthlyProductionKwh(em, 6)
    expect(p[0]).toBe(300)
  })
})
