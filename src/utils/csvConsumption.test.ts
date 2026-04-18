import { describe, expect, it } from 'vitest'
import {
  distinctYearsFromDaily,
  expandQuarterlyToMonthly,
  listFullCalendarYearsInRange,
  listSelectableYears,
  monthlyTotalsFromDaily,
  parseConsumptionCsv,
  parseVanTimeHour,
} from './csvConsumption'

describe('parseConsumptionCsv simple12', () => {
  it('parses single row with 12 comma-separated kWh', () => {
    const r = parseConsumptionCsv('100,110,120,130,140,150,160,170,180,190,200,210')
    expect(r.format).toBe('simple12')
    if (r.format !== 'simple12') {
      return
    }
    expect(r.monthly).toHaveLength(12)
    expect(r.monthly[0]).toBe(100)
    expect(r.monthly[11]).toBe(210)
  })

  it('throws when not enough numbers', () => {
    expect(() => parseConsumptionCsv('1,2,3')).toThrow(/12 maandtotalen/)
  })
})

describe('parseConsumptionCsv quarterly', () => {
  it('maps 4 quarter kWh to 12 months evenly per quarter', () => {
    const r = parseConsumptionCsv('300,600,900,1200')
    expect(r.format).toBe('quarterly')
    if (r.format !== 'quarterly') {
      return
    }
    expect(r.quarters).toEqual([300, 600, 900, 1200])
    expect(r.monthly).toEqual(expandQuarterlyToMonthly([300, 600, 900, 1200]))
    expect(r.monthly[0]).toBeCloseTo(100)
    expect(r.monthly[3]).toBeCloseTo(200)
    expect(r.monthly[9]).toBeCloseTo(400)
  })
})

describe('Fluvius dagtotalen', () => {
  const header = `Van (datum);Van (tijdstip);Tot (datum);Tot (tijdstip);EAN-code;Meter;Metertype;Register;Volume;Eenheid;x;y`

  it('aggregates Afname per day and builds months for a full year', () => {
    const row = (date: string, nextDay: string, reg: string, vol: string) =>
      `${date};00:00:00;${nextDay};00:00:00;ean;m;t;${reg};${vol};kWh;;`
    const body = [
      row('01-01-2024', '02-01-2024', 'Afname Dag', '10'),
      row('01-01-2024', '02-01-2024', 'Afname Nacht', '5'),
      row('15-06-2024', '16-06-2024', 'Afname Dag', '3'),
    ].join('\n')
    const r = parseConsumptionCsv(`${header}\n${body}`)
    expect(r.format).toBe('fluvius-daily')
    if (r.format !== 'fluvius-daily') {
      return
    }
    expect(r.daily['2024-01-01']).toBeCloseTo(15)
    expect(r.dailyDag['2024-01-01']).toBeCloseTo(10)
    expect(r.dailyNacht['2024-01-01']).toBeCloseTo(5)
    expect(r.daily['2024-06-15']).toBeCloseTo(3)
    expect(r.dailyDag['2024-06-15']).toBeCloseTo(3)
    expect(r.dailyNacht['2024-06-15'] ?? 0).toBe(0)
    const m = monthlyTotalsFromDaily(r.daily, 2024)
    expect(m[0]).toBeCloseTo(15)
    expect(m[5]).toBeCloseTo(3)
    expect(r.fluviusGranularity).toBe('dag')
    expect(r.dailyHourly).toBeNull()
  })

  it('detects kwartiertotalen and aggregates into hourly buckets', () => {
    const header = `Van (datum);Van (tijdstip);Tot (datum);Tot (tijdstip);EAN;Meter;Metertype;Register;Volume;Eenheid;x;y`
    const row = (time: string, reg: string, vol: string) =>
      `18-04-2023;${time};18-04-2023;;ean;m;t;${reg};${vol};kWh;;`
    const times = [
      '00:00:00',
      '00:15:00',
      '00:30:00',
      '00:45:00',
      '01:00:00',
      '01:15:00',
      '01:30:00',
      '01:45:00',
      '02:00:00',
      '02:15:00',
      '02:30:00',
      '02:45:00',
      '03:00:00',
      '03:15:00',
      '03:30:00',
      '03:45:00',
    ]
    const body = times.map((t) => row(t, 'Afname Nacht', '0,010')).join('\n')
    const r = parseConsumptionCsv(`${header}\n${body}`)
    expect(r.format).toBe('fluvius-daily')
    if (r.format !== 'fluvius-daily') {
      return
    }
    expect(r.fluviusGranularity).toBe('kwartier')
    expect(r.dailyHourly).not.toBeNull()
    const h0 = r.dailyHourly!['2023-04-18']![0]
    expect(h0).toBeCloseTo(0.04, 5)
  })
})

describe('parseVanTimeHour', () => {
  it('parses hour from time string', () => {
    expect(parseVanTimeHour('00:15:00')).toBe(0)
    expect(parseVanTimeHour('09:30:00')).toBe(9)
    expect(parseVanTimeHour('23:45:00')).toBe(23)
  })
})

describe('listFullCalendarYearsInRange', () => {
  it('returns years fully covered', () => {
    const dMin = new Date(2023, 3, 18)
    const dMax = new Date(2026, 3, 18)
    expect(listFullCalendarYearsInRange(dMin, dMax)).toEqual([2024, 2025])
  })
})

describe('distinctYearsFromDaily', () => {
  it('lists years present in keys, newest first', () => {
    const daily = { '2023-06-01': 1, '2024-01-15': 2, '2025-03-01': 3 }
    expect(distinctYearsFromDaily(daily)).toEqual([2025, 2024, 2023])
  })
})

describe('listSelectableYears', () => {
  it('prefers full years sorted desc', () => {
    expect(listSelectableYears([2024, 2025], '2023-01-01', '2026-12-31')).toEqual([2025, 2024])
  })

  it('falls back to min-max years when no full year', () => {
    expect(listSelectableYears([], '2023-04-01', '2023-09-01')).toEqual([2023])
  })
})
