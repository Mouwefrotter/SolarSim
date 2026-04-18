import { useMutation } from '@tanstack/react-query'
import { nominatimGeocodeOne, type GeocodeHit } from '../utils/nominatimSearch'

export type { GeocodeHit }

export function useGeocode() {
  return useMutation({
    mutationFn: async (address: string): Promise<GeocodeHit> => {
      const q = address.trim()
      if (!q) {
        throw new Error('Vul een adres in')
      }
      return nominatimGeocodeOne(q)
    },
  })
}
