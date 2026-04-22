import { useMemo, useCallback, useState } from 'react'
import { useCalculatorStore } from '../store/calculatorStore'
import { usePVGIS } from '../hooks/usePVGIS'
import { SliderInput } from './SliderInput'
import { MetricCard } from './MetricCard'
import { MonthlyChart } from './MonthlyChart'
import { DayHourlyChart } from './DayHourlyChart'
import { SavingsChart } from './SavingsChart'
import { PvgisDataControls } from './PvgisDataControls'
import { SolarSimTourDialog } from './SolarSimTourDialog'
import { PVGISManualInput } from './PVGISManualInput'
import { ConsumptionCsvUpload } from './ConsumptionCsvUpload'
import { PeakPowerCsvUpload } from './PeakPowerCsvUpload'
import {
  computeMonthlyEnergyRows,
  computeSystemKwp,
  evaluateWarnings,
  monthlyProductionKwh,
  rowsToAnnualTotals,
} from '../utils/solarCalc'
import { BATTERY_PRESETS } from '../data/batteryPresets'
import {
  computeMonthlyEnergyRowsFromHourlyProfile,
  computeMonthlyPeakImportKwFromHourlyProfile,
} from '../utils/hourlySelfConsumption'
import { yearByMonthForTwoYearSplit } from '../utils/csvConsumption'
import { monthlyPeakKwForYear } from '../utils/peakPowerCsv'
import { monthlyConsumptionKwh, estimatedEvenMonthly } from '../utils/consumptionProfile'
import {
  breakevenYear,
  cumulativeSavingsOverYears,
  fullFinancialSnapshot,
  npv25YearDefault,
  peakCapacitySavingsFromPeakDelta,
  totalSystemCostEur,
  yearlySavingsSeries,
} from '../utils/financialCalc'
import { formatEur, formatNumber } from '../utils/format'
import { encodeCalculatorToSearchParams } from '../utils/urlState'
import { downloadSolarSimPdf } from '../utils/pdfReport'
import type { ParsedPVGIS } from '../types/pvgis'

function fallbackPvgis(): ParsedPVGIS {
  const monthlyEmKwhPerKwp = Array(12).fill(90 / 12) as number[]
  return { monthlyEmKwhPerKwp, annualKwhPerKwp: 900 }
}

