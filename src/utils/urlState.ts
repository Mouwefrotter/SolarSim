import type { CalculatorState } from '../store/calculatorStore'

export function encodeCalculatorToSearchParams(state: CalculatorState): string {
  const p = new URLSearchParams()
  p.set('ra', String(state.roofAreaM2))
  p.set('pe', String(state.panelEfficiencyPct))
  p.set('tilt', String(state.roofTiltDeg))
  p.set('ac', String(state.annualConsumptionKwh))
  p.set('pp', String(state.purchasePriceEurPerKwh))
  p.set('fi', String(state.feedinTariffEurPerKwh))
  p.set('dm', state.digitalMeter ? '1' : '0')
  p.set('bat', state.batteryEnabled ? '1' : '0')
  p.set('bk', String(state.batteryKwh))
  p.set('lat', String(state.lat))
  p.set('lon', String(state.lon))
  p.set('lbl', state.locationLabel)
  return p.toString()
}

export function applySearchParamsToStore(
  search: string,
  apply: (partial: Partial<CalculatorState>) => void,
): void {
  const p = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  const num = (k: string) => {
    const v = p.get(k)
    if (v === null) {
      return undefined
    }
    const n = Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  const partial: Partial<CalculatorState> = {}

  const ra = num('ra')
  if (ra !== undefined) {
    partial.roofAreaM2 = ra
  }
  const pe = num('pe')
  if (pe !== undefined) {
    partial.panelEfficiencyPct = pe
  }
  const tilt = num('tilt')
  if (tilt !== undefined) {
    partial.roofTiltDeg = tilt
  }
  const ac = num('ac')
  if (ac !== undefined) {
    partial.annualConsumptionKwh = ac
  }
  const pp = num('pp')
  if (pp !== undefined) {
    partial.purchasePriceEurPerKwh = pp
  }
  const fi = num('fi')
  if (fi !== undefined) {
    partial.feedinTariffEurPerKwh = fi
  }
  const dm = p.get('dm')
  if (dm === '0' || dm === '1') {
    partial.digitalMeter = dm === '1'
  }
  const bat = p.get('bat')
  if (bat === '0' || bat === '1') {
    partial.batteryEnabled = bat === '1'
  }
  const bk = num('bk')
  if (bk !== undefined) {
    partial.batteryKwh = bk
  }
  const lat = num('lat')
  if (lat !== undefined) {
    partial.lat = lat
  }
  const lon = num('lon')
  if (lon !== undefined) {
    partial.lon = lon
  }
  const lbl = p.get('lbl')
  if (lbl) {
    partial.locationLabel = decodeURIComponent(lbl)
  }

  if (Object.keys(partial).length > 0) {
    apply(partial)
  }
}
