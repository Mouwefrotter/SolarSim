import { describe, expect, it } from 'vitest'
import {
  annualSavingsEur,
  breakevenYear,
  cumulativeSavingsOverYears,
  fullFinancialSnapshot,
  netPresentValue,
  PROSUMENT_EUR_PER_KWP_YEAR,
  simplePaybackYears,
  totalSystemCostEur,
  yearlySavingsSeries,
} from './financialCalc'
import { computeMonthlyEnergyRows, rowsToAnnualTotals } from './solarCalc'

function sampleRowsDigital() {
  const prod = Array(12).fill(200) as number[]
  const cons = Array(12).fill(150) as number[]
  return computeMonthlyEnergyRows({
    monthlyProductionKwh: prod,
    monthlyConsumptionKwh: cons,
    selfConsumptionRate: 0.7,
  })
}

describe('totalSystemCostEur', () => {
  it('adds fixed installation cost', () => {
    const c = totalSystemCostEur({ systemKwp: 5, batteryEnabled: false, batteryKwh: 10 })
    expect(c).toBe(5 * 1200 + 500)
  })

  it('includes battery when enabled', () => {
    const c = totalSystemCostEur({ systemKwp: 5, batteryEnabled: true, batteryKwh: 10 })
    expect(c).toBe(5 * 1200 + 10 * 800 + 500)
  })
})

describe('annualSavingsEur', () => {
  it('values all production at purchase price for analogue', () => {
    const rows = sampleRowsDigital()
    const s = annualSavingsEur({
      rows,
      digitalMeter: false,
      purchasePriceEurPerKwh: 0.4,
      feedinTariffEurPerKwh: 0.04,
      systemKwp: 6,
    })
    const prodY = 12 * 200
    expect(s).toBeCloseTo(prodY * 0.4)
  })

  it('applies prosument charge for digital meter', () => {
    const rows = sampleRowsDigital()
    const s = annualSavingsEur({
      rows,
      digitalMeter: true,
      purchasePriceEurPerKwh: 0.4,
      feedinTariffEurPerKwh: 0.04,
      systemKwp: 6,
    })
    const { selfConsumedY, exportY } = rowsToAnnualTotals(rows)
    const expected =
      selfConsumedY * 0.4 + exportY * 0.04 - PROSUMENT_EUR_PER_KWP_YEAR * 6
    expect(s).toBeCloseTo(expected)
  })
})

describe('simplePaybackYears', () => {
  it('divides cost by annual savings', () => {
    expect(simplePaybackYears(10000, 1000)).toBe(10)
    expect(simplePaybackYears(10000, 0)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('yearlySavingsSeries + NPV', () => {
  it('produces 25 yearly cashflows and finite NPV', () => {
    const rows = sampleRowsDigital()
    const { selfConsumedY, exportY } = rowsToAnnualTotals(rows)
    const flows = yearlySavingsSeries({
      digitalMeter: true,
      year0SelfConsumedKwh: selfConsumedY,
      year0ExportKwh: exportY,
      purchasePriceEurPerKwh: 0.4,
      feedinTariffEurPerKwh: 0.04,
      systemKwp: 6,
      years: 25,
      discountRateAnnual: 0.03,
      panelDegradationAnnual: 0.005,
      electricityInflationAnnual: 0.02,
    })
    expect(flows).toHaveLength(25)
    const npv = netPresentValue(flows, 0.03)
    expect(npv).toBeGreaterThan(0)
  })
})

describe('breakevenYear', () => {
  it('finds first year cumulative meets cost', () => {
    const yearly = [100, 200, 300, 400]
    expect(breakevenYear(yearly, 350)).toBe(3)
  })
})

describe('cumulativeSavingsOverYears', () => {
  it('is monotonic increasing', () => {
    const c = cumulativeSavingsOverYears([100, 100, 100])
    expect(c).toEqual([100, 200, 300])
  })
})

describe('fullFinancialSnapshot', () => {
  it('returns consistent metrics', () => {
    const rows = sampleRowsDigital()
    const snap = fullFinancialSnapshot({
      roofAreaM2: 30,
      panelEfficiencyPct: 20,
      batteryEnabled: false,
      batteryKwh: 10,
      rows,
      digitalMeter: true,
      purchasePriceEurPerKwh: 0.4,
      feedinTariffEurPerKwh: 0.04,
    })
    expect(snap.systemKwp).toBeCloseTo(6)
    expect(snap.annualProductionKwh).toBeCloseTo(2400)
  })
})