export function Calculator({ dark }: { dark: boolean }) {
  const s = useCalculatorStore()
  const pvgisQuery = usePVGIS(
    {
      lat: s.lat,
      lon: s.lon,
      tiltDeg: s.roofTiltDeg,
      aspectDeg: s.pvgisPanelAzimuthDeg,
      systemLossPct: s.pvgisSystemLossPct,
      pvtech: s.pvgisPvtechChoice,
    },
    {
      fetchEnabled: s.pvgisManual === null && s.pvgisProductionLoaded,
    },
  )

  const parsed: ParsedPVGIS = s.pvgisManual ?? pvgisQuery.data ?? fallbackPvgis()
  const systemKwp = computeSystemKwp(s.roofAreaM2, s.panelEfficiencyPct)

  const selfRate = s.batteryEnabled ? 0.9 : 0.7

  const productionMonthly = useMemo(
    () => monthlyProductionKwh(parsed.monthlyEmKwhPerKwp, systemKwp),
    [parsed.monthlyEmKwhPerKwp, systemKwp],
  )

  const consumptionProfile = useMemo(
    () =>
      monthlyConsumptionKwh(
        s.annualConsumptionKwh,
        s.fluviusMonthlyKwh,
        s.consumptionCsvMonthlyKwh,
      ),
    [s.annualConsumptionKwh, s.fluviusMonthlyKwh, s.consumptionCsvMonthlyKwh],
  )

  const consumptionProfileSource = s.consumptionCsvMonthlyKwh
    ? 'csv'
    : s.fluviusMonthlyKwh
      ? 'fluvius'
      : null
  const hasCustomConsumption = consumptionProfileSource !== null

  /** Som van het ruwe maandprofiel uit import (vóór schaling door de schuif). */
  const importReferenceAnnualKwh = useMemo(() => {
    if (s.consumptionCsvMonthlyKwh?.length === 12) {
      return s.consumptionCsvMonthlyKwh.reduce((a, b) => a + b, 0)
    }
    if (s.fluviusMonthlyKwh?.length === 12) {
      return s.fluviusMonthlyKwh.reduce((a, b) => a + b, 0)
    }
    return null
  }, [s.consumptionCsvMonthlyKwh, s.fluviusMonthlyKwh])

  const consumptionEven = useMemo(
    () => estimatedEvenMonthly(s.annualConsumptionKwh),
    [s.annualConsumptionKwh],
  )

  const batteryParams = useMemo(
    () => ({
      minSocFrac: s.batteryMinSocFrac,
      chargeEfficiency: s.batteryChargeEff,
      dischargeEfficiency: s.batteryDischargeEff,
      maxPowerKw: s.batteryMaxPowerKw,
    }),
    [
      s.batteryMinSocFrac,
      s.batteryChargeEff,
      s.batteryDischargeEff,
      s.batteryMaxPowerKw,
    ],
  )

  const batteryUsableKwh = useMemo(
    () => Math.max(0, s.batteryKwh * (1 - s.batteryMinSocFrac)),
    [s.batteryKwh, s.batteryMinSocFrac],
  )

  const batteryRoundtripEff = useMemo(
    () => s.batteryChargeEff * s.batteryDischargeEff,
    [s.batteryChargeEff, s.batteryDischargeEff],
  )

  const consumptionYearByMonth = useMemo((): number[] | null => {
    if (
      !s.consumptionCsvUseMixedYears ||
      s.consumptionCsvYearSecondary == null ||
      s.consumptionCsvSelectedYear == null
    ) {
      return null
    }
    return yearByMonthForTwoYearSplit(
      s.consumptionCsvSelectedYear,
      s.consumptionCsvYearSecondary,
      s.consumptionCsvMixedFirstMonthSecondary,
    )
  }, [
    s.consumptionCsvUseMixedYears,
    s.consumptionCsvYearSecondary,
    s.consumptionCsvSelectedYear,
    s.consumptionCsvMixedFirstMonthSecondary,
  ])

  const consumptionPeakYearMatches = useMemo(() => {
    if (s.consumptionCsvSelectedYear == null || s.peakPowerSelectedYear == null) {
      return false
    }
    if (s.consumptionCsvUseMixedYears && s.consumptionCsvYearSecondary != null) {
      return (
        s.peakPowerSelectedYear === s.consumptionCsvSelectedYear ||
        s.peakPowerSelectedYear === s.consumptionCsvYearSecondary
      )
    }
    return s.consumptionCsvSelectedYear === s.peakPowerSelectedYear
  }, [
    s.consumptionCsvSelectedYear,
    s.consumptionCsvUseMixedYears,
    s.consumptionCsvYearSecondary,
    s.peakPowerSelectedYear,
  ])

  const { rows, hourlySelfOverlapModel, selfConsumedNoBatteryMonthly } = useMemo(() => {
    const range = s.consumptionCsvDateRange
    const yr = s.consumptionCsvSelectedYear
    const dh = s.consumptionCsvDailyHourly
    if (
      dh &&
      range &&
      yr != null &&
      s.consumptionCsvFluviusGranularity === 'kwartier'
    ) {
      const hourlyBase = {
        monthlyProductionKwh: productionMonthly,
        monthlyConsumptionKwh: consumptionProfile,
        dailyHourly: dh,
        year: yr,
        yearByMonth: consumptionYearByMonth,
        fileMin: range.min,
        fileMax: range.max,
        latDeg: s.lat,
        pvgisTmyGhiDailyHourly: s.pvgisManual?.tmyGhiDailyHourly ?? null,
        pvgisTmyRange: s.pvgisManual?.tmyRange ?? null,
        pvgisTmyDataYear: s.pvgisManual?.tmyDataYear ?? null,
        pvgisTmyMultiYear: s.pvgisManual?.tmyMultiYear ?? false,
      } as const

      const fromHourly = computeMonthlyEnergyRowsFromHourlyProfile({
        ...hourlyBase,
        selfConsumptionRate: selfRate,
        batteryEnabled: s.batteryEnabled,
        batteryKwh: s.batteryKwh,
        batteryParams: s.batteryEnabled ? batteryParams : undefined,
      })
      if (fromHourly) {
        let noBatt: number[] | null = null
        if (s.batteryEnabled) {
          const withoutBatt = computeMonthlyEnergyRowsFromHourlyProfile({
            ...hourlyBase,
            selfConsumptionRate: 0.7,
            batteryEnabled: false,
            batteryParams: undefined,
          })
          if (withoutBatt) {
            noBatt = withoutBatt.map((r) => r.selfConsumedKwh)
          }
        }
        return { rows: fromHourly, hourlySelfOverlapModel: true as const, selfConsumedNoBatteryMonthly: noBatt }
      }
    }
    const simpleRows = computeMonthlyEnergyRows({
      monthlyProductionKwh: productionMonthly,
      monthlyConsumptionKwh: consumptionProfile,
      selfConsumptionRate: selfRate,
    })
    const noBatt = s.batteryEnabled
      ? computeMonthlyEnergyRows({
          monthlyProductionKwh: productionMonthly,
          monthlyConsumptionKwh: consumptionProfile,
          selfConsumptionRate: 0.7,
        }).map((r) => r.selfConsumedKwh)
      : null
    return {
      rows: simpleRows,
      hourlySelfOverlapModel: false as const,
      selfConsumedNoBatteryMonthly: noBatt,
    }
  }, [
    productionMonthly,
    consumptionProfile,
    selfRate,
    s.consumptionCsvDailyHourly,
    s.consumptionCsvDateRange,
    s.consumptionCsvSelectedYear,
    s.consumptionCsvFluviusGranularity,
    s.lat,
    s.pvgisManual,
    s.batteryEnabled,
    s.batteryKwh,
    batteryParams,
    consumptionYearByMonth,
  ])

  const peakCapacitySavingsEurAnnual = useMemo(() => {
    if (
      s.capacityTariffEurPerKwYear <= 0 ||
      !s.peakPowerKwByMonth ||
      s.peakPowerSelectedYear == null ||
      !hourlySelfOverlapModel ||
      s.consumptionCsvFluviusGranularity !== 'kwartier' ||
      !s.consumptionCsvDailyHourly ||
      !s.consumptionCsvDateRange ||
      s.consumptionCsvSelectedYear == null ||
      !consumptionPeakYearMatches
    ) {
      return 0
    }
    const monthlySim = computeMonthlyPeakImportKwFromHourlyProfile({
      monthlyProductionKwh: productionMonthly,
      monthlyConsumptionKwh: consumptionProfile,
      dailyHourly: s.consumptionCsvDailyHourly,
      year: s.consumptionCsvSelectedYear,
      yearByMonth: consumptionYearByMonth,
      fileMin: s.consumptionCsvDateRange.min,
      fileMax: s.consumptionCsvDateRange.max,
      latDeg: s.lat,
      pvgisTmyGhiDailyHourly: s.pvgisManual?.tmyGhiDailyHourly ?? null,
      pvgisTmyRange: s.pvgisManual?.tmyRange ?? null,
      pvgisTmyDataYear: s.pvgisManual?.tmyDataYear ?? null,
      pvgisTmyMultiYear: s.pvgisManual?.tmyMultiYear ?? false,
      batteryEnabled: s.batteryEnabled,
      batteryKwh: s.batteryKwh,
      batteryParams: s.batteryEnabled ? batteryParams : undefined,
    })
    if (!monthlySim || monthlySim.length !== 12) {
      return 0
    }
    const baselineArr = monthlyPeakKwForYear(s.peakPowerKwByMonth, s.peakPowerSelectedYear)
    const defined = baselineArr.filter((x): x is number => x != null && Number.isFinite(x))
    if (defined.length === 0) {
      return 0
    }
    const maxBase = Math.max(...defined)
    const maxSim = Math.max(...monthlySim)
    return peakCapacitySavingsFromPeakDelta({
      capacityTariffEurPerKwYear: s.capacityTariffEurPerKwYear,
      maxBaselinePeakKw: maxBase,
      maxSimulatedPeakKw: maxSim,
    })
  }, [
    s.capacityTariffEurPerKwYear,
    s.peakPowerKwByMonth,
    s.peakPowerSelectedYear,
    s.consumptionCsvFluviusGranularity,
    s.consumptionCsvDailyHourly,
    s.consumptionCsvDateRange,
    s.consumptionCsvSelectedYear,
    hourlySelfOverlapModel,
    productionMonthly,
    consumptionProfile,
    s.lat,
    s.pvgisManual,
    s.batteryEnabled,
    s.batteryKwh,
    batteryParams,
    consumptionYearByMonth,
    consumptionPeakYearMatches,
  ])

  const snap = useMemo(
    () =>
      fullFinancialSnapshot({
        roofAreaM2: s.roofAreaM2,
        panelEfficiencyPct: s.panelEfficiencyPct,
        batteryEnabled: s.batteryEnabled,
        batteryKwh: s.batteryKwh,
        rows,
        digitalMeter: s.digitalMeter,
        purchasePriceEurPerKwh: s.purchasePriceEurPerKwh,
        feedinTariffEurPerKwh: s.feedinTariffEurPerKwh,
        peakCapacitySavingsEurAnnual,
      }),
    [s, rows, peakCapacitySavingsEurAnnual],
  )

  const { selfConsumedY, exportY } = rowsToAnnualTotals(rows)

  const yearlyFlows = useMemo(
    () =>
      yearlySavingsSeries({
        digitalMeter: s.digitalMeter,
        year0SelfConsumedKwh: selfConsumedY,
        year0ExportKwh: exportY,
        purchasePriceEurPerKwh: s.purchasePriceEurPerKwh,
        feedinTariffEurPerKwh: s.feedinTariffEurPerKwh,
        systemKwp: snap.systemKwp,
        peakCapacitySavingsEurAnnual,
        years: 25,
        discountRateAnnual: 0.03,
        panelDegradationAnnual: 0.005,
        electricityInflationAnnual: 0.02,
      }),
    [
      s.digitalMeter,
      selfConsumedY,
      exportY,
      s.purchasePriceEurPerKwh,
      s.feedinTariffEurPerKwh,
      snap.systemKwp,
      peakCapacitySavingsEurAnnual,
    ],
  )

  const cumulative = useMemo(() => cumulativeSavingsOverYears(yearlyFlows), [yearlyFlows])

  const costTotal = useMemo(
    () =>
      totalSystemCostEur({
        systemKwp: snap.systemKwp,
        batteryEnabled: s.batteryEnabled,
        batteryKwh: s.batteryKwh,
      }),
    [snap.systemKwp, s.batteryEnabled, s.batteryKwh],
  )

  const beYear = useMemo(() => breakevenYear(yearlyFlows, costTotal), [yearlyFlows, costTotal])

  const npv = useMemo(
    () =>
      npv25YearDefault({
        digitalMeter: s.digitalMeter,
        year0SelfConsumedKwh: selfConsumedY,
        year0ExportKwh: exportY,
        purchasePriceEurPerKwh: s.purchasePriceEurPerKwh,
        feedinTariffEurPerKwh: s.feedinTariffEurPerKwh,
        systemKwp: snap.systemKwp,
        peakCapacitySavingsEurAnnual,
        years: 25,
        discountRateAnnual: 0.03,
        panelDegradationAnnual: 0.005,
        electricityInflationAnnual: 0.02,
      }),
    [
      s.digitalMeter,
      selfConsumedY,
      exportY,
      s.purchasePriceEurPerKwh,
      s.feedinTariffEurPerKwh,
      snap.systemKwp,
      peakCapacitySavingsEurAnnual,
    ],
  )

  const warnings = useMemo(() => {
    const manual = s.pvgisManual
    const slopeFromFile = manual?.inputsMeta?.slopeDeg
    return evaluateWarnings({
      roofTiltDeg: s.roofTiltDeg,
      roofTiltDegOverride: manual ? slopeFromFile : undefined,
      skipTiltWarnings: Boolean(manual) && slopeFromFile === undefined,
      digitalMeter: s.digitalMeter,
      annualProductionKwh: snap.annualProductionKwh,
      annualConsumptionKwh: s.annualConsumptionKwh,
      annualExportKwh: exportY,
      roofAreaM2: s.roofAreaM2,
      panelEfficiencyPct: s.panelEfficiencyPct,
      annualKwhPerKwp: parsed.annualKwhPerKwp,
    })
  }, [s, snap.annualProductionKwh, exportY, parsed.annualKwhPerKwp])

  const share = useCallback(() => {
    const q = encodeCalculatorToSearchParams(useCalculatorStore.getState())
    const url = `${window.location.origin}${window.location.pathname}?${q}`
    void navigator.clipboard.writeText(url).catch(() => {
      /* */
    })
    alert('Link gekopieerd naar klembord.')
  }, [])

  const pdf = useCallback(() => {
    downloadSolarSimPdf({
      title: 'SolarSim Belgium — rapport',
      locationLabel: s.locationLabel,
      systemKwp: snap.systemKwp,
      annualProductionKwh: snap.annualProductionKwh,
      annualSavingsEur: snap.annualSavingsEur,
      paybackYears: snap.simplePaybackYears,
      npv25Eur: npv,
      totalCostEur: costTotal,
    })
  }, [s.locationLabel, snap, npv, costTotal])

  const paybackLabel =
    Number.isFinite(snap.simplePaybackYears) && snap.simplePaybackYears < 1e6
      ? `${formatNumber(snap.simplePaybackYears, 1, 1)} jaar`
      : '—'

  const [tourOpen, setTourOpen] = useState(false)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            SolarSim Belgium
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Zonnepanelen ROI — PVGIS + eenvoudig verbruiks- en kostenmodel (Vlaanderen)
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={share}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Link delen
          </button>
          <button
            type="button"
            onClick={pdf}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400"
          >
            PDF-rapport
          </button>
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Rondleiding
          </button>
        </div>
      </header>

      <SolarSimTourDialog open={tourOpen} onClose={() => setTourOpen(false)} dark={dark} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <PvgisDataControls />
          <PVGISManualInput />
          <ConsumptionCsvUpload />
          <PeakPowerCsvUpload dark={dark} />

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Installatie & verbruik
            </h2>
            <SliderInput
              id="roof"
              label="Dakoppervlak"
              min={5}
              max={100}
              step={1}
              value={s.roofAreaM2}
              onChange={s.setRoofAreaM2}
              suffix="m²"
            />
            <SliderInput
              id="eff"
              label="Paneelrendement"
              min={16}
              max={23}
              step={0.5}
              value={s.panelEfficiencyPct}
              onChange={s.setPanelEfficiencyPct}
              suffix="%"
            />
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium">Vermogen</span>
                <span
                  className="inline-flex h-4 w-4 shrink-0 cursor-help select-none items-center justify-center self-center rounded-full border border-slate-400 text-[0.6rem] font-serif font-bold leading-none text-slate-600 dark:border-slate-500 dark:text-slate-300"
                  title="Dakhelling (panelen) voor de productiecurve: zie sectie PVGIS hierboven. Vermogen in kWp volgt uit dak en paneelrendement."
                  role="img"
                  aria-label="Dakhelling (panelen) voor de productiecurve: zie sectie PVGIS hierboven. Vermogen in kWp volgt uit dak en paneelrendement."
                >
                  i
                </span>
                <span className="text-slate-500">:</span>
                <span className="tabular-nums text-slate-800 dark:text-slate-100">
                  {formatNumber(systemKwp, 2, 2)} kWp
                </span>
              </div>
            </div>
            <SliderInput
              id="use"
              label="Jaarverbruik elektriciteit"
              min={500}
              max={15000}
              step={100}
              value={s.annualConsumptionKwh}
              onChange={s.setAnnualConsumptionKwh}
              suffix="kWh"
              labelInfo={
                importReferenceAnnualKwh != null
                  ? 'De som van je maandprofiel wordt gelijk gemaakt aan deze waarde (profiel blijft evenredig).'
                  : undefined
              }
            />
            {importReferenceAnnualKwh != null && importReferenceAnnualKwh > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-amber-50/90 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-amber-950/40 dark:text-slate-200">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="font-medium">Bron (import): </span>
                    <span className="tabular-nums">{formatNumber(importReferenceAnnualKwh, 0, 0)}</span>{' '}
                    kWh/jaar
                    <span className="text-slate-500 dark:text-slate-400">
                      {consumptionProfileSource === 'csv'
                        ? s.consumptionCsvFormat === 'fluvius-daily' && s.consumptionCsvSelectedYear
                          ? s.consumptionCsvUseMixedYears && s.consumptionCsvYearSecondary != null
                            ? ` — CSV (${s.consumptionCsvSelectedYear} + ${s.consumptionCsvYearSecondary})`
                            : ` — CSV (${s.consumptionCsvSelectedYear})`
                          : s.consumptionCsvFormat === 'quarterly'
                            ? ' — CSV (kwartalen)'
                            : ' — CSV'
                        : ' — import'}
                    </span>
                  </span>
                  <span>
                    <span className="font-medium">Model (schuif): </span>
                    <span className="tabular-nums">{formatNumber(s.annualConsumptionKwh, 0, 0)}</span> kWh/jaar
                  </span>
                </div>
                {Math.abs(s.annualConsumptionKwh - importReferenceAnnualKwh) > 1 ? (
                  <p className="mt-1 text-amber-900/90 dark:text-amber-200/95">
                    Verschil:{' '}
                    <span className="font-medium tabular-nums">
                      {s.annualConsumptionKwh - importReferenceAnnualKwh > 0 ? '+' : ''}
                      {formatNumber(s.annualConsumptionKwh - importReferenceAnnualKwh, 0, 0)} kWh
                    </span>{' '}
                    — het maandprofiel wordt proportioneel mee geschaald.
                  </p>
                ) : (
                  <p className="mt-1 text-emerald-800 dark:text-emerald-300/95">
                    Gelijk aan de import-som; schuif om een ander totaal te simuleren.
                  </p>
                )}
              </div>
            ) : null}
            {hourlySelfOverlapModel ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100/95">
                <span className="font-medium">Zelfverbruik: </span>
                geschat met je <span className="font-semibold">uurlijke verbruiksprofiel</span>{' '}
                (Fluvius-kwartierdata) en een zonnegolf per maand voor je locatie — dichter bij de
                werkelijkheid dan alleen een vast percentage op maandbasis.
                {s.batteryEnabled && s.batteryKwh > 0 ? (
                  <>
                    {' '}
                    Met accu ({formatNumber(s.batteryKwh, 0, 1)} kWh nominaal, ≈{' '}
                    {formatNumber(batteryUsableKwh, 0, 1)} kWh bruikbaar) wordt per uur een eenvoudige
                    laad-/ontlaad-simulatie gebruikt i.p.v. een vast percentage.
                  </>
                ) : null}
              </div>
            ) : null}

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Netteller
              </legend>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => s.setDigitalMeter(true)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    s.digitalMeter
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Digitaal (prosument)
                </button>
                <button
                  type="button"
                  onClick={() => s.setDigitalMeter(false)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    !s.digitalMeter
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Analoog (historisch)
                </button>
              </div>
              {s.digitalMeter ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Extra kost: ca. €95/kWp/jaar prosumententarief (capaciteitstarief) op piekvermogen.
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Model: alle zonne-energie gewaardeerd tegen uw aankoopprijs (netbalans).
                </p>
              )}
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Thuisbatterij
              </legend>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={s.batteryEnabled}
                  onChange={(e) => s.setBatteryEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-amber-500"
                />
                Batterij meerekenen (zelfverbruik 70% → 90% zonder uurprofiel)
              </label>
              {s.batteryEnabled ? (
                <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                  <div className="space-y-1">
                    <label
                      htmlFor="battery-preset"
                      className="text-sm font-medium text-slate-700 dark:text-slate-200"
                    >
                      Gangbare modellen (Vlaanderen / Benelux, richtwaarden)
                    </label>
                    <select
                      id="battery-preset"
                      value={s.batteryPresetId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        if (v) {
                          s.applyBatteryPreset(v)
                        } else {
                          s.setBatteryPresetId(null)
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="">Handmatig — sliders hieronder</option>
                      {BATTERY_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Fabrikantgegevens wijzigen; pas de schuifregelaars aan na een keuze. Typische
                      merken op de markt: Tesla Powerwall, BYD Battery-Box, Huawei LUNA, LG RESU,
                      SolarEdge, Pylontech, Enphase (o.a. via installateurs).
                    </p>
                  </div>
                  <SliderInput
                    id="bat"
                    label="Nominale capaciteit"
                    min={2}
                    max={30}
                    step={0.5}
                    value={s.batteryKwh}
                    onChange={s.setBatteryKwh}
                    suffix="kWh"
                  />
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Bruikbaar venster (na ondergrens SOC):{' '}
                    <span className="font-medium tabular-nums">
                      {formatNumber(batteryUsableKwh, 1, 2)} kWh
                    </span>{' '}
                    — rondtrip rendement (laad × ontlaad):{' '}
                    <span className="font-medium tabular-nums">
                      {formatNumber(batteryRoundtripEff * 100, 1, 1)}%
                    </span>
                  </p>
                  <SliderInput
                    id="bms"
                    label="Minimum SOC (ondergrens)"
                    min={0}
                    max={20}
                    step={0.5}
                    value={s.batteryMinSocFrac * 100}
                    onChange={(v) => s.setBatteryMinSocFrac(v / 100)}
                    suffix="%"
                  />
                  <SliderInput
                    id="bce"
                    label="Laadrendement"
                    min={88}
                    max={99}
                    step={0.5}
                    value={s.batteryChargeEff * 100}
                    onChange={(v) => s.setBatteryChargeEff(v / 100)}
                    suffix="%"
                  />
                  <SliderInput
                    id="bde"
                    label="Ontlaadrendement"
                    min={88}
                    max={100}
                    step={0.5}
                    value={s.batteryDischargeEff * 100}
                    onChange={(v) => s.setBatteryDischargeEff(v / 100)}
                    suffix="%"
                  />
                  <SliderInput
                    id="bmp"
                    label="Max. laad/ontlaad vermogen"
                    min={1}
                    max={20}
                    step={0.5}
                    value={s.batteryMaxPowerKw}
                    onChange={s.setBatteryMaxPowerKw}
                    suffix="kW"
                    hint="Per uur: max. kWh ≈ kW × 1 h (Powerwall 3 kan hoger)."
                  />
                  <SliderInput
                    id="bad"
                    label="Geschatte degradatie (capaciteit)"
                    min={0}
                    max={3.5}
                    step={0.1}
                    value={s.batteryAnnualDegradationPct}
                    onChange={s.setBatteryAnnualDegradationPct}
                    suffix="%/jaar"
                    hint="Alleen informatief; jaarlijkse simulatie gebruikt jaar 0."
                  />
                  <SliderInput
                    id="bwy"
                    label="Garantie / levensduur (richtwaarde)"
                    min={5}
                    max={20}
                    step={1}
                    value={s.batteryWarrantyYears}
                    onChange={s.setBatteryWarrantyYears}
                    suffix="jaar"
                  />
                </div>
              ) : null}
            </fieldset>
          </section>
        </div>

        <div className="space-y-6">
          {!s.pvgisManual && !s.pvgisProductionLoaded && !pvgisQuery.isFetching ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
              <span className="font-medium">Voorbeeldcurve: </span>
              tot je op <span className="font-medium">Laad opbrengst in app</span> klikt, gebruikt
              de simulatie 900 kWh/kWp. Upload een PVGIS-bestand in de vorige sectie, of laad
              via de knop.
            </div>
          ) : null}
          {!s.pvgisManual && s.pvgisProductionLoaded && pvgisQuery.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
              PVGIS kon niet worden geladen (
              {pvgisQuery.error instanceof Error ? pvgisQuery.error.message : 'fout'}). Er wordt een
              voorbeeldcurve gebruikt — probeer later opnieuw of gebruik handmatige PVGIS-JSON hierboven.
            </div>
          ) : !s.pvgisManual && s.pvgisProductionLoaded && pvgisQuery.isLoading ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              PVGIS-gegevens laden…
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard
              title="Vermogen"
              value={`${formatNumber(snap.systemKwp, 2, 2)} kWp`}
            />
            <MetricCard
              title="Jaarproductie"
              value={`${formatNumber(snap.annualProductionKwh, 0, 0)} kWh`}
            />
            <MetricCard title="Jaarlijkse besparing" value={formatEur(snap.annualSavingsEur)} />
            <MetricCard title="Eenvoudige terugverdientijd" value={paybackLabel} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
            <span className="font-medium text-slate-800 dark:text-slate-100">NPV 25 jaar (3%): </span>
            {formatEur(npv)} — investering{' '}
            <span className="tabular-nums">{formatEur(costTotal)}</span>
          </div>

          {s.capacityTariffEurPerKwYear > 0 && s.peakPowerKwByMonth && peakCapacitySavingsEurAnnual > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white/90 p-3 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              <span className="font-medium text-slate-800 dark:text-slate-100">
                Besparing op capaciteitstarief:{' '}
              </span>
              <span className="tabular-nums font-medium text-emerald-800 dark:text-emerald-200">
                {formatEur(peakCapacitySavingsEurAnnual)}
              </span>
              <span> /jaar</span>
            </div>
          ) : null}

          {warnings.exportHeavyDigital ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              Met digitale meter levert injecteren van meer dan ~45% van uw productie weinig op. Overweeg
              een batterij of een kleinere installatie.
            </div>
          ) : null}
          {warnings.oversizeRecommendedSqm !== null ? (
            <div className="rounded-xl border border-sky-300 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100">
              Uw systeem is groot t.o.v. verbruik. Richting rond{' '}
              <span className="font-semibold">
                {formatNumber(warnings.oversizeRecommendedSqm, 0, 1)} m²
              </span>{' '}
              dakoppervlak kan beter zijn voor ROI (richtwaarde).
            </div>
          ) : null}
          {(warnings.tiltSuboptimalLow || warnings.tiltSuboptimalHigh) && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100">
              Helling buiten 15°–55° geeft meestal lagere opbrengst — check montage.
            </div>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Maand- en daggrafiek
              </h2>
              {hasCustomConsumption ? (
                <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={s.showActualVersusEstimated}
                    onChange={(e) => s.setShowActualVersusEstimated(e.target.checked)}
                    className="h-4 w-4 rounded accent-amber-500"
                  />
                  {consumptionProfileSource === 'csv'
                    ? 'Vergelijk CSV-profiel met gelijk verdeeld verbruik'
                    : 'Vergelijk Fluvius-profiel met gelijk verdeeld verbruik'}
                </label>
              ) : null}
            </div>
            <div className="flex flex-col gap-10">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Maandgrafiek
                </h3>
                <MonthlyChart
                  productionMonthly={productionMonthly}
                  selfConsumedMonthly={rows.map((r) => r.selfConsumedKwh)}
                  selfConsumedNoBatteryMonthly={selfConsumedNoBatteryMonthly}
                  consumptionEven={consumptionEven}
                  consumptionProfile={consumptionProfile}
                  hasCustomConsumption={hasCustomConsumption}
                  consumptionProfileSource={consumptionProfileSource}
                  showActualVersusEstimated={s.showActualVersusEstimated}
                  dark={dark}
                />
              </div>
              <div className="border-t border-slate-200/90 pt-8 dark:border-slate-600/80">
                <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Daggrafiek
                </h3>
                <DayHourlyChart
                  productionMonthly={productionMonthly}
                  consumptionProfile={consumptionProfile}
                  consumptionEven={consumptionEven}
                  hasCustomConsumption={hasCustomConsumption}
                  consumptionProfileSource={consumptionProfileSource}
                  showActualVersusEstimated={s.showActualVersusEstimated}
                  parsed={parsed}
                  latDeg={s.lat}
                  roofTiltDeg={s.roofTiltDeg}
                  consumptionCsvDailyHourly={s.consumptionCsvDailyHourly}
                  consumptionCsvDailyDag={s.consumptionCsvDailyDag}
                  consumptionCsvDailyNacht={s.consumptionCsvDailyNacht}
                  consumptionCsvDateRange={s.consumptionCsvDateRange}
                  consumptionCsvSelectedYear={s.consumptionCsvSelectedYear}
                  consumptionCsvYearByMonth={consumptionYearByMonth}
                  consumptionCsvFluviusGranularity={s.consumptionCsvFluviusGranularity}
                  dark={dark}
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50">
              Cumulatieve besparingen (25 jaar)
            </h2>
            <div className="mb-6 space-y-4">
              <SliderInput
                id="buy"
                label="Aankoopprijs netstroom"
                min={0.15}
                max={0.6}
                step={0.01}
                value={s.purchasePriceEurPerKwh}
                onChange={s.setPurchasePriceEurPerKwh}
                suffix="€/kWh"
              />
              <div>
                <SliderInput
                  id="feed"
                  label="Injectietarief (digitale meter)"
                  min={-0.2}
                  max={0.15}
                  step={0.005}
                  value={s.feedinTariffEurPerKwh}
                  onChange={s.setFeedinTariffEurPerKwh}
                  suffix="€/kWh"
                />
                <p
                  className="mt-1 text-xs text-slate-500 dark:text-slate-400"
                  title="Negatief injectietarief: elke geëxporteerde kWh vermindert de besparing met |tarief|."
                >
                  Tip: richtwaarde Fluvius prosument o.a. ≈ €0,04/kWh. Negatief: what-if
                  (export telt straf in de besparing). Met analoge teller: model zoals
                  aankoopprijs/netbalans.
                </p>
              </div>
            </div>
            <SavingsChart
              cumulativeSavings={cumulative}
              totalSystemCost={costTotal}
              breakevenYear={beYear}
              dark={dark}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
