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

/** Standaard gedrag zoals vroeger: laadrendement 95%, geen vloer-SOC, geen ontlaadverlies, geen vermogenslimiet. */
export const DEFAULT_BATTERY_SIM_LEGACY: BatterySimulationParams = {
  minSocFrac: 0,
  chargeEfficiency: 0.95,
  dischargeEfficiency: 1,
  maxPowerKw: Number.POSITIVE_INFINITY,
}

export interface BatterySimulationParams {
  /** Ondergrens SOC als fractie van nominale kWh (0–0.25) */
  minSocFrac: number
  chargeEfficiency: number
  dischargeEfficiency: number
  /** Max laad- en ontlaad-energie per uur (kWh) — typisch ≈ kW × 1 h */
  maxPowerKw: number
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x))
}

/**
 * Eén gemiddelde dag (24 u): PV ph[h] en verbruik ch[h] in kWh/uur.
 * SOC start op minimum (of 0); simuleert laden/ontladen binnen de dag.
 */
export function batteryDaySelfExportKwh(
  ph: readonly number[],
  ch: readonly number[],
  batteryKwh: number,
  params: Partial<BatterySimulationParams> = {},
): { daySelfKwh: number; dayExportKwh: number } {
  if (ph.length !== 24 || ch.length !== 24) {
    throw new Error('batteryDaySelfExportKwh: verwacht 24 uurwaarden')
  }
  const merged: BatterySimulationParams = {
    minSocFrac: params.minSocFrac ?? DEFAULT_BATTERY_SIM_LEGACY.minSocFrac,
    chargeEfficiency: params.chargeEfficiency ?? DEFAULT_BATTERY_SIM_LEGACY.chargeEfficiency,
    dischargeEfficiency:
      params.dischargeEfficiency ?? DEFAULT_BATTERY_SIM_LEGACY.dischargeEfficiency,
    maxPowerKw: params.maxPowerKw ?? DEFAULT_BATTERY_SIM_LEGACY.maxPowerKw,
  }

  const cap = Math.max(0, batteryKwh)
  const minSocKwh = cap * clamp01(merged.minSocFrac)
  const maxSocKwh = cap
  const ηc = merged.chargeEfficiency
  const ηd = merged.dischargeEfficiency
  const pMax = merged.maxPowerKw

  let soc = minSocKwh
  let daySelf = 0
  let dayExport = 0

  for (let h = 0; h < 24; h++) {
    const pv = Math.max(0, ph[h] ?? 0)
    const ld = Math.max(0, ch[h] ?? 0)
    const direct = Math.min(pv, ld)
    daySelf += direct
    let pvRem = pv - direct
    let loadRem = ld - direct

    if (loadRem > 0 && cap > 0) {
      const socAvail = Math.max(0, soc - minSocKwh)
      const maxDischargeToLoad = Math.min(
        loadRem,
        Number.isFinite(pMax) ? pMax : loadRem,
        socAvail * ηd,
      )
      const dis = maxDischargeToLoad
      daySelf += dis
      soc -= dis / ηd
      loadRem -= dis
    }

    if (pvRem > 0) {
      if (cap > 0) {
        const room = maxSocKwh - soc
        const pvCap = Math.min(pvRem, Number.isFinite(pMax) ? pMax : pvRem)
        const stored = Math.min(pvCap * ηc, room)
        soc += stored
        const pvElecToCharge = stored / ηc
        dayExport += pvRem - pvElecToCharge
      } else {
        dayExport += pvRem
      }
    }
  }

  return { daySelfKwh: daySelf, dayExportKwh: dayExport }
}

/**
 * Netafname per uur (kWh in dat uur ≈ kW gemiddeld) na PV-direct en batterijontlading.
 * Geen laden van de accu vanaf het net in dit model.
 */
