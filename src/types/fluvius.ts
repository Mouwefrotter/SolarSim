/** Fluvius Customer Portal API (estimated shapes; extend as API evolves) */

export interface FluviusOAuthTokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}

/** Example monthly row — adjust when consuming real API */
export interface FluviusMonthlyConsumption {
  month: string
  volume_kwh?: number
  /** snake_case / camelCase variants */
  volumeKwh?: number
  kwh?: number
  consumption_kwh?: number
}

export interface FluviusConsumptionResponse {
  /** Meter id / EAN */
  ean?: string
  meter_ean?: string
  address?: {
    street?: string
    postal_code?: string
    city?: string
    formatted?: string
  }
  /** Often nested under connection / supply point */
  supply_point?: {
    ean?: string
    address?: FluviusConsumptionResponse['address']
  }
  data?: FluviusMonthlyConsumption[]
  months?: FluviusMonthlyConsumption[]
  consumption?: FluviusMonthlyConsumption[]
}
