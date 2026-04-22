import { useQuery } from '@tanstack/react-query'
import type { ParsedPVGIS } from '../types/pvgis'
import { parsePvgisJsonText } from '../utils/pvgisParse'
import { loadParsedPVGIS, pvgisCacheKey, type PvgisCacheKeyParams, saveParsedPVGIS } from '../utils/pvgisCache'

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

export interface PvgisPvcalcRequestParams {
  lat: number
  lon: number
  tiltDeg: number
  aspectDeg: number
  systemLossPct: number
  pvtech: string
}

function buildPvcalcUrl(p: PvgisPvcalcRequestParams): string {
  // Altijd 1 kWp: API levert E_m / E_y als kWh per kWp (aansluiting bij solarCalc).
  const sp = new URLSearchParams({
    lat: String(p.lat),
    lon: String(p.lon),
    peakpower: '1',
    loss: String(p.systemLossPct),
    outputformat: 'json',
    mountingplace: 'building',
    angle: String(p.tiltDeg),
    aspect: String(p.aspectDeg),
    pvtechchoice: p.pvtech,
    components: '1',
  })
  return `${pvgisBasePath()}/PVcalc?${sp.toString()}`
}

export function usePVGIS(
  params: PvgisPvcalcRequestParams,
  options?: { fetchEnabled?: boolean },
) {
  const fetchEnabled = options?.fetchEnabled !== false
  const keyParams: PvgisCacheKeyParams = {
    lat: params.lat,
    lon: params.lon,
    tiltDeg: params.tiltDeg,
    aspectDeg: params.aspectDeg,
    systemLossPct: params.systemLossPct,
    pvtech: params.pvtech,
  }
  const cacheKey = pvgisCacheKey(keyParams)
  return useQuery({
    queryKey: ['pvgis', keyParams] as const,
    enabled: fetchEnabled,
    queryFn: async (): Promise<ParsedPVGIS> => {
      const cached = loadParsedPVGIS(cacheKey)
      if (cached) {
        return cached
      }
      const res = await fetch(buildPvcalcUrl(params))
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
