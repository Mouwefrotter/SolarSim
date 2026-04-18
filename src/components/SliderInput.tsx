interface SliderInputProps {
  id: string
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  suffix?: string
  hint?: string
}

export function SliderInput({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  suffix,
  hint,
}: SliderInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            id={`${id}-num`}
            type="number"
            min={min}
            max={max}
            step={step}
            value={Number.isFinite(value) ? value : ''}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          {suffix ? (
            <span className="text-sm text-slate-500 dark:text-slate-400">{suffix}</span>
          ) : null}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-amber-500"
      />
      {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  )
}
