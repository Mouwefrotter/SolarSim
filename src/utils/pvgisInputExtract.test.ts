import { describe, expect, it } from 'vitest'
import {
  extractPvgisUploadedInputs,
  formatLatLonParen,
  pvgisAzimuthToOrientationNl,
} from './pvgisInputExtract'

describe('pvgisAzimuthToOrientationNl', () => {
  it('maps PVGIS azimuth from south', () => {
    expect(pvgisAzimuthToOrientationNl(0)).toBe('Zuid')
    expect(pvgisAzimuthToOrientationNl(90)).toBe('West')
    expect(pvgisAzimuthToOrientationNl(-90)).toBe('Oost')
    expect(pvgisAzimuthToOrientationNl(45)).toBe('Zuidwest')
    expect(pvgisAzimuthToOrientationNl(-45)).toBe('Zuidoost')
    expect(pvgisAzimuthToOrientationNl(180)).toBe('Noord')
  })
})

describe('formatLatLonParen', () => {
  it('formats with Dutch decimals', () => {
    expect(formatLatLonParen(50.89, 4.733)).toMatch(/50,890° N/)
    expect(formatLatLonParen(50.89, 4.733)).toMatch(/4,733° O/)
  })
})

describe('extractPvgisUploadedInputs', () => {
  it('extracts from PVGIS v5.2 sample shape', () => {
    const raw = {
      inputs: {
        location: { latitude: 50.89, longitude: 4.733, elevation: 27 },
        mounting_system: {
          fixed: {
            slope: { value: 35, optimal: false },
            azimuth: { value: 0, optimal: false },
            type: 'free-standing',
          },
        },
        pv_module: {
          technology: 'c-Si',
          peak_power: 1.0,
          system_loss: 14.0,
        },
      },
    }
    const m = extractPvgisUploadedInputs(raw)
    expect(m?.slopeDeg).toBe(35)
    expect(m?.azimuthDeg).toBe(0)
    expect(m?.mountingTypeRaw).toBe('free-standing')
    expect(m?.pvTechnology).toBe('c-Si')
    expect(m?.peakPowerKw).toBe(1)
    expect(m?.systemLossPct).toBe(14)
    expect(m?.latitude).toBe(50.89)
    expect(m?.longitude).toBe(4.733)
  })

  it('returns undefined without inputs', () => {
    expect(extractPvgisUploadedInputs({ outputs: {} })).toBeUndefined()
  })
})
