import { parseCellNumber, parseNlDateDdMmYyyy, toIsoDate } from './csvConsumption'

export interface ParsePeakPowerCsvResult {
  /** Kalendermaand `yyyy-mm` → gemeten piek afname (kW) voor die maand */
  peakKwByMonth: Record<string, number>
  minDate: string
  maxDate: string
  /** Jaren met 12 maanden piekdata */
  fullCalendarYears: number[]
  suggestedYear: number
}

function splitCsvLine(line: string): string[] {
  const sep = line.includes(';') ? ';' : ','
  return line.split(sep).map((x) => x.trim())
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Alle kalenderjaren waarvoor minstens één maand in de CSV zit (meest recent eerst). */
export function distinctYearsFromPeakMonths(peakKwByMonth: Record<string, number>): number[] {
  const ys = new Set<number>()
  for (const k of Object.keys(peakKwByMonth)) {
    ys.add(Number(k.slice(0, 4)))
  }
  return [...ys].sort((a, b) => b - a)
}

/** Maanden met een waarde voor jaar Y waarvan alle 12 maanden aanwezig zijn. */
export function peakFullCalendarYears(peakKwByMonth: Record<string, number>): number[] {
  const ys = new Set<number>()
  for (const k of Object.keys(peakKwByMonth)) {
    ys.add(Number(k.slice(0, 4)))
  }
  const out: number[] = []
  for (const y of [...ys].sort((a, b) => a - b)) {
    let n = 0
    for (let m = 1; m <= 12; m++) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      if (peakKwByMonth[key] !== undefined) {
        n++
      }
    }
    if (n === 12) {
      out.push(y)
    }
  }
  return out
}

export function monthlyPeakKwForYear(
  peakKwByMonth: Record<string, number>,
  year: number,
): (number | null)[] {
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    const v = peakKwByMonth[key]
    return v === undefined ? null : v
  })
}

/**
 * Fluvius «Historiek piekvermogen»: één rij per maand, Register «Piekvermogen», Volume in kW.
 */
export function parsePeakPowerCsv(text: string): ParsePeakPowerCsvResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  const headerIdx = lines.findIndex((l) => l.trim().length > 0)
  if (headerIdx < 0) {
    throw new Error('CSV is leeg.')
  }
  const headerCells = splitCsvLine(lines[headerIdx]!)
  const findCol = (pred: (h: string) => boolean) => headerCells.findIndex(pred)

  const iDate = findCol((h) => h.toLowerCase().includes('van') && h.toLowerCase().includes('datum'))
  const iRegister = findCol((h) => h.toLowerCase().includes('register'))
  const iVolume = findCol((h) => h.toLowerCase().includes('volume'))

  if (iDate < 0 || iRegister < 0 || iVolume < 0) {
    throw new Error(
      'Fluvius piek-CSV: verwacht kolommen «Van (datum)», «Register», «Volume».',
    )
  }

  const peakKwByMonth: Record<string, number> = {}
  let minD: Date | null = null
  let maxD: Date | null = null

  for (let r = headerIdx + 1; r < lines.length; r++) {
    const line = lines[r]!.trim()
    if (!line) {
      continue
    }
    const cells = splitCsvLine(line)
    const minCols = Math.max(iDate, iRegister, iVolume)
    if (cells.length <= minCols) {
      continue
    }
    const register = (cells[iRegister] ?? '').trim()
    if (!/piekvermogen/i.test(register)) {
      continue
    }
    const dateStr = cells[iDate] ?? ''
    const volStr = cells[iVolume] ?? ''
    const d = parseNlDateDdMmYyyy(dateStr)
    if (!d) {
      continue
    }
    const kw = volStr.length === 0 ? 0 : parseCellNumber(volStr) ?? 0
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    peakKwByMonth[key] = kw

    const sd = startOfDay(d)
    if (!minD || sd < minD) {
      minD = sd
    }
    if (!maxD || sd > maxD) {
      maxD = sd
    }
  }

  if (!minD || !maxD || Object.keys(peakKwByMonth).length === 0) {
    throw new Error(
      'Geen «Piekvermogen»-registers gevonden (Fluvius-export historiek piekvermogen verwacht).',
    )
  }

  const minDate = toIsoDate(minD)
  const maxDate = toIsoDate(maxD)
  const fullCalendarYears = peakFullCalendarYears(peakKwByMonth)
  const distinctYears = distinctYearsFromPeakMonths(peakKwByMonth)
  const suggestedYear = distinctYears[0] ?? Math.max(...Object.keys(peakKwByMonth).map((k) => Number(k.slice(0, 4))))

  return {
    peakKwByMonth,
    minDate,
    maxDate,
    fullCalendarYears,
    suggestedYear,
  }
}
