import { useId, useMemo, useRef, useState } from 'react'
import { useCalculatorStore } from '../store/calculatorStore'
import {
  distinctYearsFromPeakMonths,
  monthlyPeakKwForYear,
  parsePeakPowerCsv,
} from '../utils/peakPowerCsv'
import { PeakPowerMonthlyChart } from './PeakPowerMonthlyChart'
import { SliderInput } from './SliderInput'

function clampYear(choice: number | null, years: number[]): number | null {
  if (years.length === 0) {
    return null
  }
  if (choice != null && years.includes(choice)) {
    return choice
  }
  return years[0]!
}

export function PeakPowerCsvUpload({ dark }: { dark: boolean }) {
  const {
    peakPowerKwByMonth,
    peakPowerSelectedYear,
    capacityTariffEurPerKwYear,
    setPeakPowerCsv,
    setPeakPowerYear,
    setCapacityTariffEurPerKwYear,
    clearPeakPowerCsv,
  } = useCalculatorStore()

  const [error, setError] = useState<string | null>(null)
  const fileId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      try {
        const result = parsePeakPowerCsv(text)
        setPeakPowerCsv({
          peakKwByMonth: result.peakKwByMonth,
          minDate: result.minDate,
          maxDate: result.maxDate,
          fullYears: result.fullCalendarYears,
          suggestedYear: result.suggestedYear,
          fileName: file.name,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
      e.target.value = ''
    }
    reader.onerror = () => {
      setError('Bestand kon niet worden gelezen.')
      e.target.value = ''
    }
    reader.readAsText(file, 'UTF-8')
  }

  const yearChoices = useMemo(
    () => (peakPowerKwByMonth ? distinctYearsFromPeakMonths(peakPowerKwByMonth) : []),
    [peakPowerKwByMonth],
  )

  const chartYear = useMemo(
    () => clampYear(peakPowerSelectedYear, yearChoices),
    [peakPowerSelectedYear, yearChoices],
  )

  const monthlySeries = useMemo(() => {
    if (!peakPowerKwByMonth || chartYear == null) {
      return null
    }
    return monthlyPeakKwForYear(peakPowerKwByMonth, chartYear)
  }, [peakPowerKwByMonth, chartYear])

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Piekvermogen</h3>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          id={fileId}
          type="file"
          accept=".csv,text/csv,text/plain,.txt"
          className="sr-only"
          onChange={onFile}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Upload CSV
        </button>
        {yearChoices.length > 0 ? (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="sr-only">Jaar</span>
            <select
              value={chartYear ?? yearChoices[0]}
              onChange={(e) => setPeakPowerYear(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {yearChoices.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {peakPowerKwByMonth ? (
          <button
            type="button"
            onClick={() => {
              clearPeakPowerCsv()
              setError(null)
            }}
            className="text-xs text-red-700 underline hover:no-underline dark:text-red-400"
          >
            Wissen
          </button>
        ) : null}
      </div>

      {monthlySeries && chartYear != null ? (
        <div className="mt-4">
          <PeakPowerMonthlyChart monthlyPeakKw={monthlySeries} dark={dark} />
        </div>
      ) : null}

      <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
        <SliderInput
          id="cap-tariff"
          label="Capaciteitstarief (afnamepiek)"
          min={0}
          max={200}
          step={0.5}
          value={capacityTariffEurPerKwYear}
          onChange={setCapacityTariffEurPerKwYear}
          suffix="€/kW/jaar"
        />
      </div>

      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
