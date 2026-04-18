import type { ParsedPVGIS, PVGISResponse } from '../types/pvgis'
import { extractPvgisUploadedInputs } from './pvgisInputExtract'
import {
  buildParsedFromTmyJsonOnly,
  extractTmyGhiFromPvgisJson,
  hasPvCalcMonthlyOutputs,
  parsePvgisTmyCsv,
} from './pvgisTmy'

const MONTHS = 12

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

export function parsePVGISResponse(json: PVGISResponse): ParsedPVGIS {
  const fixedMonthly = json.outputs?.monthly?.fixed
  let monthlyEmKwhPerKwp: number[]

  if (fixedMonthly && fixedMonthly.length >= MONTHS) {
    monthlyEmKwhPerKwp = fixedMonthly.slice(0, MONTHS).map((row) => {
      const v = row.E_m
      if (typeof v !== 'number' || Number.isNaN(v)) {
        throw new Error('PVGIS: missing monthly E_m value')
      }
      return v
    })
  } else {
    const fromTotals = json.outputs?.totals?.fixed?.E_m
    if (Array.isArray(fromTotals) && fromTotals.length >= MONTHS) {
      monthlyEmKwhPerKwp = fromTotals.slice(0, MONTHS) as number[]
    } else {
      throw new Error('PVGIS: could not read monthly energy (outputs.monthly.fixed)')
    }
  }

  let annualKwhPerKwp: number
  const E_y = json.outputs?.totals?.fixed?.E_y
  if (typeof E_y === 'number' && !Number.isNaN(E_y)) {
    annualKwhPerKwp = E_y
  } else {
    annualKwhPerKwp = sum(monthlyEmKwhPerKwp)
  }

  const inputsMeta = extractPvgisUploadedInputs(json)
  const base: ParsedPVGIS = { monthlyEmKwhPerKwp, annualKwhPerKwp, inputsMeta }

  const tmy = extractTmyGhiFromPvgisJson(json as unknown)
  if (!tmy) {
    return base
  }
  return {
    ...base,
    tmyGhiDailyHourly: tmy.dailyHourly,
    tmyRange: tmy.range,
    tmyDataYear: tmy.dataYear,
    tmyIrradianceField: tmy.irradianceField,
    tmyMultiYear: tmy.multiYear,
  }
}

export function parsePvgisJsonDocument(json: unknown): ParsedPVGIS {
  if (hasPvCalcMonthlyOutputs(json)) {
    return parsePVGISResponse(json as PVGISResponse)
  }
  return buildParsedFromTmyJsonOnly(json)
}

/** JSON (PVcalc/TMY) of PVGIS TMY-CSV. */
export function parseUploadedPvgisFile(text: string): ParsedPVGIS {
  const t = text.trimStart()
  if (t.startsWith('{')) {
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error('Geen geldige JSON.')
    }
    return parsePvgisJsonDocument(json)
  }
  if (/g\s*\(\s*h\s*\)/i.test(text) && /time/i.test(text)) {
    return parsePvgisTmyCsv(text)
  }
  throw new Error(
    'Onbekend formaat: gebruik PVGIS JSON (PVcalc, TMY of hourly/seriescalc) of een PVGIS TMY-CSV-export.',
  )
}

/** Parse raw text from a PVGIS `/PVcalc?outputformat=json` response (file upload or clipboard). */
export function parsePvgisJsonText(bodyText: string): ParsedPVGIS {
  const trimmed = bodyText.trimStart()
  if (trimmed.startsWith('<') || !trimmed.startsWith('{')) {
    throw new Error(
      'Geen geldige PVGIS-JSON: verwacht een object (begint met {), geen HTML.',
    )
  }
  const json: unknown = JSON.parse(bodyText)
  return parsePvgisJsonDocument(json)
}
