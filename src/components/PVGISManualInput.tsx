import { useId, useRef, useState } from 'react'
import { useCalculatorStore } from '../store/calculatorStore'
import { PvgisUploadMetaPanel } from './PvgisUploadMetaPanel'
import { parseUploadedPvgisFile } from '../utils/pvgisParse'

export function PVGISManualInput() {
  const { pvgisManual, pvgisManualFileName, setPvgisManual } = useCalculatorStore()
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
        const parsed = parseUploadedPvgisFile(text)
        setPvgisManual(parsed, file.name)
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

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        PVGIS-data (handmatig)
      </h3>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          id={fileId}
          type="file"
          accept=".json,.csv,application/json,text/csv"
          className="sr-only"
          onChange={onFile}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Upload JSON of CSV
        </button>
        {pvgisManual ? (
          <button
            type="button"
            onClick={() => {
              setPvgisManual(null)
              setError(null)
            }}
            className="text-xs text-red-700 underline hover:no-underline dark:text-red-400"
          >
            Wissen
          </button>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {pvgisManual ? (
        <PvgisUploadMetaPanel meta={pvgisManual.inputsMeta} fileName={pvgisManualFileName} />
      ) : null}
    </div>
  )
}
