import type { ParsedPVGIS, PvgisUploadedInputsMeta, PVGISResponse } from '../types/pvgis'
import { extractPvgisUploadedInputs } from './pvgisInputExtract'
import { listFullCalendarYearsInRange } from './csvConsumption'

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

/** PVGIS TMY/series: `20050101:1300` (uur), of `20050101:0010` (10 min; mm ≠ 0) */
export function parsePvgisTmyTimestamp(t: string): { iso: string; hour: number } | null {
  const f = parsePvgisTimeToIsoHourMinute(t)
  if (!f) {
    return null
  }
  return { iso: f.iso, hour: f.hour }
}

/** Tijd- en datumkolom uit PVGIS CSV (uuroverslaande of 10-minutenreeksen). */
export function parsePvgisTimeToIsoHourMinute(
  t: string,
): { iso: string; hour: number; minute: number } | null {
  const s = t.trim()
  const m = s.match(/^(\d{4})(\d{2})(\d{2}):(\d{2})(\d{2})$/)
  if (!m) {
    return null
  }
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const hh = Number(m[4])
  const minute = Number(m[5])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null
  }
  if (!Number.isFinite(hh) || hh < 0 || hh > 23) {
    return null
  }
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
    return null
  }
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { iso, hour: hh, minute }
}

/**
 * Verwijder HTML/comment (browser “Save as” op PVGIS) zodat dezelfde parser werkt
 * als bij een rechtstreekse CSV van de API of curl.
 */
