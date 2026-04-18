import { computeSystemKwp, type MonthlyEnergyRow, rowsToAnnualTotals } from './solarCalc'

export const PANEL_COST_EUR_PER_KWP = 1200
export const BATTERY_COST_EUR_PER_KWH = 800
export const INSTALL_FIXED_COST_EUR = 500
export const PROSUMENT_EUR_PER_KWP_YEAR = 95

export function totalSystemCostEur(input: {
  systemKwp: number
  batteryEnabled: boolean
  batteryKwh: number
}): number {
  const { systemKwp, batteryEnabled, batteryKwh } = input
  const panelsInverter = systemKwp * PANEL_COST_EUR_PER_KWP
  const battery = batteryEnabled ? batteryKwh * BATTERY_COST_EUR_PER_KWH : 0
  return panelsInverter + battery + INSTALL_FIXED_COST_EUR
}

export function annualSavingsEur(input: {
  rows: readonly MonthlyEnergyRow[]
  digitalMeter: boolean
  purchasePriceEurPerKwh: number
  feedinTariffEurPerKwh: number
  systemKwp: number
}): number {
  const { rows, digitalMeter, purchasePriceEurPerKwh, feedinTariffEurPerKwh, systemKwp } = input
  const { selfConsumedY, exportY, productionY } = rowsToAnnualTotals(rows)

  if (digitalMeter) {
    const energyPart =
      selfConsumedY * purchasePriceEurPerKwh + exportY * feedinTariffEurPerKwh
    return energyPart - PROSUMENT_EUR_PER_KWP_YEAR * systemKwp
  }
  /** Analogue net metering: all produced kWh valued at purchase price */
  return productionY * purchasePriceEurPerKwh
}

export function simplePaybackYears(totalCostEur: number, annualSavingsEur: number): number {
  if (annualSavingsEur <= 0) {
    return Number.POSITIVE_INFINITY
  }
  return totalCostEur / annualSavingsEur
}

export interface NpvInput {
  digitalMeter: boolean
  year0SelfConsumedKwh: number
  year0ExportKwh: number
  purchasePriceEurPerKwh: number
  feedinTariffEurPerKwh: number
  systemKwp: number
  /** Years to project */
  years: number
  discountRateAnnual: number
  panelDegradationAnnual: number
  electricityInflationAnnual: number
}

/**
 * End-of-year cashflows for years 1..years. Prosument charge is constant (not inflated).
 */
export function yearlySavingsSeries(input: NpvInput): number[] {
  const {
    years,
    panelDegradationAnnual,
    electricityInflationAnnual,
    digitalMeter,
    year0SelfConsumedKwh,
    year0ExportKwh,
    purchasePriceEurPerKwh,
    feedinTariffEurPerKwh,
    systemKwp,
  } = input

  const deg = 1 - panelDegradationAnnual
  const inf = 1 + electricityInflationAnnual
  const prod0 = year0SelfConsumedKwh + year0ExportKwh

  const series: number[] = []
  for (let y = 1; y <= years; y++) {
    const age = y - 1
    const prodFactor = deg ** age
    const priceFactor = inf ** age
    let savings: number
    if (digitalMeter) {
      savings =
        year0SelfConsumedKwh * prodFactor * purchasePriceEurPerKwh * priceFactor +
        year0ExportKwh * prodFactor * feedinTariffEurPerKwh * priceFactor -
        PROSUMENT_EUR_PER_KWP_YEAR * systemKwp
    } else {
      savings = prod0 * prodFactor * purchasePriceEurPerKwh * priceFactor
    }
    series.push(savings)
  }
  return series
}

export function netPresentValue(
  yearlyCashflowsEur: readonly number[],
  discountRateAnnual: number,
): number {
  let npv = 0
  for (let i = 0; i < yearlyCashflowsEur.length; i++) {
    const year = i + 1
    npv += yearlyCashflowsEur[i]! / (1 + discountRateAnnual) ** year
  }
  return npv
}

export function cumulativeSavingsOverYears(yearlySavingsEur: readonly number[]): number[] {
  const out: number[] = []
  let acc = 0
  for (const s of yearlySavingsEur) {
    acc += s
    out.push(acc)
  }
  return out
}

/** First year index (1-based) where cumulative savings meet or exceed system cost */
export function breakevenYear(
  yearlySavingsEur: readonly number[],
  totalSystemCostEur: number,
): number | null {
  let acc = 0
  for (let i = 0; i < yearlySavingsEur.length; i++) {
    acc += yearlySavingsEur[i]!
    if (acc >= totalSystemCostEur) {
      return i + 1
    }
  }
  return null
}

export function npv25YearDefault(year0AnnualSavings: NpvInput): number {
  const flows = yearlySavingsSeries(year0AnnualSavings)
  return netPresentValue(flows, year0AnnualSavings.discountRateAnnual)
}

/** Convenience for tests & PDF */
export function fullFinancialSnapshot(input: {
  roofAreaM2: number
  panelEfficiencyPct: number
  batteryEnabled: boolean
  batteryKwh: number
  rows: readonly MonthlyEnergyRow[]
  digitalMeter: boolean
  purchasePriceEurPerKwh: number
  feedinTariffEurPerKwh: number
}) {
  const systemKwp = computeSystemKwp(input.roofAreaM2, input.panelEfficiencyPct)
  const cost = totalSystemCostEur({
    systemKwp,
    batteryEnabled: input.batteryEnabled,
    batteryKwh: input.batteryKwh,
  })
  const annual = annualSavingsEur({
    rows: input.rows,
    digitalMeter: input.digitalMeter,
    purchasePriceEurPerKwh: input.purchasePriceEurPerKwh,
    feedinTariffEurPerKwh: input.feedinTariffEurPerKwh,
    systemKwp,
  })
  const { selfConsumedY, exportY, productionY } = rowsToAnnualTotals(input.rows)
  const npv = npv25YearDefault({
    digitalMeter: input.digitalMeter,
    year0SelfConsumedKwh: selfConsumedY,
    year0ExportKwh: exportY,
    purchasePriceEurPerKwh: input.purchasePriceEurPerKwh,
    feedinTariffEurPerKwh: input.feedinTariffEurPerKwh,
    systemKwp,
    years: 25,
    discountRateAnnual: 0.03,
    panelDegradationAnnual: 0.005,
    electricityInflationAnnual: 0.02,
  })

  return {
    systemKwp,
    totalSystemCostEur: cost,
    annualSavingsEur: annual,
    annualProductionKwh: productionY,
    simplePaybackYears: simplePaybackYears(cost, annual),
    npv25Eur: npv,
  }
}
