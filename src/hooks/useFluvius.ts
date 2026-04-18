import { codeChallengeS256, generateCodeVerifier } from '../utils/pkce'
import type { FluviusConsumptionResponse, FluviusOAuthTokenResponse } from '../types/fluvius'
import { monthlyKwhFromFluviusResponse } from '../utils/fluviusNormalize'

const AUTH = 'https://api.fluvius.be/oauth/authorize'
const TOKEN = 'https://api.fluvius.be/oauth/token'
const CONSUMPTION = 'https://api.fluvius.be/v1/consumption/monthly'

const PKCE_VERIFIER_KEY = 'solarsim-fluvius-code-verifier'
const OAUTH_STATE_KEY = 'solarsim-fluvius-oauth-state'

export function buildFluviusAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  codeChallenge: string
  state: string
}): string {
  const u = new URL(AUTH)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', input.clientId)
  u.searchParams.set('redirect_uri', input.redirectUri)
  u.searchParams.set('scope', 'energy:read')
  u.searchParams.set('state', input.state)
  u.searchParams.set('code_challenge', input.codeChallenge)
  u.searchParams.set('code_challenge_method', 'S256')
  return u.toString()
}

export async function startFluviusOAuth(clientId: string, redirectUri: string): Promise<void> {
  const verifier = generateCodeVerifier()
  const challenge = await codeChallengeS256(verifier)
  const state = crypto.randomUUID()
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier)
  sessionStorage.setItem(OAUTH_STATE_KEY, state)
  const url = buildFluviusAuthorizeUrl({
    clientId,
    redirectUri,
    codeChallenge: challenge,
    state,
  })
  window.location.assign(url)
}

export async function exchangeFluviusCode(input: {
  code: string
  redirectUri: string
  clientId: string
  codeVerifier: string
}): Promise<FluviusOAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.codeVerifier,
  })
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${t.slice(0, 200)}`)
  }
  return (await res.json()) as FluviusOAuthTokenResponse
}

export function readOAuthCallbackParams(): { code: string | null; state: string | null; error: string | null } {
  const p = new URLSearchParams(window.location.search)
  return {
    code: p.get('code'),
    state: p.get('state'),
    error: p.get('error'),
  }
}

export function validateOAuthState(returnedState: string | null): boolean {
  const expected = sessionStorage.getItem(OAUTH_STATE_KEY)
  sessionStorage.removeItem(OAUTH_STATE_KEY)
  return Boolean(expected && returnedState && expected === returnedState)
}

export function getStoredCodeVerifier(): string | null {
  const v = sessionStorage.getItem(PKCE_VERIFIER_KEY)
  sessionStorage.removeItem(PKCE_VERIFIER_KEY)
  return v
}

export async function fetchFluviusConsumption(accessToken: string): Promise<{
  monthly: number[] | null
  raw: FluviusConsumptionResponse
}> {
  const res = await fetch(CONSUMPTION, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Consumptie-API (${res.status}): ${t.slice(0, 240)}`)
  }
  const raw = (await res.json()) as FluviusConsumptionResponse
  const monthly = monthlyKwhFromFluviusResponse(raw)
  return { monthly, raw }
}
