/**
 * Fluvius-export: kolommen Van (datum)/Register/Volume — werkt voor «dagtotalen» (1 rij per register per dag)
 * en «kwartiertotalen» (15‑minutenintervallen); beide worden naar kalenderdagsommen geaggregeerd.
 */

export type ConsumptionCsvResult =
  | { format: 'simple12'; monthly: number[] }
  | {
      format: 'quarterly'
      /** Q1–Q4 kWh (calendar quarters: jan–mar, apr–jun, jul–sep, okt–dec) */
      quarters: [number, number, number, number]
      monthly: number[]
    }
  | {
      format: 'fluvius-daily'
      daily: Record<string, number>
      dailyDag: Record<string, number>
      dailyNacht: Record<string, number>
      /** «dag» = export met weinig rijen per dag; «kwartier» = voldoende intervalregels voor uurprofiel */
      fluviusGranularity: 'dag' | 'kwartier'
      /** Per kalenderdag 24 uren (som afname in dat uur); alleen bij kwartier-export */
      dailyHourly: Record<string, number[]> | null
      minDate: string
      maxDate: string
      fullCalendarYears: number[]
      suggestedYear: number
      monthlyForSuggestedYear: number[]
    }

/** Uur 0–23 uit Fluvius «Van (tijdstip)» (bv. 00:15:00). */
export function parseVanTimeHour(raw: string): number | null {
  const s = raw.trim()
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) {
    return null
  }
  const hh = Number(m[1])
  if (!Number.isFinite(hh) || hh < 0 || hh > 23) {
    return null
  }
  return hh
}

const KWARTIER_DETAIL_MIN_ROWS_PER_DAY = 12

