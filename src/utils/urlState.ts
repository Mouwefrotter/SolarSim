import type { CalculatorState } from '../store/calculatorStore'

export function encodeCalculatorToSearchParams(state: CalculatorState): string {
  const p = new URLSearchParams()
  p.set('ra', String(state.roofAreaM2))
  p.set('pe', String(state.panelEfficiencyPct))
  p.set('tilt', String(state.roofTiltDeg))
  p.set('ac', String(state.annualConsumptionKwh))
  p.set('pp', String(state.purchasePriceEurPerKwh))
  p.set('fi', String(state.feedinTariffEurPerKwh))
  p.set('ct', String(state.capacityTariffEurPerKwYear))
  p.set('dm', state.digitalMeter ? '1' : '0')
  p.set('bat', state.batteryEnabled ? '1' : '0')
  p.set('bk', String(state.batteryKwh))
  if (state.batteryPresetId) {
    p.set('bpid', state.batteryPresetId)
  }
  p.set('bms', String(state.batteryMinSocFrac))
  p.set('bce', String(state.batteryChargeEff))
  p.set('bde', String(state.batteryDischargeEff))
  p.set('bmp', String(state.batteryMaxPowerKw))
  p.set('bad', String(state.batteryAnnualDegradationPct))
  p.set('bwy', String(state.batteryWarrantyYears))
  p.set('lat', String(state.lat))
  p.set('lon', String(state.lon))
  p.set('lbl', state.locationLabel)
  p.set('asp', String(state.pvgisPanelAzimuthDeg))
  p.set('ppk', String(state.pvgisPeakPowerKw))
  p.set('ploss', String(state.pvgisSystemLossPct))
  p.set('pvt', state.pvgisPvtechChoice)
  p.set('psy', String(state.pvgisSeriesStartYear))
  p.set('pey', String(state.pvgisSeriesEndYear))
  if (state.consumptionCsvUseMixedYears && state.consumptionCsvYearSecondary != null) {
    p.set('cmx', '1')
    p.set('c2y', String(state.consumptionCsvYearSecondary))
    p.set('cmd', String(state.consumptionCsvMixedFirstMonthSecondary))
  }
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
  const ct = num('ct')
  if (ct !== undefined) {
    partial.capacityTariffEurPerKwYear = ct
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
  const bpid = p.get('bpid')
  if (bpid) {
    partial.batteryPresetId = bpid
  }
  const bms = num('bms')
  if (bms !== undefined) {
    partial.batteryMinSocFrac = bms
  }
  const bce = num('bce')
  if (bce !== undefined) {
    partial.batteryChargeEff = bce
  }
  const bde = num('bde')
  if (bde !== undefined) {
    partial.batteryDischargeEff = bde
  }
  const bmp = num('bmp')
  if (bmp !== undefined) {
    partial.batteryMaxPowerKw = bmp
  }
  const bad = num('bad')
  if (bad !== undefined) {
    partial.batteryAnnualDegradationPct = bad
  }
  const bwy = num('bwy')
  if (bwy !== undefined) {
    partial.batteryWarrantyYears = bwy
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

  const asp = num('asp')
  if (asp !== undefined) {
    partial.pvgisPanelAzimuthDeg = asp
  }
  const ppk = num('ppk')
  if (ppk !== undefined) {
    partial.pvgisPeakPowerKw = ppk
  }
  const ploss = num('ploss')
  if (ploss !== undefined) {
    partial.pvgisSystemLossPct = ploss
  }
  const pvt = p.get('pvt')
  if (pvt) {
    partial.pvgisPvtechChoice = pvt
  }
  const psy = num('psy')
  if (psy !== undefined) {
    partial.pvgisSeriesStartYear = Math.round(psy)
  }
  const pey = num('pey')
  if (pey !== undefined) {
    partial.pvgisSeriesEndYear = Math.round(pey)
  }

  const cmx = p.get('cmx')
  if (cmx === '1') {
    partial.consumptionCsvUseMixedYears = true
    const c2y = num('c2y')
    const cmd = num('cmd')
    if (c2y !== undefined) {
      partial.consumptionCsvYearSecondary = c2y
    }
    if (cmd !== undefined && cmd >= 1 && cmd <= 12) {
      partial.consumptionCsvMixedFirstMonthSecondary = cmd
    }
  }

  if (Object.keys(partial).length > 0) {
    apply(partial)
  }
}
