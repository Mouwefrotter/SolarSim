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
  /** Korte uitleg naast het label (i), o.a. voor importprofielen */
  labelInfo?: string
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
  labelInfo,
}: SliderInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="inline-flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <span>{label}</span>
          {labelInfo ? (
            <span
              className="inline-flex h-4 w-4 shrink-0 cursor-help select-none items-center justify-center rounded-full border border-slate-400 text-[0.6rem] font-serif font-bold leading-none text-slate-600 dark:border-slate-500 dark:text-slate-300"
              title={labelInfo}
              role="img"
              aria-label={`Info: ${labelInfo}`}
            >
              i
            </span>
          ) : null}
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
