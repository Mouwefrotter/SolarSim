const MONTHS = 12

export function computeSystemKwp(roofAreaM2: number, panelEfficiencyPct: number): number {
  return (roofAreaM2 * panelEfficiencyPct) / 100
}

/** Even split of annual kWh into 12 months */
export function distributeAnnualConsumptionEvenly(annualKwh: number): number[] {
  const per = annualKwh / MONTHS
  return Array.from({ length: MONTHS }, () => per)
}

/** Monthly production [kWh] from PVGIS monthly kWh/kWp × installed kWp */
export function monthlyProductionKwh(
  monthlyEmKwhPerKwp: readonly number[],
  systemKwp: number,
): number[] {
  if (monthlyEmKwhPerKwp.length !== MONTHS) {
    throw new Error(`Expected ${MONTHS} monthly PVGIS values`)
  }
  return monthlyEmKwhPerKwp.map((em) => em * systemKwp)
}

export interface MonthlyEnergyRow {
  productionKwh: number
  consumptionKwh: number
  selfConsumedKwh: number
  exportKwh: number
}

export interface ComputeMonthlyParams {
  monthlyProductionKwh: readonly number[]
  monthlyConsumptionKwh: readonly number[]
  /** 0.7 without battery, 0.9 with battery */
  selfConsumptionRate: number
}

export function computeMonthlyEnergyRows(params: ComputeMonthlyParams): MonthlyEnergyRow[] {
  const { monthlyProductionKwh, monthlyConsumptionKwh, selfConsumptionRate } = params
  if (monthlyProductionKwh.length !== MONTHS || monthlyConsumptionKwh.length !== MONTHS) {
    throw new Error(`Expected ${MONTHS} monthly values`)
  }
  return monthlyProductionKwh.map((productionKwh, i) => {
    const consumptionKwh = monthlyConsumptionKwh[i]!
    const base = Math.min(productionKwh, consumptionKwh)
    const selfConsumedKwh = base * selfConsumptionRate
    const exportKwh = Math.max(0, productionKwh - selfConsumedKwh)
    return { productionKwh, consumptionKwh, selfConsumedKwh, exportKwh }
  })
}

export function sumAnnual(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0)
}

export function rowsToAnnualTotals(rows: readonly MonthlyEnergyRow[]) {
  const productionY = sumAnnual(rows.map((r) => r.productionKwh))
  const consumptionY = sumAnnual(rows.map((r) => r.consumptionKwh))
  const selfConsumedY = sumAnnual(rows.map((r) => r.selfConsumedKwh))
  const exportY = sumAnnual(rows.map((r) => r.exportKwh))
  return { productionY, consumptionY, selfConsumedY, exportY }
}

export interface WarningFlags {
  exportHeavyDigital: boolean
  oversizeRecommendedSqm: number | null
  tiltSuboptimalLow: boolean
  tiltSuboptimalHigh: boolean
}

export function evaluateWarnings(input: {
  roofTiltDeg: number
  /** Dakhelling uit PVGIS-bestand (override t.o.v. schuif) */
  roofTiltDegOverride?: number | null
  /** Geen hellings-waarschuwingen (bijv. handmatige PVGIS zonder helling in JSON) */
  skipTiltWarnings?: boolean
  digitalMeter: boolean
  annualProductionKwh: number
  annualConsumptionKwh: number
  annualExportKwh: number
  roofAreaM2: number
  panelEfficiencyPct: number
  /** kWh/kWp annual specific yield — for sizing recommendation */
  annualKwhPerKwp: number
}): WarningFlags {
  const { roofTiltDeg, digitalMeter, annualProductionKwh, annualConsumptionKwh, annualExportKwh } =
    input
  const exportRatio =
    annualProductionKwh > 0 ? annualExportKwh / annualProductionKwh : 0
  const exportHeavyDigital = digitalMeter && exportRatio > 0.45

  let oversizeRecommendedSqm: number | null = null
  if (
    annualConsumptionKwh > 0 &&
    input.annualKwhPerKwp > 0 &&
    annualProductionKwh > 2 * annualConsumptionKwh
  ) {
    const eff = input.panelEfficiencyPct / 100
    const targetProd = 2 * annualConsumptionKwh
    const targetKwp = targetProd / input.annualKwhPerKwp
    oversizeRecommendedSqm = targetKwp / eff
  }

  const tiltForBand =
    input.skipTiltWarnings === true
      ? null
      : input.roofTiltDegOverride !== undefined && input.roofTiltDegOverride !== null
        ? input.roofTiltDegOverride
        : roofTiltDeg

  return {
    exportHeavyDigital,
    oversizeRecommendedSqm,
    tiltSuboptimalLow: tiltForBand !== null && tiltForBand < 15,
    tiltSuboptimalHigh: tiltForBand !== null && tiltForBand > 55,
  }
}
