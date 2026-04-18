import { describe, expect, it } from 'vitest'
import { monthHourlyAveragesForYear, seasonHourlyAveragesForYear } from './seasonHourly'

describe('seasonHourlyAveragesForYear', () => {
  it('averages hourly totals over season days', () => {
    const Y = 2023
    const d1 = `${Y}-04-18`
    const d2 = `${Y}-04-19`
    const a = Array(24).fill(0)
    a[10] = 2
    const b = Array(24).fill(0)
    b[10] = 4
    const dailyHourly: Record<string, number[]> = {
      [d1]: [...a],
      [d2]: [...b],
    }
    const min = `${Y}-03-01`
    const max = `${Y}-05-31`
    const stats = seasonHourlyAveragesForYear(dailyHourly, Y, min, max)
    const lente = stats.find((s) => s.season === 'lente')
    expect(lente?.dayCount).toBe(92)
    expect(lente?.avgKwhByHour[10]).toBeCloseTo((2 + 4) / 92, 6)
  })
})

describe('monthHourlyAveragesForYear', () => {
  it('averages hourly kWh per calendar month', () => {
    const Y = 2023
    const d1 = `${Y}-04-18`
    const d2 = `${Y}-04-19`
    const a = Array(24).fill(0)
    a[10] = 2
    const b = Array(24).fill(0)
    b[10] = 4
    const dailyHourly: Record<string, number[]> = {
      [d1]: [...a],
      [d2]: [...b],
    }
    const min = `${Y}-04-01`
    const max = `${Y}-04-30`
    const stats = monthHourlyAveragesForYear(dailyHourly, Y, min, max)
    const apr = stats[3]!
    expect(apr.month1).toBe(4)
    expect(apr.dayCount).toBe(30)
    expect(apr.avgKwhByHour[10]).toBeCloseTo((2 + 4) / 30, 6)
  })
})