export function parseCellNumber(raw: string): number | null {
  const s = raw.replace(/^["']|["']$/g, '').trim()
  if (!s || /^[a-zA-Z_]/.test(s)) {
    return null
  }
  const compact = s.replace(/\s/g, '')
  let t = compact
  if (t.includes(',') && t.includes('.')) {
    t =
      t.lastIndexOf(',') > t.lastIndexOf('.')
        ? t.replace(/\./g, '').replace(',', '.')
        : t.replace(/,/g, '')
  } else if (t.includes(',') && !t.includes('.')) {
    t = t.replace(',', '.')
  }
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) {
    return null
  }
  return n
}

function splitCsvLine(line: string): string[] {
  const sep = line.includes(';') ? ';' : ','
  return line.split(sep).map((x) => x.trim())
}

export function parseNlDateDdMmYyyy(s: string): Date | null {
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (!m) {
    return null
  }
  const d = Number(m[1])
  const mo = Number(m[2])
  const y = Number(m[3])
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null
  }
  return dt
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const mo = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** List years Y where data covers all days from 1 Jan Y through 31 Dec Y. */
export function listFullCalendarYearsInRange(dMin: Date, dMax: Date): number[] {
  const lo = startOfDay(dMin)
  const hi = startOfDay(dMax)
  const years: number[] = []
  for (let y = lo.getFullYear(); y <= hi.getFullYear(); y++) {
    const yStart = new Date(y, 0, 1)
    const yEnd = new Date(y, 11, 31)
    if (lo.getTime() <= yStart.getTime() && hi.getTime() >= yEnd.getTime()) {
      years.push(y)
    }
  }
  return years
}

/** Kalenderjaren waarin minstens één dag voorkomt in `daily` (nieuwste eerst). */
export function distinctYearsFromDaily(daily: Record<string, number>): number[] {
  const ys = new Set<number>()
  for (const k of Object.keys(daily)) {
    const y = Number(k.slice(0, 4))
    if (Number.isFinite(y)) {
      ys.add(y)
    }
  }
  return [...ys].sort((a, b) => b - a)
}

/** Sum daily kWh into 12 calendar months (Jan = index 0) for one year. */
export function monthlyTotalsFromDaily(daily: Record<string, number>, year: number): number[] {
  const months = Array.from({ length: 12 }, () => 0)
  for (const [iso, kwh] of Object.entries(daily)) {
    const [ys, ms] = iso.split('-').map(Number)
    if (ys !== year || !ms) {
      continue
    }
    months[ms - 1] += kwh
  }
  return months
}

function isFluviusDagtotalenHeader(line: string): boolean {
  const l = line.toLowerCase()
  return l.includes('van') && l.includes('datum') && l.includes('volume') && l.includes('register')
}

/**
 * Q1–Q4 kWh → 12 maanden, gelijk verdeeld binnen elk kwartaal.
 */
export function expandQuarterlyToMonthly(q: [number, number, number, number]): number[] {
  return [
    q[0] / 3,
    q[0] / 3,
    q[0] / 3,
    q[1] / 3,
    q[1] / 3,
    q[1] / 3,
    q[2] / 3,
    q[2] / 3,
    q[2] / 3,
    q[3] / 3,
    q[3] / 3,
    q[3] / 3,
  ]
}

function extractAllNumbersInOrder(text: string): number[] {
  const stripped = text.replace(/^\uFEFF/, '')
  const lines = stripped.split(/\r?\n/).map((l) => l.trim())
  const nonEmpty = lines.filter((l) => l.length > 0)
  const numbers: number[] = []
  for (const line of nonEmpty) {
    for (const cell of splitCsvLine(line)) {
      const n = parseCellNumber(cell)
      if (n !== null) {
        numbers.push(n)
      }
    }
  }
  return numbers
}

function ensureDayHours(rec: Record<string, number[]>, key: string): number[] {
  let a = rec[key]
  if (!a) {
    a = Array(24).fill(0)
    rec[key] = a
  }
  return a
}

/**
 * Fluvius verbruiks-export (dagtotalen of kwartiertotalen): Afname Dag/Nacht naar kalenderdag + optioneel uurprofiel.
 */
function parseFluviusDagtotalen(text: string): ConsumptionCsvResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const headerIdx = lines.findIndex((l) => l.trim().length > 0)
  if (headerIdx < 0) {
    throw new Error('CSV is leeg.')
  }
  const headerCells = splitCsvLine(lines[headerIdx]!)
  const findCol = (pred: (h: string) => boolean) => headerCells.findIndex(pred)

  const iDate = findCol((h) => h.toLowerCase().includes('van') && h.toLowerCase().includes('datum'))
  const iVanTime = findCol(
    (h) => /^van\s*\(/i.test(h.trim()) && h.toLowerCase().includes('tijdstip'),
  )
  const iRegister = findCol((h) => h.toLowerCase().includes('register'))
  const iVolume = findCol((h) => h.toLowerCase().includes('volume'))

  if (iDate < 0 || iRegister < 0 || iVolume < 0) {
    throw new Error(
      'Fluvius-CSV: verwachte kolommen "Van (datum)", "Register", "Volume" ontbreken.',
    )
  }

  const daily: Record<string, number> = {}
  const dailyDag: Record<string, number> = {}
  const dailyNacht: Record<string, number> = {}
  const dailyHourly: Record<string, number[]> = {}
  const rowsPerDay: Record<string, number> = {}
  let minD: Date | null = null
  let maxD: Date | null = null

  for (let r = headerIdx + 1; r < lines.length; r++) {
    const line = lines[r]!.trim()
    if (!line) {
      continue
    }
    const cells = splitCsvLine(line)
    const minCols = Math.max(iDate, iRegister, iVolume, iVanTime)
    if (cells.length <= minCols) {
      continue
    }
    const register = cells[iRegister] ?? ''
    const regTrim = register.trim()
    if (!/^Afname/i.test(regTrim)) {
      continue
    }
    const dateStr = cells[iDate] ?? ''
    const volStr = cells[iVolume] ?? ''
    const d = parseNlDateDdMmYyyy(dateStr)
    if (!d) {
      continue
    }
    const kwh = volStr.length === 0 ? 0 : parseCellNumber(volStr) ?? 0
    const key = toIsoDate(d)
    daily[key] = (daily[key] ?? 0) + kwh
    rowsPerDay[key] = (rowsPerDay[key] ?? 0) + 1
    if (/^Afname\s+Dag/i.test(regTrim)) {
      dailyDag[key] = (dailyDag[key] ?? 0) + kwh
    } else if (/^Afname\s+Nacht/i.test(regTrim)) {
      dailyNacht[key] = (dailyNacht[key] ?? 0) + kwh
    }
    if (iVanTime >= 0) {
      const h = parseVanTimeHour(cells[iVanTime] ?? '')
      if (h !== null) {
        ensureDayHours(dailyHourly, key)[h] += kwh
      }
    }
    const sd = startOfDay(d)
    if (!minD || sd < minD) {
      minD = sd
    }
    if (!maxD || sd > maxD) {
      maxD = sd
    }
  }

  if (!minD || !maxD || Object.keys(daily).length === 0) {
    throw new Error('Geen afname-gegevens gevonden (verwacht Register "Afname Dag/Nacht").')
  }

  const maxRowsPerDay = Math.max(0, ...Object.values(rowsPerDay))
  const hasQuarterHourDetail =
    iVanTime >= 0 && maxRowsPerDay >= KWARTIER_DETAIL_MIN_ROWS_PER_DAY
  const dailyHourlyOut: Record<string, number[]> | null = hasQuarterHourDetail ? dailyHourly : null
  const fluviusGranularity = hasQuarterHourDetail ? 'kwartier' : 'dag'

  const minDate = toIsoDate(minD)
  const maxDate = toIsoDate(maxD)
  const fullCalendarYears = listFullCalendarYearsInRange(minD, maxD)
  const distinctY = distinctYearsFromDaily(daily)
  const suggestedYear = distinctY[0] ?? maxD.getFullYear()
  const monthlyForSuggestedYear = monthlyTotalsFromDaily(daily, suggestedYear)
  return {
    format: 'fluvius-daily',
    daily,
    dailyDag,
    dailyNacht,
    fluviusGranularity,
    dailyHourly: dailyHourlyOut,
    minDate,
    maxDate,
    fullCalendarYears,
    suggestedYear,
    monthlyForSuggestedYear,
  }
}

/**
 * Detects Fluvius dagtotalen vs. four quarterly kWh vs. 12 monthly values.
 */
export function parseConsumptionCsv(text: string): ConsumptionCsvResult {
  const stripped = text.replace(/^\uFEFF/, '')
  const first = stripped.split(/\r?\n/).find((l) => l.trim().length > 0) ?? ''
  if (isFluviusDagtotalenHeader(first)) {
    return parseFluviusDagtotalen(stripped)
  }

  const nums = extractAllNumbersInOrder(stripped)
  if (nums.length === 4) {
    const q = nums as [number, number, number, number]
    return {
      format: 'quarterly',
      quarters: q,
      monthly: expandQuarterlyToMonthly(q),
    }
  }
  if (nums.length >= 12) {
    return { format: 'simple12', monthly: nums.slice(0, 12) }
  }

  throw new Error(
    `Verwacht 12 maandtotalen, 4 kwartaaltotalen (Q1–Q4), of een Fluvius-export (dag-/kwartiertotalen); ${nums.length} getallen gevonden.`,
  )
}

/** Years shown in UI: prefer complete calendar years; else any year overlapping the file. */
export function listSelectableYears(
  fullCalendarYears: number[],
  minDate: string,
  maxDate: string,
): number[] {
  if (fullCalendarYears.length > 0) {
    return [...fullCalendarYears].sort((a, b) => b - a)
  }
  const yMin = Number(minDate.slice(0, 4))
  const yMax = Number(maxDate.slice(0, 4))
  const out: number[] = []
  for (let y = yMax; y >= yMin; y--) {
    out.push(y)
  }
  return out
}
