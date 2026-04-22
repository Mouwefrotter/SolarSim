import { useId, useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ChartDataset, ChartOptions } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { MONTH_LABELS_NL } from '../utils/format'
import type { ParsedPVGIS } from '../types/pvgis'
import {
  dayHourlyConsumptionFromDagNachtRegisters,
  dayHourlyConsumptionKwh,
  dayHourlyProductionKwh,
} from '../utils/dayHourlyProfile'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => String(i))

interface DayHourlyChartProps {
  productionMonthly: number[]
  consumptionProfile: number[]
  consumptionEven: number[]
  hasCustomConsumption: boolean
  consumptionProfileSource: 'csv' | 'fluvius' | null
  showActualVersusEstimated: boolean
  parsed: ParsedPVGIS
  latDeg: number
  roofTiltDeg: number
  consumptionCsvDailyHourly: Record<string, number[]> | null
  consumptionCsvDailyDag: Record<string, number> | null
  consumptionCsvDailyNacht: Record<string, number> | null
  consumptionCsvDateRange: { min: string; max: string } | null
  consumptionCsvSelectedYear: number | null
  /** Per maand kalenderjaar bij mix van twee jaren; anders null */
  consumptionCsvYearByMonth: number[] | null
  consumptionCsvFluviusGranularity: 'dag' | 'kwartier' | null
  dark: boolean
}

