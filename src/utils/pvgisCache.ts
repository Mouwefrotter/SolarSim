import type { ParsedPVGIS } from '../types/pvgis'

const PREFIX = 'solarsim-pvgis:'
const TTL_MS = 24 * 60 * 60 * 1000

interface CacheEntry {
  storedAt: number
  data: ParsedPVGIS
}

export function pvgisCacheKey(lat: number, lon: number, tiltDeg: number): string {
  return `${PREFIX}${lat.toFixed(4)}:${lon.toFixed(4)}:${tiltDeg}`
}

export function loadParsedPVGIS(cacheKey: string): ParsedPVGIS | null {
  try {
    const raw = localStorage.getItem(cacheKey)
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as CacheEntry
    if (Date.now() - parsed.storedAt > TTL_MS) {
      localStorage.removeItem(cacheKey)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

export function saveParsedPVGIS(cacheKey: string, data: ParsedPVGIS): void {
  const entry: CacheEntry = { storedAt: Date.now(), data }
  try {
    localStorage.setItem(cacheKey, JSON.stringify(entry))
  } catch {
    /* quota */
  }
}
