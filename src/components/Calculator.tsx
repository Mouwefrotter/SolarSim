import { useMemo, useCallback } from 'react'
import { useCalculatorStore } from '../store/calculatorStore'
import { usePVGIS } from '../hooks/usePVGIS'
import { SliderInput } from './SliderInput'
import { MetricCard } from './MetricCard'
import { MonthlyChart } from './MonthlyChart'
import { DayHourlyChart } from './DayHourlyChart'
import { SavingsChart } from './SavingsChart'
import { LocationSearch } from './LocationSearch'
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
import { computeMonthlyEnergyRowsFromHourlyProfile } from '../utils/hourlySelfConsumption'
import { monthlyConsumptionKwh, estimatedEvenMonthly } from '../utils/consumptionProfile'
import {
  breakevenYear,
  cumulativeSavingsOverYears,
  fullFinancialSnapshot,
  npv25YearDefault,
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
  const pvgisQuery = usePVGIS(s.lat, s.lon, s.roofTiltDeg, {
    fetchEnabled: s.pvgisManual === null,
  })

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

  const { rows, hourlySelfOverlapModel } = useMemo(() => {
    const range = s.consumptionCsvDateRange
    const yr = s.consumptionCsvSelectedYear
    const dh = s.consumptionCsvDailyHourly
    if (
      dh &&
      range &&
      yr != null &&
      s.consumptionCsvFluviusGranularity === 'kwartier'
    ) {
      const fromHourly = computeMonthlyEnergyRowsFromHourlyProfile({
        monthlyProductionKwh: productionMonthly,
        monthlyConsumptionKwh: consumptionProfile,
        dailyHourly: dh,
        year: yr,
        fileMin: range.min,
        fileMax: range.max,
        latDeg: s.lat,
        selfConsumptionRate: selfRate,
        pvgisTmyGhiDailyHourly: s.pvgisManual?.tmyGhiDailyHourly ?? null,
        pvgisTmyRange: s.pvgisManual?.tmyRange ?? null,
        pvgisTmyDataYear: s.pvgisManual?.tmyDataYear ?? null,
        pvgisTmyMultiYear: s.pvgisManual?.tmyMultiYear ?? false,
      })
      if (fromHourly) {
        return { rows: fromHourly, hourlySelfOverlapModel: true as const }
      }
    }
    return {
      rows: computeMonthlyEnergyRows({
        monthlyProductionKwh: productionMonthly,
        monthlyConsumptionKwh: consumptionProfile,
        selfConsumptionRate: selfRate,
      }),
      hourlySelfOverlapModel: false as const,
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
      }),
    [s, rows],
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
        <div className="flex flex-wrap gap-2">
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
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-6">
          <LocationSearch />
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
              <span className="font-medium">Vermogen: </span>
              <span className="tabular-nums">{formatNumber(systemKwp, 2, 2)} kWp</span>
            </div>
            {!s.pvgisManual ? (
              <SliderInput
                id="tilt"
                label="Dakhelling"
                min={10}
                max={60}
                step={1}
                value={s.roofTiltDeg}
                onChange={s.setRoofTiltDeg}
                suffix="°"
                hint="Wijzigen haalt nieuwe PVGIS-curve op."
              />
            ) : null}
            <SliderInput
              id="use"
              label="Jaarverbruik elektriciteit"
              min={500}
              max={15000}
              step={100}
              value={s.annualConsumptionKwh}
              onChange={s.setAnnualConsumptionKwh}
              suffix="kWh"
              hint={
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
                          ? ` — CSV (${s.consumptionCsvSelectedYear})`
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
              </div>
            ) : null}
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
                min={0}
                max={0.15}
                step={0.005}
                value={s.feedinTariffEurPerKwh}
                onChange={s.setFeedinTariffEurPerKwh}
                suffix="€/kWh"
              />
              <p
                className="mt-1 text-xs text-slate-500 dark:text-slate-400"
                title="Fluvius netinjectietarief prosument (~€0,04/kWh). Analoge teller: volledige netbalans."
              >
                Tip: Fluvius prosumententarief voor digitale meter ≈ €0,04/kWh; analoge teller profiteert
                van volledige netbalans.
              </p>
            </div>

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

            <fieldset className="space-y-2">
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
                Batterij meerekenen (zelfverbruik 70% → 90%)
              </label>
              {s.batteryEnabled ? (
                <SliderInput
                  id="bat"
                  label="Batterijcapaciteit"
                  min={2}
                  max={30}
                  step={0.5}
                  value={s.batteryKwh}
                  onChange={s.setBatteryKwh}
                  suffix="kWh"
                />
              ) : null}
            </fieldset>
          </section>
        </div>

        <div className="space-y-6">
          {!s.pvgisManual && pvgisQuery.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200">
              PVGIS kon niet worden geladen (
              {pvgisQuery.error instanceof Error ? pvgisQuery.error.message : 'fout'}). Er wordt een
              voorbeeldcurve gebruikt — probeer later opnieuw of gebruik handmatige PVGIS-JSON hierboven.
            </div>
          ) : !s.pvgisManual && pvgisQuery.isLoading ? (
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
