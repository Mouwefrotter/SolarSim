import { describe, expect, it } from 'vitest'
import { monthlyConsumptionKwh } from './consumptionProfile'

describe('monthlyConsumptionKwh', () => {
  it('prefers CSV over Fluvius when both set', () => {
    const fluvius = Array(12).fill(100) as number[]
    const csv = Array(12).fill(50) as number[]
    const out = monthlyConsumptionKwh(1200, fluvius, csv)
    expect(out.every((x) => Math.abs(x - 100) < 0.01)).toBe(true)
  })

  it('uses Fluvius when CSV missing', () => {
    const fluvius = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]
    const out = monthlyConsumptionKwh(1200, fluvius, null)
    expect(out[0]).toBeCloseTo(100)
  })
})
