import type { SeasonId } from './seasons'

export interface SeasonDagNachtStats {
  season: SeasonId
  label: string
  avgDagKwhPerDay: number
  avgNachtKwhPerDay: number
  dayCount: number
}

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function daysInMonth(year: number, m: number): number {
  return new Date(year, m, 0).getDate()
}

/** ISO-dagen in kalendermaand `month1` (1–12) voor `year`, begrensd door [fileMin, fileMax]. */
export function datesInCalendarMonth(
  year: number,
  month1: number,
  fileMin: string,
  fileMax: string,
): string[] {
  const maxD = daysInMonth(year, month1)
  const out: string[] = []
  for (let d = 1; d <= maxD; d++) {
    const s = iso(year, month1, d)
    if (s >= fileMin && s <= fileMax) {
      out.push(s)
    }
  }
  return out
}

/** Meteorologisch BE: winter = dec Y, jan Y+1, feb Y+1 (aansluitend op geselecteerd kalenderjaar Y). */
function winterDates(Y: number, fileMin: string, fileMax: string): string[] {
  return [
    ...datesInCalendarMonth(Y, 12, fileMin, fileMax),
    ...datesInCalendarMonth(Y + 1, 1, fileMin, fileMax),
    ...datesInCalendarMonth(Y + 1, 2, fileMin, fileMax),
  ]
}

/** Alle kalenderdagen van een seizoen binnen het bestand, voor grafiekjaar Y. */
export function datesForSeason(
  season: SeasonId,
  yearY: number,
  fileMin: string,
  fileMax: string,
): string[] {
  switch (season) {
    case 'lente':
      return [
        ...datesInCalendarMonth(yearY, 3, fileMin, fileMax),
        ...datesInCalendarMonth(yearY, 4, fileMin, fileMax),
        ...datesInCalendarMonth(yearY, 5, fileMin, fileMax),
      ]
    case 'zomer':
      return [
        ...datesInCalendarMonth(yearY, 6, fileMin, fileMax),
        ...datesInCalendarMonth(yearY, 7, fileMin, fileMax),
        ...datesInCalendarMonth(yearY, 8, fileMin, fileMax),
      ]
    case 'herfst':
      return [
        ...datesInCalendarMonth(yearY, 9, fileMin, fileMax),
        ...datesInCalendarMonth(yearY, 10, fileMin, fileMax),
        ...datesInCalendarMonth(yearY, 11, fileMin, fileMax),
      ]
    case 'winter':
      return winterDates(yearY, fileMin, fileMax)
    default:
      return []
  }
}

const SEASON_LABELS: Record<SeasonId, string> = {
  lente: 'Lente',
  zomer: 'Zomer',
  herfst: 'Herfst',
  winter: 'Winter',
}

const SEASON_ORDER: SeasonId[] = ['lente', 'zomer', 'herfst', 'winter']

export function seasonDagNachtAveragesForYear(
  dailyDag: Record<string, number>,
  dailyNacht: Record<string, number>,
  yearY: number,
  fileMin: string,
  fileMax: string,
): SeasonDagNachtStats[] {
  return SEASON_ORDER.map((season) => {
    const dates = datesForSeason(season, yearY, fileMin, fileMax)
    let sumD = 0
    let sumN = 0
    const n = dates.length
    for (const d of dates) {
      sumD += dailyDag[d] ?? 0
      sumN += dailyNacht[d] ?? 0
    }
    const dayCount = n
    return {
      season,
      label: SEASON_LABELS[season],
      avgDagKwhPerDay: dayCount > 0 ? sumD / dayCount : 0,
      avgNachtKwhPerDay: dayCount > 0 ? sumN / dayCount : 0,
      dayCount,
    }
  })
}

export interface MonthDagNachtStats {
  month1: number
  avgDagKwhPerDay: number
  avgNachtKwhPerDay: number
  dayCount: number
}

/** Gemiddelde dag/nacht per kalendermaand (jan–dec) voor het gekozen jaar binnen het bestandsbereik. */
export function monthDagNachtAveragesForYear(
  dailyDag: Record<string, number>,
  dailyNacht: Record<string, number>,
  yearY: number,
  fileMin: string,
  fileMax: string,
): MonthDagNachtStats[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month1 = i + 1
    const dates = datesInCalendarMonth(yearY, month1, fileMin, fileMax)
    let sumD = 0
    let sumN = 0
    const n = dates.length
    for (const d of dates) {
      sumD += dailyDag[d] ?? 0
      sumN += dailyNacht[d] ?? 0
    }
    return {
      month1,
      avgDagKwhPerDay: n > 0 ? sumD / n : 0,
      avgNachtKwhPerDay: n > 0 ? sumN / n : 0,
      dayCount: n,
    }
  })
}
