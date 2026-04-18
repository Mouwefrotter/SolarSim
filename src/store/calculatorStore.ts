import { create } from 'zustand'
import type { ParsedPVGIS } from '../types/pvgis'
import { monthlyTotalsFromDaily } from '../utils/csvConsumption'

export const DEFAULT_LAT = 50.89
export const DEFAULT_LON = 4.733
export const DEFAULT_LOCATION_LABEL = 'Kessel-Lo, België'

export interface CalculatorState {
  roofAreaM2: number
  panelEfficiencyPct: number
  roofTiltDeg: number
  annualConsumptionKwh: number
  purchasePriceEurPerKwh: number
  feedinTariffEurPerKwh: number
  digitalMeter: boolean
  batteryEnabled: boolean
  batteryKwh: number
  lat: number
  lon: number
  locationLabel: string
  /** Last 12 months kWh loaded from Fluvius — Jan–Dec bucketed when possible */
  fluviusMonthlyKwh: number[] | null
  fluviusEan: string | null
  fluviusAddress: string | null
  showActualVersusEstimated: boolean
  fluviusClientId: string
  fluviusRedirectUri: string
  /** Optional: raw PVGIS `/PVcalc` JSON (upload) overrides API fetch */
  pvgisManual: ParsedPVGIS | null
  pvgisManualFileName: string | null
  /** Jan–Dec kWh from CSV (scaled by jaarverbruik-slider); source = simple 12, kwartalen→maanden of Fluvius daily */
  consumptionCsvMonthlyKwh: number[] | null
  consumptionCsvFileName: string | null
  consumptionCsvFormat: 'simple' | 'quarterly' | 'fluvius-daily' | null
  /** ISO dates yyyy-mm-dd → summed Afname kWh that day */
  consumptionCsvDaily: Record<string, number> | null
  /** Afname Dag / Afname Nacht per dag (Fluvius) */
  consumptionCsvDailyDag: Record<string, number> | null
  consumptionCsvDailyNacht: Record<string, number> | null
  /** Per dag 24× kWh in dat uur (Fluvius kwartiertotalen); null bij enkel dagtotalen */
  consumptionCsvDailyHourly: Record<string, number[]> | null
  /** kwartier = voldoende detail voor uur-seizoensgrafieken; dag = alleen dag/nacht-balken */
  consumptionCsvFluviusGranularity: 'dag' | 'kwartier' | null
  consumptionCsvFullYears: number[] | null
  consumptionCsvDateRange: { min: string; max: string } | null
  consumptionCsvSelectedYear: number | null

  /** Fluvius «Historiek piekvermogen»: maand → kW piek afname */
  peakPowerKwByMonth: Record<string, number> | null
  peakPowerFileName: string | null
  peakPowerDateRange: { min: string; max: string } | null
  peakPowerFullYears: number[] | null
  peakPowerSelectedYear: number | null

  setRoofAreaM2: (v: number) => void
  setPanelEfficiencyPct: (v: number) => void
  setRoofTiltDeg: (v: number) => void
  setAnnualConsumptionKwh: (v: number) => void
  setPurchasePriceEurPerKwh: (v: number) => void
  setFeedinTariffEurPerKwh: (v: number) => void
  setDigitalMeter: (v: boolean) => void
  setBatteryEnabled: (v: boolean) => void
  setBatteryKwh: (v: number) => void
  setLocation: (lat: number, lon: number, label: string) => void
  setFluviusImport: (
    monthly: number[] | null,
    ean: string | null,
    address: string | null,
  ) => void
  setShowActualVersusEstimated: (v: boolean) => void
  setFluviusSettings: (clientId: string, redirectUri: string) => void
  setPvgisManual: (data: ParsedPVGIS | null, fileName?: string | null) => void
  setConsumptionCsvSimple: (
    monthly: number[],
    fileName: string | null,
    format?: 'simple' | 'quarterly',
  ) => void
  setConsumptionCsvFluvius: (input: {
    daily: Record<string, number>
    dailyDag: Record<string, number>
    dailyNacht: Record<string, number>
    fullYears: number[]
    minDate: string
    maxDate: string
    selectedYear: number
    monthly: number[]
    fileName: string | null
    fluviusGranularity: 'dag' | 'kwartier'
    dailyHourly: Record<string, number[]> | null
  }) => void
  setConsumptionCsvYear: (year: number) => void
  clearConsumptionCsv: () => void
  setPeakPowerCsv: (input: {
    peakKwByMonth: Record<string, number>
    minDate: string
    maxDate: string
    fullYears: number[]
    suggestedYear: number
    fileName: string | null
  }) => void
  setPeakPowerYear: (year: number) => void
  clearPeakPowerCsv: () => void
  resetLocation: () => void
}

const consumptionCsvInitial = {
  consumptionCsvMonthlyKwh: null as number[] | null,
  consumptionCsvFileName: null as string | null,
  consumptionCsvFormat: null as 'simple' | 'quarterly' | 'fluvius-daily' | null,
  consumptionCsvDaily: null as Record<string, number> | null,
  consumptionCsvDailyDag: null as Record<string, number> | null,
  consumptionCsvDailyNacht: null as Record<string, number> | null,
  consumptionCsvDailyHourly: null as Record<string, number[]> | null,
  consumptionCsvFluviusGranularity: null as 'dag' | 'kwartier' | null,
  consumptionCsvFullYears: null as number[] | null,
  consumptionCsvDateRange: null as { min: string; max: string } | null,
  consumptionCsvSelectedYear: null as number | null,
}