export function batteryDayHourlyGridImportKwh(
  ph: readonly number[],
  ch: readonly number[],
  batteryKwh: number,
  params: Partial<BatterySimulationParams> = {},
): number[] {
  if (ph.length !== 24 || ch.length !== 24) {
    throw new Error('batteryDayHourlyGridImportKwh: verwacht 24 uurwaarden')
  }
  const merged: BatterySimulationParams = {
    minSocFrac: params.minSocFrac ?? DEFAULT_BATTERY_SIM_LEGACY.minSocFrac,
    chargeEfficiency: params.chargeEfficiency ?? DEFAULT_BATTERY_SIM_LEGACY.chargeEfficiency,
    dischargeEfficiency:
      params.dischargeEfficiency ?? DEFAULT_BATTERY_SIM_LEGACY.dischargeEfficiency,
    maxPowerKw: params.maxPowerKw ?? DEFAULT_BATTERY_SIM_LEGACY.maxPowerKw,
  }

  const cap = Math.max(0, batteryKwh)
  const minSocKwh = cap * clamp01(merged.minSocFrac)
  const maxSocKwh = cap
  const ηc = merged.chargeEfficiency
  const ηd = merged.dischargeEfficiency
  const pMax = merged.maxPowerKw

  let soc = minSocKwh
  const grid: number[] = Array(24).fill(0)

  for (let h = 0; h < 24; h++) {
    const pv = Math.max(0, ph[h] ?? 0)
    const ld = Math.max(0, ch[h] ?? 0)
    const direct = Math.min(pv, ld)
    let pvRem = pv - direct
    let loadRem = ld - direct

    if (loadRem > 0 && cap > 0) {
      const socAvail = Math.max(0, soc - minSocKwh)
      const maxDischargeToLoad = Math.min(
        loadRem,
        Number.isFinite(pMax) ? pMax : loadRem,
        socAvail * ηd,
      )
      const dis = maxDischargeToLoad
      soc -= dis / ηd
      loadRem -= dis
    }

    if (pvRem > 0) {
      if (cap > 0) {
        const room = maxSocKwh - soc
        const pvCap = Math.min(pvRem, Number.isFinite(pMax) ? pMax : pvRem)
        const stored = Math.min(pvCap * ηc, room)
        soc += stored
      }
    }

    grid[h] = Math.max(0, loadRem)
  }

  return grid
}

/** Netafname per uur zonder batterij: max(0, verbruik − PV). */
export function dayHourlyGridImportKwhNoBattery(
  ph: readonly number[],
  ch: readonly number[],
): number[] {
  if (ph.length !== 24 || ch.length !== 24) {
    throw new Error('dayHourlyGridImportKwhNoBattery: verwacht 24 uurwaarden')
  }
  return Array.from({ length: 24 }, (_, h) =>
    Math.max(0, (ch[h] ?? 0) - (ph[h] ?? 0)),
  )
}

/**
 * Per kalendermaand: piek netafname (kW) op basis van één gemiddelde dag (zoals maand-simulatie).
 * Vergelijkbaar met Fluvius maandpiek bij benadering.
 */
