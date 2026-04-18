import { useQuery } from '@tanstack/react-query'
import type { ParsedPVGIS } from '../types/pvgis'
import { parsePvgisJsonText } from '../utils/pvgisParse'
import { loadParsedPVGIS, pvgisCacheKey, saveParsedPVGIS } from '../utils/pvgisCache'

/**
 * Same-origin path served by Vite proxy (see vite.config) — avoids PVGIS CORS in the browser.
 * Override with e.g. VITE_PVGIS_BASE_URL=https://re.jrc.ec.europa.eu/api/v5_2 if you host your own proxy.
 */
function pvgisBasePath(): string {
  const custom = import.meta.env.VITE_PVGIS_BASE_URL as string | undefined
  if (custom?.trim()) {
    return custom.replace(/\/$/, '')
  }
  return '/api/pvgis'
}

function buildUrl(lat: number, lon: number, tiltDeg: number): string {
  const p = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    peakpower: '1',
    loss: '14',
    outputformat: 'json',
    mountingplace: 'building',
    angle: String(tiltDeg),
    aspect: '0',
    pvtechchoice: 'crystSi',
    components: '1',
  })
  return `${pvgisBasePath()}/PVcalc?${p.toString()}`
}

export function usePVGIS(
  lat: number,
  lon: number,
  tiltDeg: number,
  options?: { fetchEnabled?: boolean },
) {
  const fetchEnabled = options?.fetchEnabled !== false
  const cacheKey = pvgisCacheKey(lat, lon, tiltDeg)
  return useQuery({
    queryKey: ['pvgis', lat, lon, tiltDeg] as const,
    enabled: fetchEnabled,
    queryFn: async (): Promise<ParsedPVGIS> => {
      const cached = loadParsedPVGIS(cacheKey)
      if (cached) {
        return cached
      }
      const res = await fetch(buildUrl(lat, lon, tiltDeg))
      const bodyText = await res.text()
      if (!res.ok) {
        throw new Error(`PVGIS request failed (${res.status})`)
      }
      const parsed = parsePvgisJsonText(bodyText)
      saveParsedPVGIS(cacheKey, parsed)
      return parsed
    },
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
  })
}
