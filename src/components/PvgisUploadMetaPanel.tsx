import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { PvgisUploadedInputsMeta } from '../types/pvgis'
import {
  formatLatLonParen,
  mountingTypeToNl,
  pvgisAzimuthToOrientationNl,
} from '../utils/pvgisInputExtract'
import { nominatimReversePlace } from '../utils/nominatimSearch'
import { formatNumber } from '../utils/format'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
      <span className="shrink-0 font-medium text-slate-600 dark:text-slate-400">{label}</span>
      <span className="min-w-0 text-slate-800 dark:text-slate-100">{children}</span>
    </div>
  )
}

export function PvgisUploadMetaPanel({
  meta,
  fileName,
}: {
  meta: PvgisUploadedInputsMeta | undefined
  fileName: string | null
}) {
  const lat = meta?.latitude
  const lon = meta?.longitude
  const rev = useQuery({
    queryKey: ['nominatim-reverse', lat, lon],
    queryFn: ({ signal }) => nominatimReversePlace(lat!, lon!, { signal }),
    enabled:
      typeof lat === 'number' &&
      typeof lon === 'number' &&
      Number.isFinite(lat) &&
      Number.isFinite(lon),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })

  const coordLine =
    typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)
      ? formatLatLonParen(lat, lon)
      : null

  const placeLine =
    typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) ? (
      rev.isPending ? (
        <span className="text-slate-500">
          plaats zoeken… <span className="text-slate-400">({coordLine})</span>
        </span>
      ) : rev.data?.placeName ? (
        <>
          {rev.data.placeName} <span className="text-slate-500">({coordLine})</span>
        </>
      ) : (
        <span className="text-slate-600 dark:text-slate-300">{coordLine}</span>
      )
    ) : null

  const orientationLine =
    typeof meta?.azimuthDeg === 'number' && !Number.isNaN(meta.azimuthDeg) ? (
      <>
        {pvgisAzimuthToOrientationNl(meta.azimuthDeg)}{' '}
        <span className="text-slate-500">(Azimut={formatNumber(meta.azimuthDeg, 0, 0)}°)</span>
      </>
    ) : null

  const mountNl = mountingTypeToNl(meta?.mountingTypeRaw)

  if (!meta && !fileName) {
    return null
  }

  const hasTech =
    meta?.pvTechnology !== undefined ||
    meta?.peakPowerKw !== undefined ||
    meta?.systemLossPct !== undefined

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-slate-200/80 bg-white/60 px-3 py-2.5 dark:border-slate-600/80 dark:bg-slate-900/40">
      {fileName ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-600 dark:text-slate-300">Bestand: </span>
          {fileName}
        </p>
      ) : null}
      {!meta ? (
        <p className="text-xs text-slate-500">Geen PVGIS-invoergegevens in het bestand (alleen TMY/straling is OK).</p>
      ) : (
        <div className="space-y-1.5">
          {placeLine !== null ? <Row label="Locatie:">{placeLine}</Row> : null}
          {typeof meta.slopeDeg === 'number' && !Number.isNaN(meta.slopeDeg) ? (
            <Row label="Dakhelling:">
              {formatNumber(meta.slopeDeg, 0, 0)}°
            </Row>
          ) : null}
          {orientationLine !== null ? <Row label="Orientatie:">{orientationLine}</Row> : null}
          {mountNl ? (
            <Row label="Montagetype:">{mountNl}</Row>
          ) : meta.mountingTypeRaw ? (
            <Row label="Montagetype:">{meta.mountingTypeRaw}</Row>
          ) : null}
          {hasTech ? (
            <Row label="PV-module:">
              <span className="space-x-1">
                {meta.pvTechnology ? <span>{meta.pvTechnology}</span> : null}
                {typeof meta.peakPowerKw === 'number' && !Number.isNaN(meta.peakPowerKw) ? (
                  <span className="text-slate-600 dark:text-slate-300">
                    · {formatNumber(meta.peakPowerKw, 2, 2)} kWp
                  </span>
                ) : null}
                {typeof meta.systemLossPct === 'number' && !Number.isNaN(meta.systemLossPct) ? (
                  <span className="text-slate-600 dark:text-slate-300">
                    · {formatNumber(meta.systemLossPct, 0, 1)}% verlies
                  </span>
                ) : null}
              </span>
            </Row>
          ) : null}
        </div>
      )}
    </div>
  )
}
