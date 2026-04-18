import { useEffect, useState } from 'react'
import { Calculator } from './components/Calculator'
import { applySearchParamsToStore } from './utils/urlState'
import { useCalculatorStore } from './store/calculatorStore'

const DARK_KEY = 'solarsim-dark'

export default function App() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    const saved = localStorage.getItem(DARK_KEY)
    if (saved === '1') {
      return true
    }
    if (saved === '0') {
      return false
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add('dark')
      localStorage.setItem(DARK_KEY, '1')
    } else {
      root.classList.remove('dark')
      localStorage.setItem(DARK_KEY, '0')
    }
  }, [dark])

  useEffect(() => {
    applySearchParamsToStore(window.location.search, (partial) => {
      useCalculatorStore.setState(partial)
    })
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 to-slate-100 text-slate-900 dark:from-slate-950 dark:to-slate-900 dark:text-slate-50">
      <div className="sticky top-0 z-40 flex justify-end border-b border-slate-200/80 bg-white/70 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          {dark ? 'Licht thema' : 'Donker thema'}
        </button>
      </div>
      <Calculator dark={dark} />
    </div>
  )
}