const peakPowerInitial = {
  peakPowerKwByMonth: null as Record<string, number> | null,
  peakPowerFileName: null as string | null,
  peakPowerDateRange: null as { min: string; max: string } | null,
  peakPowerFullYears: null as number[] | null,
  peakPowerSelectedYear: null as number | null,
}

const initial = {
  roofAreaM2: 30,
  panelEfficiencyPct: 20,
  roofTiltDeg: 35,
  annualConsumptionKwh: 3500,
  purchasePriceEurPerKwh: 0.4,
  feedinTariffEurPerKwh: 0.04,
  digitalMeter: true,
  batteryEnabled: false,
  batteryKwh: 10,
  lat: DEFAULT_LAT,
  lon: DEFAULT_LON,
  locationLabel: DEFAULT_LOCATION_LABEL,
  fluviusMonthlyKwh: null,
  fluviusEan: null,
  fluviusAddress: null,
  showActualVersusEstimated: true,
  fluviusClientId: '',
  fluviusRedirectUri: typeof window !== 'undefined' ? `${window.location.origin}/` : '',
  pvgisManual: null,
  pvgisManualFileName: null,
  ...consumptionCsvInitial,
  ...peakPowerInitial,
}

export const useCalculatorStore = create<CalculatorState>((set) => ({
  ...initial,

  setRoofAreaM2: (roofAreaM2) => set({ roofAreaM2 }),
  setPanelEfficiencyPct: (panelEfficiencyPct) => set({ panelEfficiencyPct }),
  setRoofTiltDeg: (roofTiltDeg) => set({ roofTiltDeg }),
  setAnnualConsumptionKwh: (annualConsumptionKwh) => set({ annualConsumptionKwh }),
  setPurchasePriceEurPerKwh: (purchasePriceEurPerKwh) => set({ purchasePriceEurPerKwh }),
  setFeedinTariffEurPerKwh: (feedinTariffEurPerKwh) => set({ feedinTariffEurPerKwh }),
  setDigitalMeter: (digitalMeter) => set({ digitalMeter }),
  setBatteryEnabled: (batteryEnabled) => set({ batteryEnabled }),
  setBatteryKwh: (batteryKwh) => set({ batteryKwh }),
  setLocation: (lat, lon, locationLabel) => set({ lat, lon, locationLabel }),
  setFluviusImport: (fluviusMonthlyKwh, fluviusEan, fluviusAddress) =>
    set({ fluviusMonthlyKwh, fluviusEan, fluviusAddress }),
  setShowActualVersusEstimated: (showActualVersusEstimated) => set({ showActualVersusEstimated }),
  setFluviusSettings: (fluviusClientId, fluviusRedirectUri) =>
    set({ fluviusClientId, fluviusRedirectUri }),
  setPvgisManual: (pvgisManual, pvgisManualFileName = null) =>
    set({ pvgisManual, pvgisManualFileName }),

  setConsumptionCsvSimple: (monthly, fileName, format = 'simple') =>
    set({
      ...consumptionCsvInitial,
      consumptionCsvMonthlyKwh: monthly,
      consumptionCsvFileName: fileName,
      consumptionCsvFormat: format,
    }),

  setConsumptionCsvFluvius: (input) => {
    const total = input.monthly.reduce((a, b) => a + b, 0)
    set((state) => ({
      consumptionCsvDaily: input.daily,
      consumptionCsvDailyDag: input.dailyDag,
      consumptionCsvDailyNacht: input.dailyNacht,
      consumptionCsvDailyHourly: input.dailyHourly,
      consumptionCsvFluviusGranularity: input.fluviusGranularity,
      consumptionCsvFullYears: input.fullYears,
      consumptionCsvDateRange: { min: input.minDate, max: input.maxDate },
      consumptionCsvSelectedYear: input.selectedYear,
      consumptionCsvMonthlyKwh: input.monthly,
      consumptionCsvFileName: input.fileName,
      consumptionCsvFormat: 'fluvius-daily',
      annualConsumptionKwh: total > 0 ? total : state.annualConsumptionKwh,
    }))
  },

  setConsumptionCsvYear: (year) =>
    set((state) => {
      if (!state.consumptionCsvDaily || state.consumptionCsvFormat !== 'fluvius-daily') {
        return {}
      }
      const monthly = monthlyTotalsFromDaily(state.consumptionCsvDaily, year)
      const total = monthly.reduce((a, b) => a + b, 0)
      return {
        consumptionCsvSelectedYear: year,
        consumptionCsvMonthlyKwh: monthly,
        annualConsumptionKwh: total > 0 ? total : state.annualConsumptionKwh,
      }
    }),

  clearConsumptionCsv: () => set({ ...consumptionCsvInitial }),

  setPeakPowerCsv: (input) =>
    set({
      peakPowerKwByMonth: input.peakKwByMonth,
      peakPowerFileName: input.fileName,
      peakPowerDateRange: { min: input.minDate, max: input.maxDate },
      peakPowerFullYears: input.fullYears,
      peakPowerSelectedYear: input.suggestedYear,
    }),

  setPeakPowerYear: (year) => set({ peakPowerSelectedYear: year }),

  clearPeakPowerCsv: () => set({ ...peakPowerInitial }),

  resetLocation: () =>
    set({
      lat: DEFAULT_LAT,
      lon: DEFAULT_LON,
      locationLabel: DEFAULT_LOCATION_LABEL,
    }),
}))
