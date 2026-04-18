import { describe, expect, it } from 'vitest'
import { pvgisToolsOpenUrl } from './pvgisLinks'

describe('pvgisToolsOpenUrl', () => {
  it('includes lat lon and map hash', () => {
    const u = pvgisToolsOpenUrl(50.8428, 4.3651)
    expect(u).toContain('https://re.jrc.ec.europa.eu/pvg_tools/en/')
    expect(u).toContain('lat=')
    expect(u).toContain('lon=')
    expect(u).toContain('#map=')
  })
})
