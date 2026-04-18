import type { ParsedPVGIS } from '../types/pvgis'
import { datesInCalendarMonth } from './seasonDagNacht'
import {
  averageHourlyForCalendarMonth,
  averageHourlyForMonthInFile,
  hourlyPanelShareFromPvgisGeometry,
  hourlyWeightsFromHourlyPositiveSeries,
} from './hourlySelfConsumption'

/** Typisch BE dag-/nachtregister: nacht 22:00–06:00 (8 u), dag 06:00–22:00 (16 u). */
const NIGHT_HOURS = new Set([22, 23, 0, 1, 2, 3, 4, 5])

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

/**
 * kWh per uur voor een gemiddelde dag in de maand: maandproductie verdeeld volgens PV-uurvorm (TMY of model).
 */
export function dayHourlyProductionKwh(
  productionMonthKwh: number,
  month1: number,
  calendarYear: number,
  latDeg: number,
  roofTiltDeg: number,
  parsed: ParsedPVGIS,
): number[] {
  const days = daysInMonth(calendarYear, month1)
  if (days <= 0 || productionMonthKwh <= 0) {
    return Array(24).fill(0)
  }
  const Pday = productionMonthKwh / days
  const month0 = month1 - 1

  const tmy = parsed.tmyGhiDailyHourly
  const tr = parsed.tmyRange
  const ty = parsed.tmyDataYear
  const multi = parsed.tmyMultiYear === true

  let w: number[] | null = null
  if (tmy && tr && (ty != null || multi)) {
    w = hourlyWeightsFromHourlyPositiveSeries(
      tmy,
      multi ? null : ty!,
      month1,
      tr.min,
      tr.max,
    )
  }
  if (!w) {
    const slope = parsed.inputsMeta?.slopeDeg ?? roofTiltDeg
    const az = parsed.inputsMeta?.azimuthDeg
    w = hourlyPanelShareFromPvgisGeometry(latDeg, month0, slope, az)
  }
  return w.map((wh) => Pday * wh)
}

/**
 * Fluvius-export zonder kwartierdetail: gemiddelde Afname Dag/Nacht per kalenderdag in de maand,
 * verdeeld over uren (nacht / 8, dag / 16) en geschaald naar het maandverbruik in het model.
 */
export function dayHourlyConsumptionFromDagNachtRegisters(
  consumptionMonthKwh: number,
  month1: number,
  calendarYear: number,
  dailyDag: Record<string, number>,
  dailyNacht: Record<string, number>,
  fileMin: string,
  fileMax: string,
  year: number,
): number[] {
  const days = daysInMonth(calendarYear, month1)
  if (days <= 0 || consumptionMonthKwh <= 0) {
    return Array(24).fill(0)
  }
  const cday = consumptionMonthKwh / days

  const dateKeys = datesInCalendarMonth(year, month1, fileMin, fileMax)
  const n = dateKeys.length
  if (n <= 0) {
    return Array(24).fill(cday / 24)
  }
  let sumD = 0
  let sumN = 0
  for (const d of dateKeys) {
    sumD += dailyDag[d] ?? 0
    sumN += dailyNacht[d] ?? 0
  }
  const avgDag = sumD / n
  const avgNacht = sumN / n
  const splitTotal = avgDag + avgNacht
  if (splitTotal <= 0) {
    return Array(24).fill(cday / 24)
  }
  const scale = cday / splitTotal
  const hourly: number[] = []
  for (let h = 0; h < 24; h++) {
    if (NIGHT_HOURS.has(h)) {
      hourly[h] = (avgNacht / 8) * scale
    } else {
      hourly[h] = (avgDag / 16) * scale
    }
  }
  return hourly
}

/**
 * kWh per uur voor een gemiddelde dag: Fluvius-uurprofiel (indien aanwezig) geschaald naar maandverbruik,
 * anders gelijk verdeeld over 24 uur.
 */
export function dayHourlyConsumptionKwh(
  consumptionMonthKwh: number,
  month1: number,
  calendarYear: number,
  dailyHourly: Record<string, number[]> | null,
  fileMin: string | null,
  fileMax: string | null,
  year: number | null,
  useMonthAcrossYearsInFile: boolean,
): number[] {
  const days = daysInMonth(calendarYear, month1)
  if (days <= 0 || consumptionMonthKwh <= 0) {
    return Array(24).fill(0)
  }
  const cday = consumptionMonthKwh / days

  if (dailyHourly && fileMin && fileMax && year != null) {
    const avg = useMonthAcrossYearsInFile
      ? averageHourlyForMonthInFile(dailyHourly, month1, fileMin, fileMax)
      : averageHourlyForCalendarMonth(dailyHourly, year, month1, fileMin, fileMax)
    if (avg) {
      const sum = avg.reduce((a, b) => a + b, 0)
      if (sum > 0) {
        return avg.map((x) => (x / sum) * cday)
      }
    }
  }

  return Array(24).fill(cday / 24)
}
