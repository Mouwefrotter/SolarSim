import type { FluviusConsumptionResponse, FluviusMonthlyConsumption } from '../types/fluvius'

function rowKwh(row: FluviusMonthlyConsumption): number | null {
  const v =
    row.volume_kwh ?? row.volumeKwh ?? row.kwh ?? row.consumption_kwh ?? (row as { volume?: number }).volume
  if (typeof v === 'number' && !Number.isNaN(v)) {
    return v
  }
  return null
}

/** Parse ISO-like month string to 1–12 */
function calendarMonthKey(monthStr: string): number | null {
  const m = monthStr.match(/(\d{4})-(\d{2})/)
  if (!m) {
    return null
  }
  const mo = Number(m[2])
  if (mo >= 1 && mo <= 12) {
    return mo
  }
  return null
}

/**
 * Build 12 monthly kWh values (Jan–Dec). If rows include month keys, bucket;
 * else spread chronologically into nearest slots.
 */
export function monthlyKwhFromFluviusResponse(res: FluviusConsumptionResponse): number[] | null {
  const rows: FluviusMonthlyConsumption[] = res.data ?? res.months ?? res.consumption ?? []
  const withVals = rows
    .map((r) => ({ row: r, kwh: rowKwh(r), key: r.month ? calendarMonthKey(r.month) : null }))
    .filter((x): x is typeof x & { kwh: number } => x.kwh !== null)

  if (withVals.length === 0) {
    return null
  }

  const byMonth = new Map<number, number>()
  let usedKeyed = false
  for (const { kwh, key } of withVals) {
    if (key !== null) {
      byMonth.set(key, (byMonth.get(key) ?? 0) + kwh)
      usedKeyed = true
    }
  }

  if (usedKeyed && byMonth.size >= 1) {
    const out = Array.from({ length: 12 }, (_, i) => byMonth.get(i + 1) ?? 0)
    const sum = out.reduce((a, b) => a + b, 0)
    if (sum > 0) {
      return out
    }
  }

  /* Fallback: last N rows → distribute across 12 months proportionally */
  const chronological = withVals.map((x) => x.kwh)
  const n = chronological.length
  const take = Math.min(12, n)
  const slice = chronological.slice(-take)
  const total = slice.reduce((a, b) => a + b, 0)
  if (total <= 0) {
    return null
  }
  const per = total / 12
  return Array(12).fill(per) as number[]
}

export function extractFluviusMeta(res: FluviusConsumptionResponse): {
  ean: string | undefined
  addressLabel: string | undefined
} {
  const ean =
    res.ean ??
    res.meter_ean ??
    res.supply_point?.ean
  const addr = res.address ?? res.supply_point?.address
  const addressLabel =
    addr?.formatted ??
    [addr?.street, addr?.postal_code, addr?.city].filter(Boolean).join(', ')
  return { ean, addressLabel }
}
