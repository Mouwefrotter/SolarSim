import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { ChartOptions } from 'chart.js'
import { Line } from 'react-chartjs-2'
import annotationPlugin from 'chartjs-plugin-annotation'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin,
)

interface SavingsChartProps {
  cumulativeSavings: number[]
  totalSystemCost: number
  breakevenYear: number | null
  dark: boolean
}

export function SavingsChart({
  cumulativeSavings,
  totalSystemCost,
  breakevenYear,
  dark,
}: SavingsChartProps) {
  const grid = dark ? 'rgba(148,163,184,0.2)' : 'rgba(15,23,42,0.08)'
  const text = dark ? '#e2e8f0' : '#334155'

  const years = cumulativeSavings.map((_, i) => String(i + 1))

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid: { color: grid },
        ticks: { color: text },
        title: { display: true, text: 'Jaar', color: text, font: { size: 11 } },
      },
      y: {
        grid: { color: grid },
        ticks: { color: text },
        title: { display: true, text: '€ (cumulatief)', color: text, font: { size: 11 } },
      },
    },
    plugins: {
      legend: { labels: { color: text } },
      annotation: {
        annotations: breakevenYear
          ? {
              breakeven: {
                type: 'line',
                scaleID: 'x',
                value: String(breakevenYear),
                borderColor: dark ? '#fbbf24' : '#d97706',
                borderWidth: 2,
                borderDash: [6, 6],
                label: {
                  display: true,
                  content: 'Breakeven',
                  color: text,
                  backgroundColor: dark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.95)',
                },
              },
            }
          : {},
      },
    },
  }

  const costLine = cumulativeSavings.map(() => totalSystemCost)

  const data = {
    labels: years,
    datasets: [
      {
        label: 'Cumulatieve besparingen',
        data: cumulativeSavings,
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
        fill: true,
        tension: 0.2,
      },
      {
        label: 'Installatiekost',
        data: costLine,
        borderColor: 'rgba(148, 163, 184, 0.9)',
        borderDash: [4, 4],
        fill: false,
        tension: 0,
        pointRadius: 0,
      },
    ],
  }

  return (
    <div className="h-72 w-full min-h-[16rem] sm:h-80">
      <Line data={data} options={options} />
    </div>
  )
}