export function computeMonthlyPeakImportKwFromHourlyProfile(input: {
  monthlyProductionKwh: readonly number[]
  monthlyConsumptionKwh: readonly number[]
  dailyHourly: Record<string, number[]> | null
  year: number | null
  /** 12 elementen: kalenderjaar per maand; overschrijft enkelvoudig `year` wanneer gezet */
  yearByMonth?: number[] | null
  fileMin: string | null
  fileMax: string | null
  latDeg: number
  pvgisTmyGhiDailyHourly?: Record<string, number[]> | null
  pvgisTmyRange?: { min: string; max: string } | null
  pvgisTmyDataYear?: number | null
  pvgisTmyMultiYear?: boolean | null
  batteryEnabled?: boolean
  batteryKwh?: number
  batteryParams?: Partial<BatterySimulationParams>
}): number[] | null {
  const { monthlyProductionKwh, monthlyConsumptionKwh, dailyHourly, year, fileMin, fileMax } = input
  const ybm = input.yearByMonth
  const hasYbm = Boolean(ybm && ybm.length === 12)
  if (
    !dailyHourly ||
    (!hasYbm && year === null) ||
    fileMin === null ||
    fileMax === null ||
    monthlyProductionKwh.length !== MONTHS ||
    monthlyConsumptionKwh.length !== MONTHS
  ) {
    return null
  }

  const peaks: number[] = []

  for (let m = 0; m < MONTHS; m++) {
    const month1 = m + 1
    const yForMonth = hasYbm ? ybm![m]! : year!
    const N = daysInCalendarMonth(yForMonth, month1)
    if (N <= 0) {
      return null
    }

    const avgHour = averageHourlyKwhForCalendarMonth(
      dailyHourly,
      yForMonth,
      month1,
      fileMin,
      fileMax,
    )
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

    const tmyYearArg =
      input.pvgisTmyMultiYear === true
        ? null
        : hasYbm
          ? ybm![m]!
          : input.pvgisTmyDataYear!

    let w = usePvgisTmyWeights
      ? hourlyWeightsFromHourlyPositiveSeries(
          input.pvgisTmyGhiDailyHourly!,
          tmyYearArg,
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

    const useBatterySim =
      input.batteryEnabled === true &&
      typeof input.batteryKwh === 'number' &&
      input.batteryKwh > 0

    const hourly = useBatterySim
      ? batteryDayHourlyGridImportKwh(ph, ch, input.batteryKwh!, input.batteryParams)
      : dayHourlyGridImportKwhNoBattery(ph, ch)

    let maxH = 0
    for (let h = 0; h < 24; h++) {
      if (hourly[h]! > maxH) {
        maxH = hourly[h]!
      }
    }
    peaks.push(maxH)
  }

  return peaks
}

/**
 * Zelfverbruek en injectie per maand via overlap tussen geschat uur-PV en gemeten uurverbruik
 * (Fluvius kwartierdata → uur).
 * Valt terug op null als er geen bruikbaar uurprofiel is.
 * Met batterij + bruikbare capaciteit: uur-simulatie i.p.v. vaste factor 0.9.
 */
export function computeMonthlyEnergyRowsFromHourlyProfile(input: {
  monthlyProductionKwh: readonly number[]
  monthlyConsumptionKwh: readonly number[]
  dailyHourly: Record<string, number[]> | null
  year: number | null
  yearByMonth?: number[] | null
  fileMin: string | null
  fileMax: string | null
  latDeg: number
  /** Zonder uur-batterijmodel: ~0.7 zonder accu, ~0.9 met accu (alleen als geen kWh-simulatie) */
  selfConsumptionRate: number
  /** Optioneel: PVGIS TMY G(h) W/m²; dan PV-uurvorm uit meteo i.p.v. zonnestandmodel */
  pvgisTmyGhiDailyHourly?: Record<string, number[]> | null
  pvgisTmyRange?: { min: string; max: string } | null
  pvgisTmyDataYear?: number | null
  /** Meerdere jaren in PVGIS-uurexport → gewichten over alle jaren per maand */
  pvgisTmyMultiYear?: boolean | null
  /** Uur-simulatie van laden/ontladen (alleen als kwartierdata aanwezig) */
  batteryEnabled?: boolean
  batteryKwh?: number
  batteryParams?: Partial<BatterySimulationParams>
}): MonthlyEnergyRow[] | null {
  const { monthlyProductionKwh, monthlyConsumptionKwh, dailyHourly, year, fileMin, fileMax } = input
  const ybm = input.yearByMonth
  const hasYbm = Boolean(ybm && ybm.length === 12)
  if (
    !dailyHourly ||
    (!hasYbm && year === null) ||
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
    const yForMonth = hasYbm ? ybm![m]! : year!
    const N = daysInCalendarMonth(yForMonth, month1)
    if (N <= 0) {
      return null
    }

    const avgHour = averageHourlyKwhForCalendarMonth(
      dailyHourly,
      yForMonth,
      month1,
      fileMin,
      fileMax,
    )
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

    const tmyYearArg =
      input.pvgisTmyMultiYear === true
        ? null
        : hasYbm
          ? ybm![m]!
          : input.pvgisTmyDataYear!

    let w = usePvgisTmyWeights
      ? hourlyWeightsFromHourlyPositiveSeries(
          input.pvgisTmyGhiDailyHourly!,
          tmyYearArg,
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

    const cap = Math.min(Pm, Cm)

    const useBatterySim =
      input.batteryEnabled === true &&
      typeof input.batteryKwh === 'number' &&
      input.batteryKwh > 0

    let selfConsumedKwh: number
    let exportKwh: number

    if (useBatterySim) {
      const { daySelfKwh, dayExportKwh } = batteryDaySelfExportKwh(
        ph,
        ch,
        input.batteryKwh!,
        input.batteryParams,
      )
      selfConsumedKwh = Math.min(daySelfKwh * N, cap)
      exportKwh = Math.max(0, dayExportKwh * N)
    } else {
      let overlapDay = 0
      for (let h = 0; h < 24; h++) {
        overlapDay += Math.min(ph[h]!, ch[h]!)
      }
      const overlapMonth = overlapDay * N
      selfConsumedKwh = Math.min(overlapMonth * input.selfConsumptionRate, cap)
      exportKwh = Math.max(0, Pm - selfConsumedKwh)
    }

    rows.push({ productionKwh: Pm, consumptionKwh: Cm, selfConsumedKwh, exportKwh })
  }

  return rows
}
