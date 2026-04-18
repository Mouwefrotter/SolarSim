/** PVGIS v5.2 PVcalc JSON (partial; API may extend fields) */

export interface PVGISSeriesEntry {
  month?: number
  /** Monthly energy for this orientation [kWh] for the requested peak power */
  E_m?: number
}

export interface PVGISOutputsFixed {
  /** Annual energy [kWh] */
  E_y?: number
  /** Monthly energy per month index */
  E_m?: number[]
}

export interface PVGISOutputs {
  monthly?: {
    fixed?: PVGISSeriesEntry[]
  }
  totals?: {
    fixed?: PVGISOutputsFixed
    /** Some responses nest differently */
    monthly?: {
      fixed?: PVGISSeriesEntry[]
    }
  }
}

export interface PVGISResponse {
  inputs?: unknown
  outputs?: PVGISOutputs
  /** Error payloads */
  message?: string
  status?: string
}

/** Relevante invoer uit een PVGIS JSON-export (v5.2) voor weergave na upload */
export interface PvgisUploadedInputsMeta {
  latitude?: number
  longitude?: number
  /** Hellingshoek t.o.v. horizontaal (°) — “dakhelling” */
  slopeDeg?: number
  /** PVGIS: 0 = zuid, 90 = west, −90 = oost */
  azimuthDeg?: number
  mountingTypeRaw?: string
  pvTechnology?: string
  peakPowerKw?: number
  systemLossPct?: number
}

export interface ParsedPVGIS {
  /** kWh/kWp per calendar month (Jan–Dec) */
  monthlyEmKwhPerKwp: number[]
  /** Annual specific yield kWh/kWp */
  annualKwhPerKwp: number
  /** Alleen gezet bij parse van JSON met `inputs` (upload of API-body met meta) */
  inputsMeta?: PvgisUploadedInputsMeta
  /** PVGIS TMY: globaal horizontaal G(h) in W/m² per uur (JSON `tmy_hourly` of TMY-CSV) */
  tmyGhiDailyHourly?: Record<string, number[]> | null
  tmyRange?: { min: string; max: string } | null
  tmyDataYear?: number | null
  /** `G(h)` uit TMY/CSV; `G(i)` bij PVGIS «hourly»-export (hellingsvlak) */
  tmyIrradianceField?: 'G(h)' | 'G(i)' | null
  /** Meer dan één kalenderjaar in de uurreeks (bijv. seriescalc 2005–2020) → maandgemiddelde over alle jaren */
  tmyMultiYear?: boolean | null
  /** Alleen bij TMY-CSV: volle kalenderjaren in bereik */
  tmyFullCalendarYears?: number[] | null
}
