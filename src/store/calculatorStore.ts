import { create } from 'zustand'
import type { ParsedPVGIS } from '../types/pvgis'
import { getBatteryPreset } from '../data/batteryPresets'
import { buildFluviusMonthlyKwh } from '../utils/csvConsumption'

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
  /** Geselecteerde cataloguspreset, of null = handmatig */
  batteryPresetId: string | null
  /** Min. SOC als fractie van nominale kWh (0–0.25) */
  batteryMinSocFrac: number
  batteryChargeEff: number
  batteryDischargeEff: number
  /** Max laad/ontlaad per uur (kWh) */
  batteryMaxPowerKw: number
  /** Geschat capaciteitsverlies %/jaar (info; sim = jaar 0) */
  batteryAnnualDegradationPct: number
  /** Typische garantie jaren (info) */
  batteryWarrantyYears: number
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
  /**
   * Azimuth / aspect voor PVGIS (° t.o.v. zuiden): 0 = zuid, negatief = oost, positief = west
   * (conventie re.jrc.ec.europa.eu).
   */
  pvgisPanelAzimuthDeg: number
  /**
   * Nomin. vermogen in kWp in de seriescalc-export-URL; in-app PVcalc blijft 1 kWp (per kWp)
   */
  pvgisPeakPowerKw: number
  pvgisSystemLossPct: number
  pvgisPvtechChoice: string
  pvgisSeriesStartYear: number
  pvgisSeriesEndYear: number
  /** Na eerste klik op «Laad opbrengst in app» wordt PVGIS (PVcalc) opgehaald; geen auto-fetch bij start. */
  pvgisProductionLoaded: boolean
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
  /** Jan– … uit eerste jaar, daarna tweede (onvolledige Fluvius-export) */
  consumptionCsvUseMixedYears: boolean
  /** Eerste maand (1=jan) die van `consumptionCsvYearSecondary` komt */
  consumptionCsvMixedFirstMonthSecondary: number
  /** Tweede kalenderjaar; alleen met mix actief */
  consumptionCsvYearSecondary: number | null

  /** Fluvius «Historiek piekvermogen»: maand → kW piek afname */
  peakPowerKwByMonth: Record<string, number> | null
  peakPowerFileName: string | null
  peakPowerDateRange: { min: string; max: string } | null
  peakPowerFullYears: number[] | null
  peakPowerSelectedYear: number | null
  /** €/kW piekafname / jaar — voor besparing t.o.v. geüploade piek-CSV */
  capacityTariffEurPerKwYear: number

  setRoofAreaM2: (v: number) => void
  setPanelEfficiencyPct: (v: number) => void
  setRoofTiltDeg: (v: number) => void
  setAnnualConsumptionKwh: (v: number) => void
  setPurchasePriceEurPerKwh: (v: number) => void
  setFeedinTariffEurPerKwh: (v: number) => void
  setDigitalMeter: (v: boolean) => void
  setBatteryEnabled: (v: boolean) => void
  setBatteryKwh: (v: number) => void
  setBatteryPresetId: (id: string | null) => void
  applyBatteryPreset: (id: string) => void
  setBatteryMinSocFrac: (v: number) => void
  setBatteryChargeEff: (v: number) => void
  setBatteryDischargeEff: (v: number) => void
  setBatteryMaxPowerKw: (v: number) => void
  setBatteryAnnualDegradationPct: (v: number) => void
  setBatteryWarrantyYears: (v: number) => void
  setLocation: (lat: number, lon: number, label: string) => void
  setFluviusImport: (
    monthly: number[] | null,
    ean: string | null,
    address: string | null,
  ) => void
  setShowActualVersusEstimated: (v: boolean) => void
  setFluviusSettings: (clientId: string, redirectUri: string) => void
  setPvgisManual: (data: ParsedPVGIS | null, fileName?: string | null) => void
  setPvgisPanelAzimuthDeg: (v: number) => void
  setPvgisPeakPowerKw: (v: number) => void
  setPvgisSystemLossPct: (v: number) => void
  setPvgisPvtechChoice: (v: string) => void
  setPvgisSeriesStartYear: (v: number) => void
  setPvgisSeriesEndYear: (v: number) => void
  setPvgisSeriesYearRange: (start: number, end: number) => void
  setPvgisProductionLoaded: (v: boolean) => void
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
  setConsumptionCsvUseMixedYears: (v: boolean) => void
  /** Eén actie: mix aan met twee jaren (voorkomt volgorde-bugs) */
  setConsumptionCsvTwoYearMix: (
    yearPrimary: number,
    yearSecondary: number,
    firstMonthOfSecondary: number,
  ) => void
  setConsumptionCsvYearSecondary: (v: number) => void
  setConsumptionCsvMixedFirstMonthSecondary: (v: number) => void
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
  setCapacityTariffEurPerKwYear: (v: number) => void
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
  consumptionCsvUseMixedYears: false,
  consumptionCsvMixedFirstMonthSecondary: 10,
  consumptionCsvYearSecondary: null as number | null,
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
  batteryPresetId: null,
  batteryMinSocFrac: 0,
  batteryChargeEff: 0.95,
  batteryDischargeEff: 1,
  batteryMaxPowerKw: 25,
  batteryAnnualDegradationPct: 2,
  batteryWarrantyYears: 10,
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
  pvgisPanelAzimuthDeg: 0,
  pvgisPeakPowerKw: 1,
  pvgisSystemLossPct: 14,
  pvgisPvtechChoice: 'crystSi',
  pvgisSeriesStartYear: 2005,
  pvgisSeriesEndYear: 2020,
  pvgisProductionLoaded: false,
  capacityTariffEurPerKwYear: 0,
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
  setBatteryKwh: (batteryKwh) => set({ batteryKwh, batteryPresetId: null }),
  setBatteryPresetId: (batteryPresetId) => set({ batteryPresetId }),
  applyBatteryPreset: (id) => {
    const p = getBatteryPreset(id)
    if (!p) {
      return
    }
    set({
      batteryPresetId: id,
      batteryKwh: p.nominalKwh,
      batteryMinSocFrac: p.minSocFrac,
      batteryChargeEff: p.chargeEfficiency,
      batteryDischargeEff: p.dischargeEfficiency,
      batteryMaxPowerKw: p.maxPowerKw,
      batteryAnnualDegradationPct: p.annualDegradationPct,
      batteryWarrantyYears: p.warrantyYears,
    })
  },
  setBatteryMinSocFrac: (batteryMinSocFrac) =>
    set({ batteryMinSocFrac, batteryPresetId: null }),
  setBatteryChargeEff: (batteryChargeEff) => set({ batteryChargeEff, batteryPresetId: null }),
  setBatteryDischargeEff: (batteryDischargeEff) =>
    set({ batteryDischargeEff, batteryPresetId: null }),
  setBatteryMaxPowerKw: (batteryMaxPowerKw) => set({ batteryMaxPowerKw, batteryPresetId: null }),
  setBatteryAnnualDegradationPct: (batteryAnnualDegradationPct) =>
    set({ batteryAnnualDegradationPct, batteryPresetId: null }),
  setBatteryWarrantyYears: (batteryWarrantyYears) =>
    set({ batteryWarrantyYears, batteryPresetId: null }),
  setLocation: (lat, lon, locationLabel) =>
    set({ lat, lon, locationLabel, pvgisProductionLoaded: false }),
  setFluviusImport: (fluviusMonthlyKwh, fluviusEan, fluviusAddress) =>
    set({ fluviusMonthlyKwh, fluviusEan, fluviusAddress }),
  setShowActualVersusEstimated: (showActualVersusEstimated) => set({ showActualVersusEstimated }),
  setFluviusSettings: (fluviusClientId, fluviusRedirectUri) =>
    set({ fluviusClientId, fluviusRedirectUri }),
  setPvgisManual: (pvgisManual, pvgisManualFileName = null) =>
    set({ pvgisManual, pvgisManualFileName }),
  setPvgisPanelAzimuthDeg: (pvgisPanelAzimuthDeg) => set({ pvgisPanelAzimuthDeg }),
  setPvgisPeakPowerKw: (pvgisPeakPowerKw) => set({ pvgisPeakPowerKw }),
  setPvgisSystemLossPct: (pvgisSystemLossPct) => set({ pvgisSystemLossPct }),
  setPvgisPvtechChoice: (pvgisPvtechChoice) => set({ pvgisPvtechChoice }),
  setPvgisSeriesStartYear: (pvgisSeriesStartYear) => set({ pvgisSeriesStartYear }),
  setPvgisSeriesEndYear: (pvgisSeriesEndYear) => set({ pvgisSeriesEndYear }),
  setPvgisSeriesYearRange: (pvgisSeriesStartYear, pvgisSeriesEndYear) =>
    set({ pvgisSeriesStartYear, pvgisSeriesEndYear }),
  setPvgisProductionLoaded: (pvgisProductionLoaded) => set({ pvgisProductionLoaded }),

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
      consumptionCsvUseMixedYears: false,
      consumptionCsvYearSecondary: null,
      consumptionCsvMixedFirstMonthSecondary: 10,
      annualConsumptionKwh: total > 0 ? total : state.annualConsumptionKwh,
    }))
  },

  setConsumptionCsvYear: (year) =>
    set((state) => {
      if (!state.consumptionCsvDaily || state.consumptionCsvFormat !== 'fluvius-daily') {
        return {}
      }
      const monthly = buildFluviusMonthlyKwh(
        state.consumptionCsvDaily,
        year,
        state.consumptionCsvUseMixedYears,
        state.consumptionCsvYearSecondary,
        state.consumptionCsvMixedFirstMonthSecondary,
      )
      const total = monthly.reduce((a, b) => a + b, 0)
      return {
        consumptionCsvSelectedYear: year,
        consumptionCsvMonthlyKwh: monthly,
        annualConsumptionKwh: total > 0 ? total : state.annualConsumptionKwh,
      }
    }),

  setConsumptionCsvUseMixedYears: (consumptionCsvUseMixedYears) =>
    set((state) => {
      if (!state.consumptionCsvDaily || state.consumptionCsvFormat !== 'fluvius-daily') {
        return { consumptionCsvUseMixedYears }
      }
      if (state.consumptionCsvSelectedYear == null) {
        return { consumptionCsvUseMixedYears }
      }
      if (!consumptionCsvUseMixedYears) {
        const monthly = buildFluviusMonthlyKwh(
          state.consumptionCsvDaily,
          state.consumptionCsvSelectedYear,
          false,
          null,
          state.consumptionCsvMixedFirstMonthSecondary,
        )
        const total = monthly.reduce((a, b) => a + b, 0)
        return {
          consumptionCsvUseMixedYears: false,
          consumptionCsvYearSecondary: null,
          consumptionCsvMonthlyKwh: monthly,
          annualConsumptionKwh: total > 0 ? total : state.annualConsumptionKwh,
        }
      }
      if (state.consumptionCsvYearSecondary == null) {
        return { consumptionCsvUseMixedYears: true }
      }
      const monthly = buildFluviusMonthlyKwh(
        state.consumptionCsvDaily,
        state.consumptionCsvSelectedYear,
        true,
        state.consumptionCsvYearSecondary,
        state.consumptionCsvMixedFirstMonthSecondary,
      )
      const total = monthly.reduce((a, b) => a + b, 0)
      return {
        consumptionCsvUseMixedYears: true,
        consumptionCsvMonthlyKwh: monthly,
        annualConsumptionKwh: total > 0 ? total : state.annualConsumptionKwh,
      }
    }),

  setConsumptionCsvTwoYearMix: (yearPrimary, yearSecondary, firstMonthOfSecondary) =>
    set((state) => {
      if (!state.consumptionCsvDaily || state.consumptionCsvFormat !== 'fluvius-daily') {
        return {}
      }
      if (yearPrimary === yearSecondary) {
        return {}
      }
      const monthly = buildFluviusMonthlyKwh(
        state.consumptionCsvDaily,
        yearPrimary,
        true,
        yearSecondary,
        firstMonthOfSecondary,
      )
      const total = monthly.reduce((a, b) => a + b, 0)
      return {
        consumptionCsvSelectedYear: yearPrimary,
        consumptionCsvUseMixedYears: true,
        consumptionCsvYearSecondary: yearSecondary,
        consumptionCsvMixedFirstMonthSecondary: firstMonthOfSecondary,
        consumptionCsvMonthlyKwh: monthly,
        annualConsumptionKwh: total > 0 ? total : state.annualConsumptionKwh,
      }
    }),

  setConsumptionCsvYearSecondary: (consumptionCsvYearSecondary) =>
    set((state) => {
      if (!state.consumptionCsvDaily || state.consumptionCsvFormat !== 'fluvius-daily') {
        return { consumptionCsvYearSecondary }
      }
      if (state.consumptionCsvSelectedYear == null) {
        return { consumptionCsvYearSecondary }
      }
      const monthly = buildFluviusMonthlyKwh(
        state.consumptionCsvDaily,
        state.consumptionCsvSelectedYear,
        state.consumptionCsvUseMixedYears,
        consumptionCsvYearSecondary,
        state.consumptionCsvMixedFirstMonthSecondary,
      )
      const total = monthly.reduce((a, b) => a + b, 0)
      return {
        consumptionCsvYearSecondary,
        consumptionCsvMonthlyKwh: monthly,
        annualConsumptionKwh: total > 0 ? total : state.annualConsumptionKwh,
      }
    }),

  setConsumptionCsvMixedFirstMonthSecondary: (consumptionCsvMixedFirstMonthSecondary) =>
    set((state) => {
      if (!state.consumptionCsvDaily || state.consumptionCsvFormat !== 'fluvius-daily') {
        return { consumptionCsvMixedFirstMonthSecondary }
      }
      if (state.consumptionCsvSelectedYear == null) {
        return { consumptionCsvMixedFirstMonthSecondary }
      }
      const monthly = buildFluviusMonthlyKwh(
        state.consumptionCsvDaily,
        state.consumptionCsvSelectedYear,
        state.consumptionCsvUseMixedYears,
        state.consumptionCsvYearSecondary,
        consumptionCsvMixedFirstMonthSecondary,
      )
      const total = monthly.reduce((a, b) => a + b, 0)
      return {
        consumptionCsvMixedFirstMonthSecondary,
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

  setCapacityTariffEurPerKwYear: (capacityTariffEurPerKwYear) =>
    set({ capacityTariffEurPerKwYear }),

  resetLocation: () =>
    set({
      lat: DEFAULT_LAT,
      lon: DEFAULT_LON,
      locationLabel: DEFAULT_LOCATION_LABEL,
      pvgisProductionLoaded: false,
    }),
}))
