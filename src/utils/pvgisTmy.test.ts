import { describe, expect, it } from 'vitest'
import { extractTmyGhiFromPvgisJson, parsePvgisTmyTimestamp, parsePvgisTmyCsv } from './pvgisTmy'

describe('parsePvgisTmyTimestamp', () => {
  it('parses PVGIS TMY time format', () => {
    expect(parsePvgisTmyTimestamp('20050101:1300')).toEqual({ iso: '2005-01-01', hour: 13 })
    expect(parsePvgisTmyTimestamp('  20051231:0000  ')).toEqual({ iso: '2005-12-31', hour: 0 })
  })

  it('rejects invalid input', () => {
    expect(parsePvgisTmyTimestamp('')).toBeNull()
    expect(parsePvgisTmyTimestamp('2005-01-01')).toBeNull()
    expect(parsePvgisTmyTimestamp('20050230:1200')).toBeNull()
  })
})

describe('extractTmyGhiFromPvgisJson', () => {
  it('reads tmy_hourly G(h)', () => {
    const out = extractTmyGhiFromPvgisJson({
      outputs: {
        tmy_hourly: [
          { 'time(UTC)': '20050101:1200', 'G(h)': 100 },
          { 'time(UTC)': '20050101:1300', 'G(h)': 200 },
        ],
      },
    })
    expect(out).not.toBeNull()
    expect(out!.dataYear).toBe(2005)
    expect(out!.irradianceField).toBe('G(h)')
    expect(out!.multiYear).toBe(false)
    expect(out!.dailyHourly['2005-01-01']![12]).toBe(100)
    expect(out!.dailyHourly['2005-01-01']![13]).toBe(200)
  })

  it('reads outputs.hourly G(i) (seriescalc-style)', () => {
    const out = extractTmyGhiFromPvgisJson({
      outputs: {
        hourly: [
          { time: '20050101:1010', 'G(i)': 50 },
          { time: '20050101:1110', 'G(i)': 150 },
        ],
      },
    })
    expect(out).not.toBeNull()
    expect(out!.irradianceField).toBe('G(i)')
    expect(out!.dailyHourly['2005-01-01']![10]).toBe(50)
    expect(out!.dailyHourly['2005-01-01']![11]).toBe(150)
  })

  it('returns null without hourly data', () => {
    expect(extractTmyGhiFromPvgisJson({ outputs: {} })).toBeNull()
    expect(extractTmyGhiFromPvgisJson({})).toBeNull()
  })
})

describe('parsePvgisTmyCsv', () => {
  it('parses minimal TMY CSV with header', () => {
    const csv = `Latitude,51.0
Longitude,4.0
time(UTC),G(h)
20050101:0000,0
20050101:0100,0
`
    const p = parsePvgisTmyCsv(csv)
    expect(p.tmyGhiDailyHourly).toBeDefined()
    expect(p.tmyRange?.min).toBe('2005-01-01')
    expect(p.tmyDataYear).toBe(2005)
    expect(p.inputsMeta?.latitude).toBeCloseTo(51, 5)
  })
})
