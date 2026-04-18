import { useEffect, useState } from 'react'
import { useCalculatorStore } from '../store/calculatorStore'
import {
  exchangeFluviusCode,
  fetchFluviusConsumption,
  getStoredCodeVerifier,
  readOAuthCallbackParams,
  startFluviusOAuth,
  validateOAuthState,
} from '../hooks/useFluvius'
import { extractFluviusMeta } from '../utils/fluviusNormalize'

const SETTINGS_KEY = 'solarsim-fluvius-settings'

function loadStoredCredentials(): { clientId: string; redirectUri: string } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const j = JSON.parse(raw) as { clientId?: string; redirectUri?: string }
      return {
        clientId: j.clientId ?? '',
        redirectUri: j.redirectUri ?? `${window.location.origin}/`,
      }
    }
  } catch {
    /* */
  }
  return { clientId: '', redirectUri: `${window.location.origin}/` }
}

export function FluviusImport() {
  const {
    fluviusClientId,
    fluviusRedirectUri,
    fluviusEan,
    fluviusAddress,
    fluviusMonthlyKwh,
    setFluviusSettings,
    setFluviusImport,
    setAnnualConsumptionKwh,
  } = useCalculatorStore()

  const [modal, setModal] = useState(false)
  const [clientId, setClientId] = useState(fluviusClientId)
  const [redirectUri, setRedirectUri] = useState(
    fluviusRedirectUri || `${window.location.origin}/`,
  )
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const s = loadStoredCredentials()
    if (s.clientId) {
      setClientId(s.clientId)
      setRedirectUri(s.redirectUri)
      setFluviusSettings(s.clientId, s.redirectUri)
    }
  }, [setFluviusSettings])

  useEffect(() => {
    const { code, state, error } = readOAuthCallbackParams()
    if (error) {
      setMsg(
        `OAuth-fout: ${error}. Controleer client_id en redirect URI op developer.fluvius.be.`,
      )
      window.history.replaceState({}, '', window.location.pathname)
      return
    }
    if (!code) {
      return
    }

    const guardKey = `solarsim-oauth-${code}`
    if (sessionStorage.getItem(guardKey)) {
      return
    }
    sessionStorage.setItem(guardKey, '1')

    if (!validateOAuthState(state)) {
      setMsg('OAuth-state komt niet overeen — probeer opnieuw.')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    const verifier = getStoredCodeVerifier()
    if (!verifier) {
      setMsg('PKCE verifier ontbreekt — start de import opnieuw vanaf deze pagina.')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    const stored = loadStoredCredentials()
    const z = useCalculatorStore.getState()
    const cid = stored.clientId || z.fluviusClientId
    const redir = stored.redirectUri || z.fluviusRedirectUri || `${window.location.origin}/`

    if (!cid) {
      setMsg('Vul eerst client_id op in instellingen (developer.fluvius.be).')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    setBusy(true)
    setMsg(null)
    exchangeFluviusCode({
      code,
      clientId: cid,
      redirectUri: redir,
      codeVerifier: verifier,
    })
      .then(async (tok) => {
        const { monthly, raw } = await fetchFluviusConsumption(tok.access_token)
        const meta = extractFluviusMeta(raw)
        if (monthly) {
          const total = monthly.reduce((a, b) => a + b, 0)
          if (total > 0) {
            setAnnualConsumptionKwh(total)
          }
        }
        setFluviusImport(monthly, meta.ean ?? null, meta.addressLabel ?? null)
        setMsg('Fluvius-data geladen.')
      })
      .catch((e: unknown) => {
        const err =
          e instanceof Error
            ? e.message
            : 'Onbekende fout. Mogelijk blokkeert de browser de token-aanvraag (CORS) — zie developer.fluvius.be.'
        setMsg(err)
      })
      .finally(() => {
        setBusy(false)
        window.history.replaceState({}, '', window.location.pathname)
      })
  }, [setAnnualConsumptionKwh, setFluviusImport])

  const saveSettings = () => {
    const c = clientId.trim()
    const r = redirectUri.trim() || `${window.location.origin}/`
    setFluviusSettings(c, r)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ clientId: c, redirectUri: r }))
    } catch {
      /* */
    }
    setModal(false)
  }

  const onOAuth = () => {
    const stored = loadStoredCredentials()
    const z = useCalculatorStore.getState()
    const cid = clientId.trim() || stored.clientId || z.fluviusClientId.trim()
    const redir = redirectUri.trim() || stored.redirectUri || z.fluviusRedirectUri.trim()
    if (!cid || !redir) {
      setModal(true)
      setMsg('Vul client_id en redirect_uri in (Fluvius-ontwikkelaarsportal).')
      return
    }
    setFluviusSettings(cid, redir)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ clientId: cid, redirectUri: redir }))
    } catch {
      /* */
    }
    void startFluviusOAuth(cid, redir)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Fluvius-verbruik
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            OAuth naar api.fluvius.be (vereist registratie op developer.fluvius.be)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setModal(true)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Instellingen
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onOAuth()}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60 dark:bg-amber-500 dark:text-slate-900 dark:hover:bg-amber-400"
          >
            {busy ? 'Bezig…' : 'Import uit Fluvius'}
          </button>
        </div>
      </div>

      {fluviusEan || fluviusAddress || fluviusMonthlyKwh ? (
        <dl className="mt-3 grid gap-1 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
          {fluviusEan ? (
            <div>
              <dt className="font-medium text-slate-500 dark:text-slate-400">EAN / meter</dt>
              <dd className="font-mono">{fluviusEan}</dd>
            </div>
          ) : null}
          {fluviusAddress ? (
            <div>
              <dt className="font-medium text-slate-500 dark:text-slate-400">Adres</dt>
              <dd>{fluviusAddress}</dd>
            </div>
          ) : null}
          {fluviusMonthlyKwh ? (
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500 dark:text-slate-400">Maandprofiel</dt>
              <dd>Ingelezen — zie grafiek (toggle werkelijk vs gespreid)</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {msg ? (
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200" role="status">
          {msg}
        </p>
      ) : null}

      {modal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fluvius-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
            <h4 id="fluvius-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Fluvius API-instellingen
            </h4>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Registreer je app op{' '}
              <a
                href="https://developer.fluvius.be"
                className="text-amber-600 underline dark:text-amber-400"
                target="_blank"
                rel="noreferrer"
              >
                developer.fluvius.be
              </a>{' '}
              en vul je client_id en redirect URI in (gelijk aan je OAuth-registratie).
            </p>
            <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
              client_id
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-200">
              redirect_uri
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                placeholder="https://jouwdomein.be/"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={saveSettings}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
