import type { MonthlyEnergyRow } from './solarCalc'

const MONTHS = 12

function daysInCalendarMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** ISO-dagen in kalendermaand, begrensd door [fileMin, fileMax]. */
function datesInCalendarMonth(
  year: number,
  month1: number,
  fileMin: string,
  fileMax: string,
): string[] {
  const maxD = daysInCalendarMonth(year, month1)
  const out: string[] = []
  for (let d = 1; d <= maxD; d++) {
    const s = iso(year, month1, d)
    if (s >= fileMin && s <= fileMax) {
      out.push(s)
    }
  }
  return out
}

/** Gemiddelde waarde per uur over dagen in de maand (verbruik kWh of TMY G(h), …). */
export function averageHourlyForCalendarMonth(
  dailyHourly: Record<string, number[]>,
  year: number,
  month1: number,
  fileMin: string,
  fileMax: string,
): number[] | null {
  const dates = datesInCalendarMonth(year, month1, fileMin, fileMax)
  const withData = dates.filter((d) => {
    const row = dailyHourly[d]
    return row && row.length >= 24
  })
  if (withData.length === 0) {
    return null
  }
  const sum = Array(24).fill(0) as number[]
  for (const d of withData) {
    const row = dailyHourly[d]!
    for (let h = 0; h < 24; h++) {
      sum[h] += row[h] ?? 0
    }
  }
  const n = withData.length
  return sum.map((s) => s / n)
}

/** Gemiddelde per uur over alle dagen in het bestand met deze kalendermaand (multi-jaar PVGIS-series). */
export function averageHourlyForMonthInFile(
  dailyHourly: Record<string, number[]>,
  month1: number,
  fileMin: string,
  fileMax: string,
): number[] | null {
  const mm = String(month1).padStart(2, '0')
  const withData = Object.keys(dailyHourly)
    .filter((d) => d >= fileMin && d <= fileMax && d.slice(5, 7) === mm)
    .filter((d) => {
      const row = dailyHourly[d]
      return row && row.length >= 24
    })
  if (withData.length === 0) {
    return null
  }
  const sum = Array(24).fill(0) as number[]
  for (const d of withData) {
    const row = dailyHourly[d]!
    for (let h = 0; h < 24; h++) {
      sum[h] += row[h] ?? 0
    }
  }
  const n = withData.length
  return sum.map((s) => s / n)
}

export function averageHourlyKwhForCalendarMonth(
  dailyHourly: Record<string, number[]>,
  year: number,
  month1: number,
  fileMin: string,
  fileMax: string,
): number[] | null {
  return averageHourlyForCalendarMonth(dailyHourly, year, month1, fileMin, fileMax)
}

/** Genormaliseerd uurprofiel (som = 1) uit een niet-negatieve uurreeks (TMY G(h), …). `year === null`: alle jaren in bestand voor die maand. */
export function hourlyWeightsFromHourlyPositiveSeries(
  dailyHourly: Record<string, number[]>,
  year: number | null,
  month1: number,
  fileMin: string,
  fileMax: string,
): number[] | null {
  const avg =
    year === null
      ? averageHourlyForMonthInFile(dailyHourly, month1, fileMin, fileMax)
      : averageHourlyForCalendarMonth(dailyHourly, year, month1, fileMin, fileMax)
  if (!avg) {
    return null
  }
  const s = avg.reduce((a, b) => a + b, 0)
  if (s <= 0) {
    return null
  }
  return avg.map((x) => x / s)
}

/** Representatieve dag van de maand (niet-schrikkeljaar) voor zonnestand. */
const MID_MONTH_DAY_OF_YEAR = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 350]

function declinationRad(dayOfYear: number): number {
  return ((23.44 * Math.PI) / 180) * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81))
}

/**
 * Relatief PV-vermogen per uur (som = 1) op basis van zonshoogte; referentie:middag kalendermaand.
 */
export function hourlySolarShareForMonth(latDeg: number, month0: number): number[] {
  const doy = MID_MONTH_DAY_OF_YEAR[month0] ?? 15
  const φ = (latDeg * Math.PI) / 180
  const δ = declinationRad(doy)
  const raw: number[] = []
  for (let h = 0; h < 24; h++) {
    const ω = ((15 * (h - 12)) * Math.PI) / 180
    const sinα = Math.sin(φ) * Math.sin(δ) + Math.cos(φ) * Math.cos(δ) * Math.cos(ω)
    raw[h] = sinα > 0 ? sinα ** 1.12 : 0
  }
  const s = raw.reduce((a, b) => a + b, 0)
  if (s <= 0) {
    return Array(24).fill(1 / 24)
  }
  return raw.map((x) => x / s)
}

function deg2rad(d: number): number {
  return (d * Math.PI) / 180
}

/**
 * Relatief verwacht PV-vermogen per uur op het dakvlak (PVGIS-azimut: 0° = zuid, 90° = west),
 * genormaliseerd (som = 1). Zonder geldige helling/azimut: zelfde als horizontaal model (`hourlySolarShareForMonth`).
 */
