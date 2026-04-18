import { datesForSeason, datesInCalendarMonth } from './seasonDagNacht'
import type { SeasonId } from './seasons'

export interface SeasonHourlyStats {
  season: SeasonId
  label: string
  /** Gemiddelde afname (kWh) in dat uur over alle dagen van het seizoen in het gekozen jaar. */
  avgKwhByHour: number[]
  dayCount: number
}

const SEASON_LABELS: Record<SeasonId, string> = {
  lente: 'Lente',
  zomer: 'Zomer',
  herfst: 'Herfst',
  winter: 'Winter',
}

const SEASON_ORDER: SeasonId[] = ['lente', 'zomer', 'herfst', 'winter']

export function seasonHourlyAveragesForYear(
  dailyHourly: Record<string, number[]>,
  yearY: number,
  fileMin: string,
  fileMax: string,
): SeasonHourlyStats[] {
  return SEASON_ORDER.map((season) => {
    const dates = datesForSeason(season, yearY, fileMin, fileMax)
    const n = dates.length
    const sumByHour = Array(24).fill(0) as number[]
    for (const d of dates) {
      const hrow = dailyHourly[d]
      if (!hrow) {
        continue
      }
      for (let h = 0; h < 24; h++) {
        sumByHour[h] += hrow[h] ?? 0
      }
    }
    const avgKwhByHour =
      n > 0 ? sumByHour.map((s) => s / n) : Array(24).fill(0)
    return {
      season,
      label: SEASON_LABELS[season],
      avgKwhByHour,
      dayCount: n,
    }
  })
}

export interface MonthHourlyStats {
  month1: number
  /** Gemiddelde kWh in dat uur over alle dagen van de maand in het gekozen jaar. */
  avgKwhByHour: number[]
  dayCount: number
}

export function monthHourlyAveragesForYear(
  dailyHourly: Record<string, number[]>,
  yearY: number,
  fileMin: string,
  fileMax: string,
): MonthHourlyStats[] {
  return Array.from({ length: 12 }, (_, i) => {
    const month1 = i + 1
    const dates = datesInCalendarMonth(yearY, month1, fileMin, fileMax)
    const n = dates.length
    const sumByHour = Array(24).fill(0) as number[]
    for (const d of dates) {
      const hrow = dailyHourly[d]
      if (!hrow) {
        continue
      }
      for (let h = 0; h < 24; h++) {
        sumByHour[h] += hrow[h] ?? 0
      }
    }
    const avgKwhByHour =
      n > 0 ? sumByHour.map((s) => s / n) : Array(24).fill(0)
    return {
      month1,
      avgKwhByHour,
      dayCount: n,
    }
  })
}
