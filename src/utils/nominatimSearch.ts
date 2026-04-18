const UA = 'SolarSimBelgium/1.0 (educational ROI calculator)'

export interface GeocodeHit {
  lat: number
  lon: number
  displayName: string
}

export async function nominatimSearchBe(
  q: string,
  options: { limit: number; signal?: AbortSignal },
): Promise<GeocodeHit[]> {
  const query = q.trim()
  if (!query) {
    return []
  }
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'json')
  url.searchParams.set('countrycodes', 'be')
  url.searchParams.set('limit', String(options.limit))
  const res = await fetch(url.toString(), {
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'nl',
      'User-Agent': UA,
    },
  })
  if (!res.ok) {
    throw new Error(`Geocoding mislukt (${res.status})`)
  }
  const data = (await res.json()) as Array<{
    lat: string
    lon: string
    display_name: string
  }>
  return data.map((hit) => ({
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    displayName: hit.display_name,
  }))
}

/** Eén beste match (zoals vroeger useGeocode). */
export async function nominatimGeocodeOne(q: string): Promise<GeocodeHit> {
  const hits = await nominatimSearchBe(q, { limit: 1 })
  const hit = hits[0]
  if (!hit) {
    throw new Error('Geen resultaat in België — probeer een ander adres.')
  }
  return hit
}

export interface ReversePlaceResult {
  /** Beste plaatsnaam (stad/gemeente/dorp), indien gevonden */
  placeName: string | null
}

function pickPlaceFromAddress(addr: Record<string, string | undefined>): string | null {
  const v =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.city_district ||
    addr.suburb ||
    addr.hamlet ||
    addr.locality ||
    addr.village_part
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Reverse geocoding (Nominatim) — gebruik spaarzaam i.v.m. fair-use policy. */
export async function nominatimReversePlace(
  lat: number,
  lon: number,
  options?: { signal?: AbortSignal },
): Promise<ReversePlaceResult> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lon))
  url.searchParams.set('format', 'json')
  url.searchParams.set('addressdetails', '1')
  const res = await fetch(url.toString(), {
    signal: options?.signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'nl',
      'User-Agent': UA,
    },
  })
  if (!res.ok) {
    return { placeName: null }
  }
  const data = (await res.json()) as {
    address?: Record<string, string | undefined>
    display_name?: string
  }
  const fromAddr = data.address ? pickPlaceFromAddress(data.address) : null
  if (fromAddr) {
    return { placeName: fromAddr }
  }
  if (data.display_name) {
    const first = data.display_name.split(',').map((s) => s.trim())[0]
    if (first && first.length < 80) {
      return { placeName: first }
    }
  }
  return { placeName: null }
}