export function hourlyPanelShareFromPvgisGeometry(
  latDeg: number,
  month0: number,
  slopeDeg: number | undefined,
  azimuthPVGISDeg: number | undefined,
): number[] {
  if (
    slopeDeg === undefined ||
    azimuthPVGISDeg === undefined ||
    !Number.isFinite(slopeDeg) ||
    !Number.isFinite(azimuthPVGISDeg)
  ) {
    return hourlySolarShareForMonth(latDeg, month0)
  }
  const doy = MID_MONTH_DAY_OF_YEAR[month0] ?? 15
  const φ = deg2rad(latDeg)
  const β = deg2rad(slopeDeg)
  const γP = deg2rad(azimuthPVGISDeg)
  const δ = declinationRad(doy)
  const raw: number[] = []
  for (let h = 0; h < 24; h++) {
    const ω = deg2rad(15 * (h - 12))
    const sinAlpha =
      Math.sin(φ) * Math.sin(δ) + Math.cos(φ) * Math.cos(δ) * Math.cos(ω)
    const alpha = Math.asin(Math.min(1, Math.max(-1, sinAlpha)))
    const gammaSun = Math.atan2(
      -Math.sin(ω) * Math.cos(δ),
      Math.cos(φ) * Math.sin(δ) - Math.sin(φ) * Math.cos(δ) * Math.cos(ω),
    )
    const cosTheta =
      Math.sin(alpha) * Math.cos(β) + Math.cos(alpha) * Math.sin(β) * Math.cos(gammaSun - γP)
    raw[h] = cosTheta > 0 ? cosTheta : 0
  }
  const s = raw.reduce((a, b) => a + b, 0)
  if (s <= 0) {
    return hourlySolarShareForMonth(latDeg, month0)
  }
  return raw.map((x) => x / s)
}

/**
 * Zelfverbruek en injectie per maand via overlap tussen geschat uur-PV en gemeten uurverbruik
 * (Fluvius kwartierdata → uur).
 * Valt terug op null als er geen bruikbaar uurprofiel is.
 */
export function computeMonthlyEnergyRowsFromHourlyProfile(input: {
  monthlyProductionKwh: readonly number[]
  monthlyConsumptionKwh: readonly number[]
  dailyHourly: Record<string, number[]> | null
  year: number | null
  fileMin: string | null
  fileMax: string | null
  latDeg: number
  /** zelfde betekenis als computeMonthlyEnergyRows: zonder batterij ~0.7, met batterij ~0.9 */
  selfConsumptionRate: number
  /** Optioneel: PVGIS TMY G(h) W/m²; dan PV-uurvorm uit meteo i.p.v. zonnestandmodel */
  pvgisTmyGhiDailyHourly?: Record<string, number[]> | null
  pvgisTmyRange?: { min: string; max: string } | null
  pvgisTmyDataYear?: number | null
  /** Meerdere jaren in PVGIS-uurexport → gewichten over alle jaren per maand */
  pvgisTmyMultiYear?: boolean | null
}): MonthlyEnergyRow[] | null {
  const { monthlyProductionKwh, monthlyConsumptionKwh, dailyHourly, year, fileMin, fileMax } = input
  if (
    !dailyHourly ||
    year === null ||
    fileMin === null ||
    fileMax === null ||
    monthlyProductionKwh.length !== MONTHS ||
    monthlyConsumptionKwh.length !== MONTHS
  ) {
    return null
  }

  const rows: MonthlyEnergyRow[] = []

  for (let m = 0; m < MONTHS; m++) {
    const month1 = m + 1
    const N = daysInCalendarMonth(year, month1)
    if (N <= 0) {
      return null
    }

    const avgHour = averageHourlyKwhForCalendarMonth(dailyHourly, year, month1, fileMin, fileMax)
    if (!avgHour) {
      return null
    }

    const sumAvg = avgHour.reduce((a, b) => a + b, 0)
    if (sumAvg <= 0) {
      return null
    }

    const Pm = monthlyProductionKwh[m]!
    const Cm = monthlyConsumptionKwh[m]!
    const usePvgisTmyWeights =
      input.pvgisTmyGhiDailyHourly &&
      input.pvgisTmyRange &&
      (input.pvgisTmyMultiYear === true || input.pvgisTmyDataYear != null)

    let w = usePvgisTmyWeights
      ? hourlyWeightsFromHourlyPositiveSeries(
          input.pvgisTmyGhiDailyHourly!,
          input.pvgisTmyMultiYear === true ? null : input.pvgisTmyDataYear!,
          month1,
          input.pvgisTmyRange!.min,
          input.pvgisTmyRange!.max,
        )
      : null
    if (!w) {
      w = hourlySolarShareForMonth(input.latDeg, m)
    }

    const Pday = Pm / N
    const Cday = Cm / N

    const ph = w.map((wh) => Pday * wh)
    const ch = avgHour.map((ah) => (ah / sumAvg) * Cday)

    let overlapDay = 0
    for (let h = 0; h < 24; h++) {
      overlapDay += Math.min(ph[h]!, ch[h]!)
    }
    const overlapMonth = overlapDay * N

    const cap = Math.min(Pm, Cm)
    const selfConsumedKwh = Math.min(overlapMonth * input.selfConsumptionRate, cap)
    const exportKwh = Math.max(0, Pm - selfConsumedKwh)

    rows.push({ productionKwh: Pm, consumptionKwh: Cm, selfConsumedKwh, exportKwh })
  }

  return rows
}
