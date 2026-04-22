/** EU PVGIS 5 webapp — coördinaten en optioneel kaart-hash (Leaflet-patroon). */
const PVGIS_TOOLS_EN = 'https://re.jrc.ec.europa.eu/pvg_tools/en/'

const PVGIS_API = 'https://re.jrc.ec.europa.eu/api/v5_2'

/** `pvtechchoice` waarden (PVGIS v5.2 API) — zie re.jrc.ec.europa.eu. */
export const PVGIS_PV_TECH_OPTIONS: { value: string; label: string }[] = [
  { value: 'crystSi', label: 'Kristallijne silicium' },
  { value: 'CIS', label: 'CIS / CIGS' },
  { value: 'CdTe', label: 'CdTe' },
  { value: 'Unknown', label: 'Onbekend' },
]

export interface PvgisSeriescalcUrlParams {
  lat: number
  lon: number
  /** kWp, voor de export-URL; intern blijft PVcalc 1 kWp (per kWp) */
  peakpowerKw: number
  systemLossPct: number
  angleDeg: number
  /** Azimuth / aspect, ° t.o.v. zuiden (PVGIS-conventie) */
  aspectDeg: number
  pvtechchoice: string
  startYear: number
  endYear: number
  /** 'csv' | 'json' */
  outputformat: 'csv' | 'json'
}

/**
 * Publiek PVGIS-endpoint; direct JRC-URL (geen proxy) zodat de browser de download kan starten.
 * seriescalc: tijdreeksen m.b.v. reeks jaren; handig voor handmatig CSV-opslaan.
 */
export function buildPvgisSeriescalcDownloadUrl(p: PvgisSeriescalcUrlParams): string {
  const u = new URLSearchParams({
    lat: String(p.lat),
    lon: String(p.lon),
    peakpower: String(p.peakpowerKw),
    loss: String(p.systemLossPct),
    angle: String(p.angleDeg),
    aspect: String(p.aspectDeg),
    pvtechchoice: p.pvtechchoice,
    startyear: String(p.startYear),
    endyear: String(p.endYear),
    outputformat: p.outputformat,
  })
  return `${PVGIS_API}/seriescalc?${u.toString()}`
}

export function pvgisToolsOpenUrl(lat: number, lon: number): string {
  const zoom = 12
  const la = lat.toFixed(5)
  const lo = lon.toFixed(5)
  const u = new URL(PVGIS_TOOLS_EN)
  u.searchParams.set('lat', la)
  u.searchParams.set('lon', lo)
  u.hash = `map=${zoom}/${la}/${lo}`
  return u.toString()
}
