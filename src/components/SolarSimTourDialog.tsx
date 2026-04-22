import { useEffect, useId, useState } from 'react'

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Welkom',
    body: 'SolarSim bevat linksonder de invoer voor zonne-installatie, verbruik en kosten, en rechts de resultaten. Je kunt je scenario delen met «Link delen».',
  },
  {
    title: 'PVGIS: locatie en oriëntatie',
    body: 'Zoek je adres, stel helling, asimut, verliezen en technologie in, en kies de periode voor de time series. Klik «Laad opbrengst in app» om de maandcurve op te halen, of laad een bestand handmatig.',
  },
  {
    title: 'PVGIS-export en reeks',
    body: 'De knop voor de CSV en «Kopieer link» bouwen de URL naar het PVGIS-eindpunt re.jrc.ec.europa.eu (seriescalc) met jouw coördinaten en instellingen. Wissel in dezelfde URL `outputformat=csv` naar `outputformat=json` om de ruwe API-reactie te openen. Gebruik liefst «Opslaan als…» in de browser, niet een bewaarde HTML-pagina, zodat het bestand echt door komma’s gescheiden is.',
  },
  {
    title: 'Verbruik',
    body: 'Fluvius- en verbruikscsv’s horen bij de sectie «Verbruik» verderop, niet bij de PVGIS-upload. Zo voorkom je verkeerd geüploade bestanden.',
  },
  {
    title: 'Piekvermogen (Fluvius)',
    body: 'Upload de Fluvius-export «Historiek piekvermogen»: één gemeten piek per maand in kW. Dat is geen volledige kwartier- of uurreeks, alleen de maandmaximum om je distributienet-capaciteitsaansluiting te duiden.',
  },
  {
    title: 'Capaciteitstarief (afnamepiek)',
    body: 'Vul je jaarlijkse kost per kW piekafname in (€/kW/jaar). Zet op 0 om dit uit te zetten. Een begrote besparing verschijnt als je Fluvius-kwartierverbruik (hetzelfde kalenderjaar) én uur-simulatie in de app hebt: de app vergelijkt historische maandpieken met de gesimuleerde netpiek met PV (en desgewijs accu) — per maand een gemiddelde dag. Geen besparing als het piek-jaar niet overeenvalt met je verbruiksjaar, kwartierdata ontbreekt, of de gesimuleerde piek niet lager is dan de geüploade piek.',
  },
]

type Props = { open: boolean; onClose: () => void; dark: boolean }

export function SolarSimTourDialog({ open, onClose, dark }: Props) {
  const [step, setStep] = useState(0)
  const titleId = useId()

  useEffect(() => {
    if (open) {
      setStep(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) {
    return null
  }

  const last = step >= STEPS.length - 1
  const s = STEPS[step]!

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-label="Sluiten"
      />
      <div
        className={`relative z-[101] w-full max-w-md rounded-2xl border p-5 shadow-xl ${
          dark
            ? 'border-slate-600 bg-slate-900 text-slate-100'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {s.title}
        </h2>
        <p
          className={`mt-3 text-sm leading-relaxed ${dark ? 'text-slate-300' : 'text-slate-600'}`}
        >
          {s.body}
        </p>
        <div className="mt-5 flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
            {step + 1} / {STEPS.length}
          </span>
          <div className="flex gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((i) => i - 1)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  dark
                    ? 'border-slate-600 text-slate-200 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-800 hover:bg-slate-50'
                }`}
              >
                Vorige
              </button>
            ) : null}
            {last ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-amber-400"
              >
                Klaar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((i) => i + 1)}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-amber-400"
              >
                Volgende
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