export function DayHourlyChart({
  productionMonthly,
  consumptionProfile,
  consumptionEven,
  hasCustomConsumption,
  consumptionProfileSource,
  showActualVersusEstimated,
  parsed,
  latDeg,
  roofTiltDeg,
  consumptionCsvDailyHourly,
  consumptionCsvDailyDag,
  consumptionCsvDailyNacht,
  consumptionCsvDateRange,
  consumptionCsvSelectedYear,
  consumptionCsvYearByMonth,
  consumptionCsvFluviusGranularity,
  dark,
}: DayHourlyChartProps) {
  const chartId = useId()
  const [month0, setMonth0] = useState(() => new Date().getMonth())

  const calendarYear =
    (consumptionCsvYearByMonth && consumptionCsvYearByMonth[month0] != null
      ? consumptionCsvYearByMonth[month0]
      : consumptionCsvSelectedYear) ?? new Date().getFullYear()
  const month1 = month0 + 1

  const hasHourlyConsumption =
    Boolean(consumptionCsvDailyHourly) &&
    consumptionCsvFluviusGranularity === 'kwartier' &&
    consumptionCsvDateRange != null &&
    consumptionCsvSelectedYear != null

  const hasDagNachtRegisters =
    consumptionCsvFluviusGranularity === 'dag' &&
    Boolean(consumptionCsvDailyDag) &&
    Boolean(consumptionCsvDailyNacht) &&
    consumptionCsvDateRange != null &&
    consumptionCsvSelectedYear != null

  const { prod, consPrimary, consCompare } = useMemo(() => {
    const pM = productionMonthly[month0] ?? 0
    const cPrimary =
      showActualVersusEstimated && hasCustomConsumption
        ? (consumptionProfile[month0] ?? 0)
        : (consumptionEven[month0] ?? 0)
    const cCompare =
      showActualVersusEstimated && hasCustomConsumption ? (consumptionEven[month0] ?? 0) : null

    const prod = dayHourlyProductionKwh(
      pM,
      month1,
      calendarYear,
      latDeg,
      roofTiltDeg,
      parsed,
    )

    const dh = hasHourlyConsumption ? consumptionCsvDailyHourly : null
    const range = consumptionCsvDateRange
    const yr =
      consumptionCsvYearByMonth && consumptionCsvYearByMonth[month0] != null
        ? consumptionCsvYearByMonth[month0]
        : consumptionCsvSelectedYear

    const consPrimary =
      hasDagNachtRegisters && consumptionCsvDailyDag && consumptionCsvDailyNacht && range && yr != null
        ? dayHourlyConsumptionFromDagNachtRegisters(
            cPrimary,
            month1,
            calendarYear,
            consumptionCsvDailyDag,
            consumptionCsvDailyNacht,
            range.min,
            range.max,
            yr,
          )
        : dayHourlyConsumptionKwh(
            cPrimary,
            month1,
            calendarYear,
            dh,
            range?.min ?? null,
            range?.max ?? null,
            yr,
            false,
          )

    /** Referentie: zelfde maand-totaal als «even over maanden», maar gelijk verdeeld over 24 uur. */
    const consCompare =
      cCompare != null
        ? dayHourlyConsumptionKwh(
            cCompare,
            month1,
            calendarYear,
            null,
            null,
            null,
            null,
            false,
          )
        : null

    return { prod, consPrimary, consCompare }
  }, [
    month0,
    calendarYear,
    productionMonthly,
    consumptionProfile,
    consumptionEven,
    hasCustomConsumption,
    showActualVersusEstimated,
    parsed,
    latDeg,
    roofTiltDeg,
    consumptionCsvDailyHourly,
    consumptionCsvDailyDag,
    consumptionCsvDailyNacht,
    consumptionCsvDateRange,
    consumptionCsvSelectedYear,
    consumptionCsvYearByMonth,
    hasHourlyConsumption,
    hasDagNachtRegisters,
  ])

  const grid = dark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.08)'
  const text = dark ? '#e2e8f0' : '#334155'

  const importedLineLabel =
    consumptionProfileSource === 'csv'
      ? 'Verbruik (CSV-profiel)'
      : consumptionProfileSource === 'fluvius'
        ? 'Verbruik (Fluvius-profiel)'
        : 'Verbruik (importprofiel)'

  const options: ChartOptions<'line'> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: {
          grid: { color: grid },
          ticks: { color: text, maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          title: { display: true, text: 'Uur (lokaal)', color: text, font: { size: 10 } },
        },
        y: {
          grid: { color: grid },
          ticks: { color: text },
          title: { display: true, text: 'kWh/u', color: text, font: { size: 11 } },
        },
      },
      plugins: {
        legend: {
          labels: { color: text },
        },
        tooltip: {
          callbacks: {
            title(items) {
              const i = items[0]?.dataIndex
              const h = typeof i === 'number' ? i : 0
              return `Uur ${h}–${h + 1}`
            },
            label(ctx) {
              const v = ctx.parsed.y
              const n = typeof v === 'number' && !Number.isNaN(v) ? v : 0
              return `${ctx.dataset.label ?? ''}: ${n.toFixed(3)} kWh/u`
            },
          },
        },
      },
    }),
    [grid, text],
  )

  const datasets = useMemo((): ChartDataset<'line'>[] => {
    const out: ChartDataset<'line'>[] = [
      {
        label: 'Productie',
        data: prod,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.08)',
        tension: 0.25,
        fill: false,
        borderWidth: 2,
        pointRadius: 0,
      },
      {
        label:
          hasCustomConsumption && showActualVersusEstimated
            ? importedLineLabel
            : 'Verbruik (gespreid over jaar)',
        data: consPrimary,
        borderColor: 'rgb(249, 115, 22)',
        backgroundColor: 'rgba(249, 115, 22, 0.08)',
        tension: 0.25,
        fill: false,
        borderWidth: 2,
        pointRadius: 0,
      },
    ]
    if (consCompare) {
      out.push({
        label: 'Verbruik (even over de dag)',
        data: consCompare,
        borderColor: 'rgba(236, 72, 153, 0.95)',
        backgroundColor: 'transparent',
        tension: 0.25,
        fill: false,
        borderWidth: 2,
        borderDash: [5, 4],
        pointRadius: 0,
      })
    }
    return out
  }, [
    prod,
    consPrimary,
    consCompare,
    hasCustomConsumption,
    showActualVersusEstimated,
    importedLineLabel,
  ])

  const data = useMemo(
    () => ({
      labels: HOUR_LABELS,
      datasets,
    }),
    [datasets],
  )

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Gemiddelde kWh per uur op een dag in de gekozen maand.
          {hasDagNachtRegisters
            ? ' Verbruik: vorm uit Fluvius Afname Dag/Nacht (nacht 22–06 u, dag 06–22 u).'
            : hasHourlyConsumption
              ? ' Verbruik: opgebouwd uit je kwartierdata.'
              : null}
        </p>
        <label className="text-[11px] text-slate-600 dark:text-slate-300">
          <span className="mr-2 text-slate-500 dark:text-slate-400">Maand</span>
          <select
            id={`${chartId}-month`}
            value={month0}
            onChange={(e) => setMonth0(Number(e.target.value))}
            className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            aria-label="Kalendermaand voor daggrafiek"
          >
            {MONTH_LABELS_NL.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="h-72 w-full min-h-[16rem] sm:h-80">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
