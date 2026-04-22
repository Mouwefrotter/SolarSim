import { describe, expect, it } from 'vitest'
import { parsePvgisJsonText, parsePVGISResponse, parseUploadedPvgisFile } from './pvgisParse'
import type { PVGISResponse } from '../types/pvgis'

describe('parsePvgisJsonText', () => {
  it('parses PVGIS-like JSON from a string', () => {
    const monthly = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      E_m: 80 + i,
    }))
    const raw: PVGISResponse = {
      outputs: {
        monthly: { fixed: monthly },
        totals: { fixed: { E_y: 1000 } },
      },
    }
    const text = JSON.stringify(raw)
    const a = parsePvgisJsonText(text)
    const b = parsePVGISResponse(raw)
    expect(a.annualKwhPerKwp).toBe(b.annualKwhPerKwp)
    expect(a.monthlyEmKwhPerKwp).toEqual(b.monthlyEmKwhPerKwp)
    expect(a.inputsMeta).toBeUndefined()
  })

  it('rejects HTML', () => {
    expect(() => parsePvgisJsonText('<html></html>')).toThrow()
  })
})

describe('parseUploadedPvgisFile', () => {
  it('rejects Fluvius consumption CSV with a clear message', () => {
    const csv = `Van (datum);Register;EAN-code
01-01-2024;Afname Dag;123`
    expect(() => parseUploadedPvgisFile(csv)).toThrow(/Fluvius|Verbruik/i)
  })
})