export function normalizeMangledPvgisBrowserExport(text: string): string {
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const clean = lines[i]!
      .replace(/<!--[\s\S]*/, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .trim()
    if (headerLooksLikePvgisTimeGxy(clean)) {
      const rebuilt = [
        ...lines
          .slice(0, i)
          .map((l) => l.replace(/<[^>]+>/g, ' ').replace(/<!--[^]*?-->/g, ' ').trim())
          .filter((l) => l.length > 0),
        ...lines.slice(i).map((l) => l.replace(/<[^>]+>/g, '').trim()).filter((l) => l.length > 0),
      ]
      return rebuilt.join('\n')
    }
  }
  // Geen duidelijke kop: tags strippen (behoudt regels; kan genoeg zijn)
  return lines
    .map((l) => l.replace(/<[^>]+>/g, ' ').replace(/<!--[^]*?-->/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n')
}

function headerLooksLikePvgisTimeGxy(line: string): boolean {
  const low = line.toLowerCase()
  if (!low.includes('time') || !/[,;]/.test(line)) {
    return false
  }
  return /g\s*\(\s*h\s*\)/i.test(line) || /g\s*\(\s*i\s*\)/i.test(line)
}

type IrradianceField = 'G(h)' | 'G(i)'

function extractDailyHourlyFromPvgisRows(
  hourly: unknown[],
  fieldCandidates: readonly IrradianceField[],
): { dailyHourly: Record<string, number[]>; field: IrradianceField } | null {
  const sums: Record<string, { sum: number[]; n: number[] }> = {}
  function accFor(iso: string) {
    if (!sums[iso]) {
      sums[iso] = { sum: Array(24).fill(0), n: Array(24).fill(0) }
    }
    return sums[iso]!
  }

  let lockedField: IrradianceField | null = null

  for (const row of hourly) {
    if (!isRecord(row)) {
      continue
    }
    const t = row['time(UTC)'] ?? row['time']
    if (typeof t !== 'string') {
      continue
    }
    let v: number | undefined
    if (lockedField === null) {
      for (const f of fieldCandidates) {
        const x = row[f]
        if (typeof x === 'number' && !Number.isNaN(x)) {
          lockedField = f
          v = x
          break
        }
      }
    } else {
      const x = row[lockedField]
      if (typeof x !== 'number' || Number.isNaN(x)) {
        continue
      }
      v = x
    }
    if (lockedField === null || v === undefined) {
      continue
    }
    const p = parsePvgisTmyTimestamp(t)
    if (!p) {
      continue
    }
    const a = accFor(p.iso)
    a.sum[p.hour] += Math.max(0, v)
    a.n[p.hour] += 1
  }

  if (lockedField === null) {
    return null
  }

  const dailyHourly: Record<string, number[]> = {}
  for (const [iso, { sum, n }] of Object.entries(sums)) {
    const hrow = Array(24).fill(0) as number[]
    for (let h = 0; h < 24; h++) {
      hrow[h] = n[h]! > 0 ? sum[h]! / n[h]! : 0
    }
    dailyHourly[iso] = hrow
  }

  return { dailyHourly, field: lockedField }
}

export function extractTmyGhiFromPvgisJson(json: unknown): {
  dailyHourly: Record<string, number[]>
  range: { min: string; max: string }
  dataYear: number
  irradianceField: IrradianceField
  multiYear: boolean
} | null {
  if (!isRecord(json)) {
    return null
  }
  const out = json.outputs
  if (!isRecord(out)) {
    return null
  }

  const tmyHourly = out.tmy_hourly
  const fromTmy =
    Array.isArray(tmyHourly) && tmyHourly.length > 0
      ? extractDailyHourlyFromPvgisRows(tmyHourly, ['G(h)'])
      : null

  const seriesHourly = out.hourly
  const fromSeries =
    !fromTmy && Array.isArray(seriesHourly) && seriesHourly.length > 0
      ? extractDailyHourlyFromPvgisRows(seriesHourly, ['G(h)', 'G(i)'])
      : null

  const parsed = fromTmy ?? fromSeries
  if (!parsed) {
    return null
  }

  const { dailyHourly, field } = parsed
  const keys = Object.keys(dailyHourly).sort()
  if (keys.length === 0) {
    return null
  }
  const y0 = Number(keys[0]!.slice(0, 4))
  const y1 = Number(keys[keys.length - 1]!.slice(0, 4))
  const dataYear = Number.isFinite(y0) ? y0 : new Date().getFullYear()
  const multiYear = Number.isFinite(y0) && Number.isFinite(y1) && y0 !== y1

  return {
    dailyHourly,
    range: { min: keys[0]!, max: keys[keys.length - 1]! },
    dataYear,
    irradianceField: field,
    multiYear,
  }
}

/** Maand-som van G(h) in Wh/m² (W/m² × 1 h) → relatieve kWh/kWp-maanden die op jaar 1000 kWh/kWp totaliseren */
export function monthlyKwhPerKwpFromGhiDaily(
  daily: Record<string, number[]>,
  targetAnnualKwhPerKwp = 1000,
): { monthlyEmKwhPerKwp: number[]; annualKwhPerKwp: number } {
  const ghMonth = Array(12).fill(0)
  for (const [iso, row] of Object.entries(daily)) {
    const mo = Number(iso.slice(5, 7)) - 1
    if (mo < 0 || mo > 11) {
      continue
    }
    for (let h = 0; h < 24; h++) {
      const w = row[h] ?? 0
      ghMonth[mo] += Math.max(0, w)
    }
  }
  const total = ghMonth.reduce((a, b) => a + b, 0)
  if (total <= 0) {
    const flat = targetAnnualKwhPerKwp / 12
    return {
      monthlyEmKwhPerKwp: Array(12).fill(flat),
      annualKwhPerKwp: targetAnnualKwhPerKwp,
    }
  }
  const monthlyEmKwhPerKwp = ghMonth.map((g) => (g / total) * targetAnnualKwhPerKwp)
  const annualKwhPerKwp = monthlyEmKwhPerKwp.reduce((a, b) => a + b, 0)
  return { monthlyEmKwhPerKwp, annualKwhPerKwp }
}

function splitCsvLine(line: string): string[] {
  if ((line.match(/\t/g) ?? []).length >= 2) {
    return line.split('\t').map((x) => x.trim())
  }
  const sep = line.includes(';') ? ';' : ','
  return line.split(sep).map((x) => x.trim())
}

function tryParseMetaLatLon(text: string): Partial<PvgisUploadedInputsMeta> {
  const latm = text.match(/Latitude[^0-9-]*(-?\d+\.?\d*)/i)
  const lonm = text.match(/Longitude[^0-9-]*(-?\d+\.?\d*)/i)
  const meta: Partial<PvgisUploadedInputsMeta> = {}
  if (latm) {
    const la = Number(latm[1])
    if (Number.isFinite(la)) {
      meta.latitude = la
    }
  }
  if (lonm) {
    const lo = Number(lonm[1])
    if (Number.isFinite(lo)) {
      meta.longitude = lo
    }
  }
  return meta
}

type GxyField = 'G(h)' | 'G(i)'

interface DayIrradAgg {
  sum: number[]
  n: number[]
}

/**
 * PVGIS TMY- of **seriescalc**-export (`time, G(i), …` of G(h), …` — ook na browser “Save as” met HTML).
 * 10 minuten: meerdere stalen per uur → gemiddelde per uur. Multi-jaar → tmyMultiYear.
 */
export function parsePvgisTmyCsv(text: string): ParsedPVGIS {
  const work = normalizeMangledPvgisBrowserExport(text)
  const lines = work.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 3) {
    throw new Error('TMY-CSV: bestand te kort.')
  }

  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (headerLooksLikePvgisTimeGxy(lines[i]!)) {
      headerIdx = i
      break
    }
  }
  if (headerIdx < 0) {
    throw new Error('TMY-CSV: geen kopregel met time en G(h) of G(i) gevonden.')
  }

  const header = splitCsvLine(lines[headerIdx]!).map((c) => c.replace(/^["']|["']$/g, '').trim())
  const lower = header.map((h) => h.toLowerCase())
  const iTime = lower.findIndex((h) => h === 'time' || h.startsWith('time'))
  const iG = lower.findIndex(
    (h) =>
      h.replace(/\s/g, '') === 'g(h)' ||
      h.includes('g(h)') ||
      h.replace(/\s/g, '') === 'g(i)' ||
      h.includes('g(i)'),
  )
  if (iTime < 0 || iG < 0) {
    throw new Error('TMY-CSV: kolommen time en G(h) of G(i) niet gevonden.')
  }

  const gField: GxyField = lower[iG]!.includes('g(i)') ? 'G(i)' : 'G(h)'

  const aggr: Record<string, DayIrradAgg> = {}
  for (let r = headerIdx + 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]!)
    if (cells.length <= Math.max(iTime, iG)) {
      continue
    }
    const t = cells[iTime]!
    const gRaw = cells[iG]!
    const gVal = Number(String(gRaw).replace(',', '.'))
    if (!Number.isFinite(gVal)) {
      continue
    }
    const p = parsePvgisTimeToIsoHourMinute(t)
    if (!p) {
      continue
    }
    if (!aggr[p.iso]) {
      aggr[p.iso] = { sum: Array(24).fill(0), n: Array(24).fill(0) }
    }
    const a = aggr[p.iso]!
    a.sum[p.hour] += Math.max(0, gVal)
    a.n[p.hour] += 1
  }

  const daily: Record<string, number[]> = {}
  for (const [iso, a] of Object.entries(aggr)) {
    const hrow: number[] = Array(24).fill(0)
    for (let h2 = 0; h2 < 24; h2++) {
      hrow[h2] = a.n[h2]! > 0 ? a.sum[h2]! / a.n[h2]! : 0
    }
    daily[iso] = hrow
  }

  const dayKeys = Object.keys(daily).sort()
  if (dayKeys.length === 0) {
    throw new Error('TMY-CSV: geen geldige datapunten.')
  }

  const minDate = dayKeys[0]!
  const maxDate = dayKeys[dayKeys.length - 1]!
  const dMin = new Date(minDate + 'T12:00:00')
  const dMax = new Date(maxDate + 'T12:00:00')
  const fullCalendarYears = listFullCalendarYearsInRange(dMin, dMax)
  const ty0 = Number(minDate.slice(0, 4))
  const ty1 = Number(maxDate.slice(0, 4))
  const multiYear = Number.isFinite(ty0) && Number.isFinite(ty1) && ty0 !== ty1

  const { monthlyEmKwhPerKwp, annualKwhPerKwp } = monthlyKwhPerKwpFromGhiDaily(daily)
  const inputsPatch = tryParseMetaLatLon(work)
  const inputsMeta: PvgisUploadedInputsMeta | undefined =
    inputsPatch.latitude !== undefined || inputsPatch.longitude !== undefined
      ? {
          latitude: inputsPatch.latitude,
          longitude: inputsPatch.longitude,
        }
      : undefined

  return {
    monthlyEmKwhPerKwp,
    annualKwhPerKwp,
    inputsMeta,
    tmyGhiDailyHourly: daily,
    tmyRange: { min: minDate, max: maxDate },
    tmyDataYear: Number.isFinite(ty0) ? ty0 : null,
    tmyIrradianceField: gField,
    tmyMultiYear: multiYear,
    tmyFullCalendarYears: fullCalendarYears.length > 0 ? fullCalendarYears : undefined,
  }
}

export function hasPvCalcMonthlyOutputs(json: unknown): boolean {
  const j = json as PVGISResponse & {
    outputs?: { monthly?: { fixed?: unknown[] }; totals?: { fixed?: { E_m?: unknown } } }
  }
  const fixed = j?.outputs?.monthly?.fixed
  if (Array.isArray(fixed) && fixed.length >= 12) {
    return true
  }
  const em = j?.outputs?.totals?.fixed?.E_m
  return Array.isArray(em) && em.length >= 12
}

export function buildParsedFromTmyJsonOnly(json: unknown): ParsedPVGIS {
  const tmy = extractTmyGhiFromPvgisJson(json)
  if (!tmy) {
    throw new Error(
      'PVGIS-JSON: geen uurstraling (verwacht outputs.tmy_hourly met G(h), of outputs.hourly met G(h)/G(i)).',
    )
  }
  const { monthlyEmKwhPerKwp, annualKwhPerKwp } = monthlyKwhPerKwpFromGhiDaily(tmy.dailyHourly)
  const inputsMeta = extractPvgisUploadedInputs(json)
  return {
    monthlyEmKwhPerKwp,
    annualKwhPerKwp,
    inputsMeta,
    tmyGhiDailyHourly: tmy.dailyHourly,
    tmyRange: tmy.range,
    tmyDataYear: tmy.dataYear,
    tmyIrradianceField: tmy.irradianceField,
    tmyMultiYear: tmy.multiYear,
  }
}
