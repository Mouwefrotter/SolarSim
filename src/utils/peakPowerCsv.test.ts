import { describe, expect, it } from 'vitest'
import {
  distinctYearsFromPeakMonths,
  monthlyPeakKwForYear,
  parsePeakPowerCsv,
  peakFullCalendarYears,
} from './peakPowerCsv'

describe('parsePeakPowerCsv', () => {
  const header = `Van (datum);Van (tijdstip);Tot (datum);Tot (tijdstip);EAN;Meter;Metertype;Register;Volume;Eenheid;Validatiestatus;Omschrijving`

  it('parses monthly peak kW rows', () => {
    const rows = [
      `01-04-2023;00:00:00;01-05-2023;00:00:00;ean;m;t;Piekvermogen;1,713;kW;Uitgelezen;`,
      `01-05-2023;00:00:00;01-06-2023;00:00:00;ean;m;t;Piekvermogen;1,519;kW;Uitgelezen;`,
    ]
    const r = parsePeakPowerCsv(`${header}\n${rows.join('\n')}`)
    expect(r.peakKwByMonth['2023-04']).toBeCloseTo(1.713, 3)
    expect(r.peakKwByMonth['2023-05']).toBeCloseTo(1.519, 3)
  })
})

describe('peakFullCalendarYears', () => {
  it('lists years with 12 months of data', () => {
    const p: Record<string, number> = {}
    for (let m = 1; m <= 12; m++) {
      p[`2024-${String(m).padStart(2, '0')}`] = 2
    }
    p['2023-06'] = 1
    expect(peakFullCalendarYears(p)).toEqual([2024])
  })
})

describe('distinctYearsFromPeakMonths', () => {
  it('returns all calendar years present, newest first', () => {
    const p = { '2023-12': 1, '2025-03': 2, '2024-01': 3 }
    expect(distinctYearsFromPeakMonths(p)).toEqual([2025, 2024, 2023])
  })
})

describe('monthlyPeakKwForYear', () => {
  it('returns null for missing months', () => {
    const p = { '2024-03': 1.5 }
    const s = monthlyPeakKwForYear(p, 2024)
    expect(s[0]).toBeNull()
    expect(s[2]).toBeCloseTo(1.5, 3)
  })
})
