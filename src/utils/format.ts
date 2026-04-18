export function formatEur(n: number): string {
  return new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export function formatNumber(n: number, min = 0, max = 2): string {
  return new Intl.NumberFormat('nl-BE', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(n)
}

export const MONTH_LABELS_NL = [
  'jan.',
  'feb.',
  'mrt.',
  'apr.',
  'mei',
  'jun.',
  'jul.',
  'aug.',
  'sep.',
  'okt.',
  'nov.',
  'dec.',
]
