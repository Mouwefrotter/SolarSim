import { useMemo, useState } from 'react'
import { useCalculatorStore } from '../store/calculatorStore'
import { LocationSearch } from './LocationSearch'
import { SliderInput } from './SliderInput'
import { formatNumber } from '../utils/format'
import { PVGIS_PV_TECH_OPTIONS, buildPvgisSeriescalcDownloadUrl } from '../utils/pvgisLinks'
import { PVGIS_SERIES_YEAR_CHOICES, rangeKey } from '../utils/pvgisSeriesYearPresets'

const PVGIS_NOMINAL_PEAK_POWER_INFO =
  'This is the power that the manufacturer declares that the PV array can produce under standard test conditions, which are a constant 1000W of solar irradiance per square meter in the plane of the array, at an array temperature of 25°C. The peak power should be entered in kilowatt-peak (kWp). If you do not know the declared peak power of your modules but instead know the area of the modules (in m2) and the declared conversion efficiency (in percent), you can calculate the peak power as power (kWp) = 1 kW/m2 * area * efficiency / 100.'

export function PvgisDataControls() {
  const s = useCalculatorStore()
  const [copied, setCopied] = useState(false)

  const seriesCsvUrl = useMemo(
    () =>
      buildPvgisSeriescalcDownloadUrl({
        lat: s.lat,
        lon: s.lon,
        peakpowerKw: s.pvgisPeakPowerKw,
        systemLossPct: s.pvgisSystemLossPct,
        angleDeg: s.roofTiltDeg,
        aspectDeg: s.pvgisPanelAzimuthDeg,
        pvtechchoice: s.pvgisPvtechChoice,
        startYear: s.pvgisSeriesStartYear,
        endYear: s.pvgisSeriesEndYear,
        outputformat: 'csv',
      }),
    [
      s.lat,
      s.lon,
      s.pvgisPeakPowerKw,
      s.pvgisSystemLossPct,
      s.roofTiltDeg,
      s.pvgisPanelAzimuthDeg,
      s.pvgisPvtechChoice,
      s.pvgisSeriesStartYear,
      s.pvgisSeriesEndYear,
    ],
  )

  const onCopyLink = () => {
    void navigator.clipboard.writeText(seriesCsvUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const isManual = s.pvgisManual != null

  const yearSelectValue = useMemo(() => {
    return rangeKey(s.pvgisSeriesStartYear, s.pvgisSeriesEndYear)
  }, [s.pvgisSeriesStartYear, s.pvgisSeriesEndYear])

  const isPreset = useMemo(() => {
    return PVGIS_SERIES_YEAR_CHOICES.some(
      (c) => c.start === s.pvgisSeriesStartYear && c.end === s.pvgisSeriesEndYear,
    )
  }, [s.pvgisSeriesStartYear, s.pvgisSeriesEndYear])

  const onYearSelect = (v: string) => {
    const [a, b] = v.split('-').map((x) => Number(x))
    if (Number.isFinite(a) && Number.isFinite(b) && a < b) {
      s.setPvgisSeriesYearRange(a, b)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
        PVGIS — locatie en oriëntatie
      </h2>

      <LocationSearch embedded />

      <p className="text-sm text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-800 dark:text-slate-100">{s.locationLabel}</span>
        <span className="ml-1.5 tabular-nums text-slate-500 dark:text-slate-400">
          {formatNumber(s.lat, 3, 3)}°N, {formatNumber(s.lon, 3, 3)}°E
        </span>
      </p>

      <SliderInput
        id="pvgis-tilt"
        label="Dakhelling (t.o.v. horizontaal)"
        min={10}
        max={60}
        step={1}
        value={s.roofTiltDeg}
        onChange={s.setRoofTiltDeg}
        suffix="°"
      />
      <SliderInput
        id="pvgis-asp"
        label="Asimut (0° = Zuid, +90° = West, −90° = Oost)"
        min={-180}
        max={180}
        step={1}
        value={s.pvgisPanelAzimuthDeg}
        onChange={s.setPvgisPanelAzimuthDeg}
        suffix="°"
      />
      <SliderInput
        id="pvgis-ppk"
        label="Nomin. vermogen (seriescalc, kWp)"
        min={0.1}
        max={30}
        step={0.1}
        value={s.pvgisPeakPowerKw}
        onChange={s.setPvgisPeakPowerKw}
        suffix="kWp"
        labelInfo={PVGIS_NOMINAL_PEAK_POWER_INFO}
      />
      <SliderInput
        id="pvgis-loss"
        label="Batterij- en ohmverliezen (PVGIS)"
        min={5}
        max={30}
        step={0.5}
        value={s.pvgisSystemLossPct}
        onChange={s.setPvgisSystemLossPct}
        suffix="%"
      />

      <div className="space-y-1.5">
        <label
          htmlFor="pvgis-tech"
          className="text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          PV-technologie
        </label>
        <select
          id="pvgis-tech"
          value={s.pvgisPvtechChoice}
          onChange={(e) => s.setPvgisPvtechChoice(e.target.value)}
          className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {PVGIS_PV_TECH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label} ({o.value})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="pvgis-years"
          className="text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Tijdreeks (start–eindjaar, seriescalc)
        </label>
        <select
          id="pvgis-years"
          value={yearSelectValue}
          onChange={(e) => onYearSelect(e.target.value)}
          className="w-full max-w-sm rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          {!isPreset ? (
            <option value={yearSelectValue}>
              {s.pvgisSeriesStartYear}–{s.pvgisSeriesEndYear} (link / aangepast)
            </option>
          ) : null}
          {PVGIS_SERIES_YEAR_CHOICES.map((c) => {
            const k = rangeKey(c.start, c.end)
            if (!isPreset && k === yearSelectValue) {
              return null
            }
            return (
              <option key={k} value={k}>
                {c.label}
              </option>
            )
          })}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <a
          href={seriesCsvUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          PVGIS CSV
        </a>
        <button
          type="button"
          onClick={onCopyLink}
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {copied ? 'Gekopieërd' : 'Link'}
        </button>
      </div>

      {isManual ? (
        <p className="text-sm text-amber-800 dark:text-amber-200/90">
          Handmatig bestand actief: schuifregelaars wijzigen de download-URL; de simulatie gebruikt
          je upload.
        </p>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => s.setPvgisProductionLoaded(true)}
            className="rounded-lg border border-amber-500/80 bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-950 hover:bg-amber-200/90 dark:border-amber-600/80 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-800/50"
          >
            Laad opbrengst in app
          </button>
          {!s.pvgisProductionLoaded ? (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Geen automatische ophaal. Stel in en klik, of upload hieronder.
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
