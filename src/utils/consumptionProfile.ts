import { distributeAnnualConsumptionEvenly } from './solarCalc'

function scaleProfileToAnnual(
  monthly: readonly number[],
  annualKwh: number,
): number[] {
  if (monthly.length !== 12) {
    return distributeAnnualConsumptionEvenly(annualKwh)
  }
  const sum = monthly.reduce((a, b) => a + b, 0)
  if (sum <= 0) {
    return distributeAnnualConsumptionEvenly(annualKwh)
  }
  const factor = annualKwh / sum
  return monthly.map((m) => m * factor)
}

/**
 * Priority: manual CSV → Fluvius → even split. Profiles are scaled to match `annualKwh` (slider).
 */
export function monthlyConsumptionKwh(
  annualKwh: number,
  fluviusMonthlyKwh: readonly number[] | null,
  csvMonthlyKwh?: readonly number[] | null,
): number[] {
  if (csvMonthlyKwh && csvMonthlyKwh.length === 12) {
    return scaleProfileToAnnual(csvMonthlyKwh, annualKwh)
  }
  if (!fluviusMonthlyKwh || fluviusMonthlyKwh.length !== 12) {
    return distributeAnnualConsumptionEvenly(annualKwh)
  }
  return scaleProfileToAnnual(fluviusMonthlyKwh, annualKwh)
}

export function estimatedEvenMonthly(annualKwh: number): number[] {
  return distributeAnnualConsumptionEvenly(annualKwh)
}
