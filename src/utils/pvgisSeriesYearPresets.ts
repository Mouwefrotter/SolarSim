/**
 * Voorkeursperioden voor PVGIS `seriescalc` (start- en eindjaar in één keuze).
 * Standaard in de app: 2005–2020.
 */
export const PVGIS_SERIES_YEAR_CHOICES: { start: number; end: number; label: string }[] = [
  { start: 2005, end: 2020, label: '2005–2020' },
  { start: 2010, end: 2020, label: '2010–2020' },
  { start: 2015, end: 2020, label: '2015–2020' },
  { start: 2015, end: 2023, label: '2015–2023' },
  { start: 2018, end: 2023, label: '2018–2023' },
  { start: 2020, end: 2024, label: '2020–2024' },
  { start: 2020, end: 2025, label: '2020–2025' },
  { start: 2005, end: 2010, label: '2005–2010' },
  { start: 2005, end: 2015, label: '2005–2015' },
  { start: 2010, end: 2015, label: '2010–2015' },
  { start: 2010, end: 2018, label: '2010–2018' },
  { start: 2012, end: 2020, label: '2012–2020' },
  { start: 2020, end: 2026, label: '2020–2026' },
]

export function rangeKey(start: number, end: number): string {
  return `${start}-${end}`
}
