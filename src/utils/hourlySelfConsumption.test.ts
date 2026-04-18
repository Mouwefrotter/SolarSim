import { describe, expect, it } from 'vitest'
import {
  averageHourlyKwhForCalendarMonth,
  computeMonthlyEnergyRowsFromHourlyProfile,
  hourlyPanelShareFromPvgisGeometry,
  hourlySolarShareForMonth,
  hourlyWeightsFromHourlyPositiveSeries,
} from './hourlySelfConsumption'

describe('hourlySolarShareForMonth', () => {
  it('sums to 1', () => {
    const w = hourlySolarShareForMonth(51, 5)
    expect(w.length).toBe(24)
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
  })
})

describe('hourlyPanelShareFromPvgisGeometry', () => {
  it('sums to 1', () => {
    const w = hourlyPanelShareFromPvgisGeometry(51, 5, 35, 0)
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
  })

  it('matches horizontal model when slope/azimuth missing', () => {
    const a = hourlySolarShareForMonth(50, 3)
    const b = hourlyPanelShareFromPvgisGeometry(50, 3, undefined, undefined)
    expect(b).toEqual(a)
  })
})

describe('hourlyWeightsFromHourlyPositiveSeries', () => {
  it('normalizes positive hourly series', () => {
    const daily: Record<string, number[]> = {}
    daily['2023-06-01'] = Array.from({ length: 24 }, () => 100)
    const w = hourlyWeightsFromHourlyPositiveSeries(daily, 2023, 6, '2023-06-01', '2023-06-30')
    expect(w).not.toBeNull()
    expect(w!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
  })

  it('with year null averages all June days in file (multi-year)', () => {
    const daily: Record<string, number[]> = {}
    daily['2005-06-01'] = Array.from({ length: 24 }, (_, h) => (h === 12 ? 2 : 0))
    daily['2010-06-01'] = Array.from({ length: 24 }, (_, h) => (h === 12 ? 4 : 0))
    const w = hourlyWeightsFromHourlyPositiveSeries(daily, null, 6, '2005-01-01', '2010-12-31')
    expect(w).not.toBeNull()
    expect(w![12]).toBeGreaterThan(w![11]!)
    expect(w!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5)
  })
})

describe('averageHourlyKwhForCalendarMonth', () => {
  it('averages days in month', () => {
    const dailyHourly: Record<string, number[]> = {}
    dailyHourly['2023-06-01'] = Array(24).fill(0) as number[]
    dailyHourly['2023-06-01']![12] = 2
    dailyHourly['2023-06-02'] = Array(24).fill(0) as number[]
    dailyHourly['2023-06-02']![12] = 4
    const avg = averageHourlyKwhForCalendarMonth(dailyHourly, 2023, 6, '2023-01-01', '2023-12-31')
    expect(avg).not.toBeNull()
    expect(avg![12]).toBeCloseTo(3, 5)
  })
})

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Elke kalenderdag 2023 met profiel per uur (som ≈ dagverbruik-«vorm»). */
function buildYear2023(
  fill: (h: number) => number,
): Record<string, number[]> {
  const o: Record<string, number[]> = {}
  for (let m = 1; m <= 12; m++) {
    const last = new Date(2023, m, 0).getDate()
    for (let d = 1; d <= last; d++) {
      const key = `2023-${pad2(m)}-${pad2(d)}`
      o[key] = Array.from({ length: 24 }, (_, h) => fill(h))
    }
  }
  return o
}

describe('computeMonthlyEnergyRowsFromHourlyProfile', () => {
  it('gives lower annual self than flat month model when load is mainly at night', () => {
    const nightHeavy = buildYear2023((h) => (h <= 2 ? 8 : 0))
    const uniform = buildYear2023(() => 1)
    const monthlyP = Array(12).fill(800)
    const monthlyC = Array(12).fill(800)
    const common = {
      monthlyProductionKwh: monthlyP,
      monthlyConsumptionKwh: monthlyC,
      year: 2023,
      fileMin: '2023-01-01',
      fileMax: '2023-12-31',
      latDeg: 51,
      selfConsumptionRate: 0.7,
    }
    const nightRows = computeMonthlyEnergyRowsFromHourlyProfile({
      ...common,
      dailyHourly: nightHeavy,
    })
    const uniRows = computeMonthlyEnergyRowsFromHourlyProfile({
      ...common,
      dailyHourly: uniform,
    })
    expect(nightRows).not.toBeNull()
    expect(uniRows).not.toBeNull()
    const sumSelf = (r: typeof nightRows) =>
      r!.reduce((a, row) => a + row.selfConsumedKwh, 0)
    expect(sumSelf(nightRows)).toBeLessThan(sumSelf(uniRows) * 0.85)
  })
})
