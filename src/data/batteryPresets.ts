/**
 * Typische thuisbatterij-presets (Benelux / Vlaanderen — richtwaarden).
 * Fabrikantspecificaties wijzigen; sliders kunnen handmatig worden bijgesteld.
 */
export interface BatteryPreset {
  id: string
  label: string
  /** Nominale bruikbare opslag (kWh), zoals op datasheets */
  nominalKwh: number
  /** Ondergrens SOC als fractie van nominale capaciteit (0–0.25) */
  minSocFrac: number
  chargeEfficiency: number
  dischargeEfficiency: number
  /** Max laad- én ontlaadvermogen (kW), één uur → kWh = kW */
  maxPowerKw: number
  /** Geschat jaarlijks capaciteitsverlies (%/jaar) — voor info / toekomstige NPV */
  annualDegradationPct: number
  /** Typische garantie of levensduur (jaren) — alleen informatief */
  warrantyYears: number
}

export const BATTERY_PRESETS: BatteryPreset[] = [
  {
    id: 'tesla-pw2',
    label: 'Tesla Powerwall 2 (≈14 kWh)',
    nominalKwh: 14,
    minSocFrac: 0.1,
    chargeEfficiency: 0.97,
    dischargeEfficiency: 0.97,
    maxPowerKw: 5,
    annualDegradationPct: 2.5,
    warrantyYears: 10,
  },
  {
    id: 'tesla-pw3',
    label: 'Tesla Powerwall 3 (≈13,5 kWh)',
    nominalKwh: 13.5,
    minSocFrac: 0.1,
    chargeEfficiency: 0.97,
    dischargeEfficiency: 0.97,
    maxPowerKw: 11.5,
    annualDegradationPct: 2.5,
    warrantyYears: 10,
  },
  {
    id: 'byd-hvs-102',
    label: 'BYD Battery-Box HVS (ca. 10 kWh module)',
    nominalKwh: 10.2,
    minSocFrac: 0.05,
    chargeEfficiency: 0.96,
    dischargeEfficiency: 0.96,
    maxPowerKw: 5.1,
    annualDegradationPct: 2,
    warrantyYears: 10,
  },
  {
    id: 'huawei-luna10',
    label: 'Huawei LUNA2000 (10 kWh)',
    nominalKwh: 10,
    minSocFrac: 0.05,
    chargeEfficiency: 0.96,
    dischargeEfficiency: 0.96,
    maxPowerKw: 5,
    annualDegradationPct: 2,
    warrantyYears: 10,
  },
  {
    id: 'lg-resu10',
    label: 'LG RESU 10H (≈9,8 kWh)',
    nominalKwh: 9.8,
    minSocFrac: 0.05,
    chargeEfficiency: 0.96,
    dischargeEfficiency: 0.96,
    maxPowerKw: 5,
    annualDegradationPct: 2,
    warrantyYears: 10,
  },
  {
    id: 'solaredge-10',
    label: 'SolarEdge Home Battery (≈10 kWh)',
    nominalKwh: 9.7,
    minSocFrac: 0.05,
    chargeEfficiency: 0.96,
    dischargeEfficiency: 0.96,
    maxPowerKw: 5,
    annualDegradationPct: 2,
    warrantyYears: 10,
  },
  {
    id: 'pylontech-force',
    label: 'Pylontech Force H2 / vergelijkbaar (≈10,7 kWh)',
    nominalKwh: 10.65,
    minSocFrac: 0.05,
    chargeEfficiency: 0.96,
    dischargeEfficiency: 0.96,
    maxPowerKw: 6,
    annualDegradationPct: 2,
    warrantyYears: 10,
  },
]

export function getBatteryPreset(id: string): BatteryPreset | undefined {
  return BATTERY_PRESETS.find((p) => p.id === id)
}
