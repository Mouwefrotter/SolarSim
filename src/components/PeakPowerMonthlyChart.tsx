import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'
import type { ChartOptions } from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { MONTH_LABELS_NL } from '../utils/format'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
)

interface PeakPowerMonthlyChartProps {
  monthlyPeakKw: (number | null)[]
  dark: boolean
}

function meanOfPresentMonths(monthly: (number | null)[]): number | null {
  const vals = monthly.filter((v): v is number => v != null && !Number.isNaN(v))
  if (vals.length === 0) {
    return null
  }
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function PeakPowerMonthlyChart({ monthlyPeakKw, dark }: PeakPowerMonthlyChartProps) {
  const grid = dark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.08)'
  const text = dark ? '#e2e8f0' : '#334155'

  const avgKw = useMemo(() => meanOfPresentMonths(monthlyPeakKw), [monthlyPeakKw])

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { color: text, boxWidth: 12, padding: 12, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          label(ctx) {
            const v = ctx.parsed.y
            if (v === null || typeof v !== 'number' || Number.isNaN(v)) {
              return `${ctx.dataset.label ?? ''}: —`
            }
            return `${ctx.dataset.label ?? ''}: ${v.toFixed(2)} kW`
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: text },
      },
      y: {
        grid: { color: grid },
        ticks: { color: text },
        title: { display: true, text: 'kW', color: text, font: { size: 11 } },
      },
    },
  }

  const lineData =
    avgKw != null ? (Array.from({ length: 12 }, () => avgKw) as number[]) : null

  const data = {
    labels: MONTH_LABELS_NL,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Piek',
        data: monthlyPeakKw as (number | null)[],
        backgroundColor: 'rgba(234, 179, 8, 0.7)',
        borderRadius: 4,
        order: 0,
      },
      ...(lineData
        ? [
            {
              type: 'line' as const,
              label: 'Gemiddelde (maanden met data)',
              data: lineData,
              borderColor: 'rgb(59, 130, 246)',
              backgroundColor: 'transparent',
              borderWidth: 2,
              borderDash: [6, 4],
              pointRadius: 0,
              tension: 0,
              order: 1,
            },
          ]
        : []),
    ],
  }

  return (
    <div className="h-56 w-full min-w-0">
      <Chart type="bar" data={data as never} options={options} />
    </div>
  )
}
