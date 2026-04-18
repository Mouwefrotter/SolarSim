/** EU PVGIS 5 webapp — coördinaten en optioneel kaart-hash (Leaflet-patroon). */
const PVGIS_TOOLS_EN = 'https://re.jrc.ec.europa.eu/pvg_tools/en/'

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
