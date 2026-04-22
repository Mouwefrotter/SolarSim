import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useCalculatorStore } from '../store/calculatorStore'
import { useGeocode } from '../hooks/useGeocode'
import { nominatimSearchBe, type GeocodeHit } from '../utils/nominatimSearch'
import { pvgisToolsOpenUrl } from '../utils/pvgisLinks'

const SUGGEST_DEBOUNCE_MS = 350
const MIN_CHARS = 3
const SUGGEST_LIMIT = 8

export function LocationSearch({ embedded }: { embedded?: boolean }) {
  const { setLocation } = useCalculatorStore()
  const geocode = useGeocode()
  const [draft, setDraft] = useState('')
  const [debounced, setDebounced] = useState('')
  const [suggestions, setSuggestions] = useState<GeocodeHit[]>([])
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const busy = geocode.isPending

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(draft), SUGGEST_DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [draft])

  useEffect(() => {
    if (debounced.trim().length < MIN_CHARS) {
      setSuggestions([])
      setSuggestLoading(false)
      abortRef.current?.abort()
      return
    }
    const ac = new AbortController()
    abortRef.current?.abort()
    abortRef.current = ac
    setSuggestLoading(true)
    let cancelled = false
    nominatimSearchBe(debounced, { limit: SUGGEST_LIMIT, signal: ac.signal })
      .then((hits) => {
        if (!cancelled) {
          setSuggestions(hits)
        }
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return
        }
        if (!cancelled && debounced.trim().length >= MIN_CHARS) {
          setSuggestions([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSuggestLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [debounced])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const applyHit = useCallback((hit: GeocodeHit) => {
    setLocation(hit.lat, hit.lon, hit.displayName)
    setDraft(hit.displayName)
    setSuggestions([])
    setSuggestOpen(false)
  }, [setLocation])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSuggestOpen(false)
    const q = draft.trim()
    if (!q) {
      return
    }
    geocode.mutate(q, {
      onSuccess: (hit) => {
        setLocation(hit.lat, hit.lon, hit.displayName)
        window.open(pvgisToolsOpenUrl(hit.lat, hit.lon), '_blank', 'noopener,noreferrer')
        setDraft('')
        setSuggestions([])
      },
    })
  }

  const onInputChange = (v: string) => {
    setDraft(v)
    setSuggestOpen(true)
  }

  const onInputFocus = () => {
    if (suggestions.length > 0) {
      setSuggestOpen(true)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSuggestOpen(false)
    }
  }

  const form = (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div ref={wrapRef} className="relative min-w-0 flex-1">
          <input
            type="search"
            role="combobox"
            aria-expanded={suggestOpen}
            aria-controls={suggestOpen ? listId : undefined}
            aria-autocomplete="list"
            placeholder="Belgisch adres (straat, gemeente)…"
            value={draft}
            autoComplete="off"
            onChange={(e) => onInputChange(e.target.value)}
            onFocus={onInputFocus}
            onKeyDown={onKeyDown}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          {suggestOpen && (suggestLoading || suggestions.length > 0) ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-slate-600 dark:bg-slate-900"
            >
              {suggestLoading && suggestions.length === 0 ? (
                <li className="px-3 py-2 text-slate-500 dark:text-slate-400">Zoeken…</li>
              ) : null}
              {suggestions.map((hit, i) => (
                <li key={`${hit.lat},${hit.lon},${i}`} role="option">
                  <button
                    type="button"
                    className="w-full cursor-pointer px-3 py-2 text-left hover:bg-amber-50 dark:hover:bg-slate-800"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyHit(hit)}
                  >
                    <span className="line-clamp-2 text-slate-800 dark:text-slate-100">{hit.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400 disabled:opacity-60"
        >
          {busy ? 'Zoeken…' : 'Zoek'}
        </button>
    </form>
  )

  if (embedded) {
    return (
      <div className="space-y-2">
        {form}
        {geocode.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {(geocode.error as Error).message}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Locatie</h3>
      {form}
      {geocode.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {(geocode.error as Error).message}
        </p>
      ) : null}
    </div>
  )
}
