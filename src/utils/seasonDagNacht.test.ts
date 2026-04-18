import { describe, expect, it } from 'vitest'
import { monthDagNachtAveragesForYear, seasonDagNachtAveragesForYear } from './seasonDagNacht'

describe('seasonDagNachtAveragesForYear', () => {
  it('averages dag/nacht over meteorological seasons for a calendar year', () => {
    const Y = 2024
    const dag: Record<string, number> = {}
    const nacht: Record<string, number> = {}
    dag[`${Y}-03-15`] = 6
    nacht[`${Y}-03-15`] = 4
    dag[`${Y}-07-15`] = 2
    nacht[`${Y}-07-15`] = 1
    const min = `${Y}-01-01`
    const max = `${Y}-12-31`
    const stats = seasonDagNachtAveragesForYear(dag, nacht, Y, min, max)
    const lente = stats.find((s) => s.season === 'lente')
    const zomer = stats.find((s) => s.season === 'zomer')
    expect(lente?.dayCount).toBe(92)
    expect(lente?.avgDagKwhPerDay).toBeCloseTo(6 / 92, 10)
    expect(lente?.avgNachtKwhPerDay).toBeCloseTo(4 / 92, 10)
    expect(zomer?.avgDagKwhPerDay).toBeCloseTo(2 / 92, 10)
  })

  it('winter spans Dec(Y) and Jan–Feb(Y+1) when in range', () => {
    const dag: Record<string, number> = {}
    const nacht: Record<string, number> = {}
    dag['2024-12-31'] = 30
    nacht['2024-12-31'] = 10
    dag['2025-01-15'] = 3
    nacht['2025-01-15'] = 1
    const stats = seasonDagNachtAveragesForYear(dag, nacht, 2024, '2024-12-01', '2025-02-28')
    const winter = stats.find((s) => s.season === 'winter')
    expect(winter?.dayCount).toBe(31 + 31 + 28)
    expect(winter?.avgDagKwhPerDay).toBeCloseTo((30 + 3) / (31 + 31 + 28), 8)
  })
})

describe('monthDagNachtAveragesForYear', () => {
  it('averages dag/nacht per calendar month', () => {
    const Y = 2024
    const dag: Record<string, number> = {}
    const nacht: Record<string, number> = {}
    dag[`${Y}-03-15`] = 30
    nacht[`${Y}-03-15`] = 10
    const min = `${Y}-01-01`
    const max = `${Y}-12-31`
    const stats = monthDagNachtAveragesForYear(dag, nacht, Y, min, max)
    const m3 = stats[2]!
    expect(m3.month1).toBe(3)
    expect(m3.dayCount).toBe(31)
    expect(m3.avgDagKwhPerDay).toBeCloseTo(30 / 31, 8)
    expect(m3.avgNachtKwhPerDay).toBeCloseTo(10 / 31, 8)
  })
})
