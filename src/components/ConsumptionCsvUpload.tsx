import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useCalculatorStore } from '../store/calculatorStore'
import { distinctYearsFromDaily, parseConsumptionCsv } from '../utils/csvConsumption'
import { MONTH_LABELS_NL } from '../utils/format'

function clampYear(choice: number | null, years: number[]): number | null {
  if (years.length === 0) {
    return null
  }
  if (choice != null && years.includes(choice)) {
    return choice
  }
  return years[0]!
}

export function ConsumptionCsvUpload() {
  const {
    consumptionCsvMonthlyKwh,
    consumptionCsvFormat,
    consumptionCsvDaily,
    consumptionCsvFluviusGranularity,
    consumptionCsvSelectedYear,
    consumptionCsvUseMixedYears,
    consumptionCsvYearSecondary,
    consumptionCsvMixedFirstMonthSecondary,
    setConsumptionCsvSimple,
    setConsumptionCsvFluvius,
    setConsumptionCsvYear,
    setConsumptionCsvUseMixedYears,
    setConsumptionCsvTwoYearMix,
    setConsumptionCsvYearSecondary,
    setConsumptionCsvMixedFirstMonthSecondary,
    clearConsumptionCsv,
    setAnnualConsumptionKwh,
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
        const result = parseConsumptionCsv(text)
        if (result.format === 'simple12') {
          const total = result.monthly.reduce((a, b) => a + b, 0)
          if (total > 0) {
            setAnnualConsumptionKwh(total)
          }
          setConsumptionCsvSimple(result.monthly, file.name, 'simple')
        } else if (result.format === 'quarterly') {
          const total = result.monthly.reduce((a, b) => a + b, 0)
          if (total > 0) {
            setAnnualConsumptionKwh(total)
          }
          setConsumptionCsvSimple(result.monthly, file.name, 'quarterly')
        } else {
          setConsumptionCsvFluvius({
            daily: result.daily,
            dailyDag: result.dailyDag,
            dailyNacht: result.dailyNacht,
            fluviusGranularity: result.fluviusGranularity,
            dailyHourly: result.dailyHourly,
            fullYears: result.fullCalendarYears,
            minDate: result.minDate,
            maxDate: result.maxDate,
            selectedYear: result.suggestedYear,
            monthly: result.monthlyForSuggestedYear,
            fileName: file.name,
          })
          const tot = result.monthlyForSuggestedYear.reduce((a, b) => a + b, 0)
          if (tot > 0) {
            setAnnualConsumptionKwh(tot)
          }
        }
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

  const yearChoices = useMemo(() => {
    if (consumptionCsvFormat !== 'fluvius-daily' || !consumptionCsvDaily) {
      return []
    }
    return distinctYearsFromDaily(consumptionCsvDaily)
  }, [consumptionCsvFormat, consumptionCsvDaily])

  const chartYear = useMemo(
    () => clampYear(consumptionCsvSelectedYear, yearChoices),
    [consumptionCsvSelectedYear, yearChoices],
  )

  useEffect(() => {
    if (consumptionCsvFormat !== 'fluvius-daily' || chartYear == null) {
      return
    }
    if (consumptionCsvUseMixedYears) {
      return
    }
    if (consumptionCsvSelectedYear !== chartYear) {
      setConsumptionCsvYear(chartYear)
    }
  }, [
    consumptionCsvFormat,
    chartYear,
    consumptionCsvSelectedYear,
    setConsumptionCsvYear,
    consumptionCsvUseMixedYears,
  ])

  const hasData = Boolean(consumptionCsvMonthlyKwh)
  const fluviusKind =
    consumptionCsvFormat === 'fluvius-daily' && consumptionCsvFluviusGranularity
      ? consumptionCsvFluviusGranularity === 'kwartier'
        ? 'kwartiertotalen'
        : 'dagtotalen'
      : null

  return (
    <div
      className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50"
      data-tour="tour-consumption"
    >
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        Verbruik (kwartier of dagtotaal Fluvius)
      </h3>

      <div className="mt-3 flex flex-wrap items-center gap-3">
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
        {fluviusKind ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">({fluviusKind})</span>
        ) : null}
        {consumptionCsvFormat === 'fluvius-daily' && yearChoices.length > 0 && chartYear != null ? (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="text-slate-500 dark:text-slate-400">
              {yearChoices.length >= 2 ? 'Jaar A' : 'Jaar'}
            </span>
            <select
              value={chartYear}
              onChange={(e) => setConsumptionCsvYear(Number(e.target.value))}
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
        {hasData ? (
          <button
            type="button"
            onClick={() => {
              clearConsumptionCsv()
              setError(null)
            }}
            className="text-xs text-red-700 underline hover:no-underline dark:text-red-400"
          >
            Wissen
          </button>
        ) : null}
      </div>

      {yearChoices.length >= 2 && chartYear != null && consumptionCsvFormat === 'fluvius-daily' ? (
        <div className="mt-4 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-600">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={consumptionCsvUseMixedYears}
              onChange={(e) => {
                if (e.target.checked) {
                  const other = yearChoices.find((y) => y !== chartYear)
                  if (other != null && other !== chartYear) {
                    setConsumptionCsvTwoYearMix(chartYear, other, 10)
                  }
                } else {
                  setConsumptionCsvUseMixedYears(false)
                }
              }}
              className="h-4 w-4 rounded border-slate-300 accent-amber-500"
            />
            Twee kalenderjaren combineren (bv. lege maanden in één jaar)
          </label>
          {consumptionCsvUseMixedYears && consumptionCsvYearSecondary != null ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200">
              <p>
                {consumptionCsvMixedFirstMonthSecondary > 1
                  ? `${MONTH_LABELS_NL[0].replace(/\.$/, '')} t/m ${MONTH_LABELS_NL[consumptionCsvMixedFirstMonthSecondary - 2]}: kalenderjaar ${chartYear}. Vanaf ${MONTH_LABELS_NL[consumptionCsvMixedFirstMonthSecondary - 1]}: jaar ${consumptionCsvYearSecondary}.`
                  : `Alle maanden uit jaar ${consumptionCsvYearSecondary}.`}
              </p>
              <label className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Jaar B</span>
                <select
                  value={consumptionCsvYearSecondary}
                  onChange={(e) => setConsumptionCsvYearSecondary(Number(e.target.value))}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {yearChoices.map((y) => (
                    <option key={y} value={y} disabled={y === chartYear}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-wrap items-center gap-2">
                <span className="font-medium">Eerste maand uit jaar B</span>
                <select
                  value={consumptionCsvMixedFirstMonthSecondary}
                  onChange={(e) =>
                    setConsumptionCsvMixedFirstMonthSecondary(Number(e.target.value))
                  }
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {MONTH_LABELS_NL[m - 1]} ({m})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
