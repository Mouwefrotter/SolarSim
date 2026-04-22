import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ChartData, ChartDataset, ChartOptions } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { MONTH_LABELS_NL } from '../utils/format'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
)

interface MonthlyChartProps {
  productionMonthly: number[]
  selfConsumedMonthly: number[]
  /** Met accu: zelfverbruik zonder accu (uur- of factor­model), voor vergelijking in de grafiek */
  selfConsumedNoBatteryMonthly?: number[] | null
  consumptionEven: number[]
  consumptionProfile: number[]
  hasCustomConsumption: boolean
  /** Which import drives the profile (CSV wins over Fluvius in app logic). */
  consumptionProfileSource: 'csv' | 'fluvius' | null
  showActualVersusEstimated: boolean
  dark: boolean
}

export function MonthlyChart({
  productionMonthly,
  selfConsumedMonthly,
  selfConsumedNoBatteryMonthly,
  consumptionEven,
  consumptionProfile,
  hasCustomConsumption,
  consumptionProfileSource,
  showActualVersusEstimated,
  dark,
}: MonthlyChartProps) {
  const showBatteryBreakdown =
    Array.isArray(selfConsumedNoBatteryMonthly) &&
    selfConsumedNoBatteryMonthly.length === 12
  const grid = dark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.08)'
  const text = dark ? '#e2e8f0' : '#334155'

  const primaryLine =
    showActualVersusEstimated && hasCustomConsumption ? consumptionProfile : consumptionEven
  const compareLine =
    showActualVersusEstimated && hasCustomConsumption ? consumptionEven : null

  const importedLineLabel =
    consumptionProfileSource === 'csv'
      ? 'Verbruik (CSV-profiel)'
      : consumptionProfileSource === 'fluvius'
        ? 'Verbruik (Fluvius-profiel)'
        : 'Verbruik (importprofiel)'

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        stacked: false,
        grid: { color: grid },
        ticks: { color: text },
      },
      y: {
        stacked: false,
        grid: { color: grid },
        ticks: { color: text },
        title: { display: true, text: 'kWh', color: text, font: { size: 11 } },
      },
    },
    plugins: {
      legend: {
        labels: { color: text },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const v = ctx.parsed.y
            const n = typeof v === 'number' && !Number.isNaN(v) ? v : 0
            return `${ctx.dataset.label ?? ''}: ${n.toFixed(0)} kWh`
          },
        },
      },
    },
  }

  const selfBarDatasets: ChartDataset<'bar' | 'line'>[] = showBatteryBreakdown
    ? [
        {
          type: 'bar' as const,
          label: 'Zelf verbruikt (zonder batterij)',
          data: selfConsumedNoBatteryMonthly!,
          backgroundColor: 'rgba(34, 197, 94, 0.65)',
          borderRadius: 4,
          order: 3,
        },
        {
          type: 'bar' as const,
          label: 'Zelf verbruikt (met batterij)',
          data: selfConsumedMonthly,
          backgroundColor: 'rgba(99, 102, 241, 0.72)',
          borderRadius: 4,
          order: 4,
        },
      ]
    : [
        {
          type: 'bar' as const,
          label: 'Zelf verbruikt (model)',
          data: selfConsumedMonthly,
          backgroundColor: 'rgba(34, 197, 94, 0.65)',
          borderRadius: 4,
          order: 3,
        },
      ]

  const datasets: ChartDataset<'bar' | 'line'>[] = [
    {
      type: 'bar',
      label: 'Productie',
      data: productionMonthly,
      backgroundColor: 'rgba(59, 130, 246, 0.65)',
      borderRadius: 4,
      order: 2,
    },
    ...selfBarDatasets,
    {
      type: 'line',
      label:
        hasCustomConsumption && showActualVersusEstimated
          ? importedLineLabel
          : 'Verbruik (gespreid over jaar)',
      data: primaryLine,
      borderColor: 'rgb(249, 115, 22)',
      backgroundColor: 'rgba(249, 115, 22, 0.15)',
      tension: 0.25,
      fill: false,
      order: 0,
    },
  ]

  if (compareLine) {
    datasets.push({
      type: 'line',
      label: 'Verbruik (even over maanden)',
      data: compareLine,
      borderColor: 'rgba(236, 72, 153, 0.95)',
      borderDash: [5, 4],
      tension: 0.25,
      fill: false,
      order: 1,
    })
  }

  const data: ChartData<'bar' | 'line'> = { labels: MONTH_LABELS_NL, datasets }

  return (
    <div className="h-72 w-full min-h-[16rem] sm:h-80">
      <Chart
        type="bar"
        data={data as ChartData<'bar'>}
        options={options}
      />
    </div>
  )
}
