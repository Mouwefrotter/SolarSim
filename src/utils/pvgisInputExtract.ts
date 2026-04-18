import type { PvgisUploadedInputsMeta } from '../types/pvgis'

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v
  }
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

/**
 * PVGIS v5: azimuth from south, ° — 0 = zuid, 90 = west, −90 = oost.
 * Map to 8 windrichtingen (NL).
 */
export function pvgisAzimuthToOrientationNl(deg: number): string {
  let a = deg
  while (a > 180) a -= 360
  while (a < -180) a += 360

  if (a >= -22.5 && a <= 22.5) return 'Zuid'
  if (a > 22.5 && a <= 67.5) return 'Zuidwest'
  if (a > 67.5 && a <= 112.5) return 'West'
  if (a > 112.5 && a <= 157.5) return 'Noordwest'
  if (a > 157.5 || a < -157.5) return 'Noord'
  if (a >= -157.5 && a < -112.5) return 'Noordoost'
  if (a >= -112.5 && a < -67.5) return 'Oost'
  return 'Zuidoost'
}

const MOUNTING_TYPE_NL: Record<string, string> = {
  'free-standing': 'Vrijstaand',
  building: 'Op gebouw',
  integrated: 'Gebouwgeïntegreerd',
  bipv: 'BIPV',
}

export function mountingTypeToNl(raw: string | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined
  const k = raw.trim().toLowerCase().replace(/\s+/g, '-')
  return MOUNTING_TYPE_NL[k] ?? raw.replace(/-/g, ' ')
}

export function formatLatLonParen(lat: number, lon: number): string {
  const la = Math.abs(lat)
      .toFixed(3)
      .replace('.', ',')
  const lo = Math.abs(lon)
      .toFixed(3)
      .replace('.', ',')
  const ns = lat >= 0 ? 'N' : 'Z'
  const ew = lon >= 0 ? 'O' : 'W'
  return `${la}° ${ns}, ${lo}° ${ew}`
}

export function extractPvgisUploadedInputs(json: unknown): PvgisUploadedInputsMeta | undefined {
  if (!isRecord(json)) return undefined
  const inputs = json.inputs
  if (!isRecord(inputs)) return undefined

  const meta: PvgisUploadedInputsMeta = {}

  const loc = inputs.location
  if (isRecord(loc)) {
    meta.latitude = num(loc.latitude) ?? num(loc.lat)
    meta.longitude = num(loc.longitude) ?? num(loc.lon)
  }

  const ms = inputs.mounting_system
  if (isRecord(ms)) {
    const fixed = ms.fixed
    if (isRecord(fixed)) {
      const slope = fixed.slope
      if (isRecord(slope)) {
        meta.slopeDeg = num(slope.value)
      }
      const az = fixed.azimuth
      if (isRecord(az)) {
        meta.azimuthDeg = num(az.value)
      }
      const t = fixed.type
      if (typeof t === 'string') {
        meta.mountingTypeRaw = t
      }
    }
  }

  if (meta.slopeDeg === undefined) {
    meta.slopeDeg = num(inputs.angle) ?? num(inputs.slope)
  }
  if (meta.azimuthDeg === undefined) {
    meta.azimuthDeg = num(inputs.aspect) ?? num(inputs.azimuth)
  }

  const pv = inputs.pv_module
  if (isRecord(pv)) {
    const tech = pv.technology
    if (typeof tech === 'string') meta.pvTechnology = tech
    meta.peakPowerKw = num(pv.peak_power)
    meta.systemLossPct = num(pv.system_loss)
  }

  const keys = Object.keys(meta).filter((k) => meta[k as keyof PvgisUploadedInputsMeta] !== undefined)
  return keys.length > 0 ? meta : undefined
}
