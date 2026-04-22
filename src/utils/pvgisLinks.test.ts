import { describe, expect, it } from 'vitest'
import { buildPvgisSeriescalcDownloadUrl, pvgisToolsOpenUrl } from './pvgisLinks'

describe('pvgisToolsOpenUrl', () => {
  it('includes lat lon and map hash', () => {
    const u = pvgisToolsOpenUrl(50.8428, 4.3651)
    expect(u).toContain('https://re.jrc.ec.europa.eu/pvg_tools/en/')
    expect(u).toContain('lat=')
    expect(u).toContain('lon=')
    expect(u).toContain('#map=')
  })
})

describe('buildPvgisSeriescalcDownloadUrl', () => {
  it('builds a direct JRC seriescalc URL with expected params', () => {
    const u = buildPvgisSeriescalcDownloadUrl({
      lat: 50.89,
      lon: 4.733,
      peakpowerKw: 1,
      systemLossPct: 14,
      angleDeg: 35,
      aspectDeg: 0,
      pvtechchoice: 'crystSi',
      startYear: 2020,
      endYear: 2026,
      outputformat: 'csv',
    })
    expect(u).toContain('https://re.jrc.ec.europa.eu/api/v5_2/seriescalc?')
    expect(u).toMatch(/[?&]lat=50\.89/)
    expect(u).toMatch(/[?&]lon=4\.733/)
    expect(u).toMatch(/[?&]outputformat=csv/)
    expect(u).toMatch(/[?&]startyear=2020/)
    expect(u).toMatch(/[?&]endyear=2026/)
    expect(u).toMatch(/[?&]pvtechchoice=crystSi/)
  })
})
