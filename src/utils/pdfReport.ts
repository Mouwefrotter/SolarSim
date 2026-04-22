import { jsPDF } from 'jspdf'
import { formatEur, formatNumber, MONTH_LABELS_NL } from './format'
import { PROSUMENT_EUR_PER_KWP_YEAR } from './financialCalc'

const MM_PAGE_H = 297
const MM_PAGE_W = 210
const MARGIN = 16
const FOOTER_MM = 12

type YearlyRow = {
  year: number
  productionKwh: number
  selfNoBattKwh: number
  selfWithBattKwh: number
  exportNoBattKwh: number
  exportWithBattKwh: number
  purchaseEurPerKwh: number
  feedinEurPerKwh: number
}

export function downloadSolarSimPdf(data: {
  title: string
  locationLabel: string
  lat: number
  lon: number
  paybackYears: number
  npv25Eur: number
  totalCostEur: number
  annualSavingsEur: number
  digitalMeter: boolean
  pvgis: {
    roofTiltDeg: number
    panelAzimuthDeg: number
    peakPowerKwp: number
    systemLossPct: number
    pvtechLabel: string
  }
  install: {
    roofAreaM2: number
    panelEfficiencyPct: number
    systemKwp: number
  }
  investment: {
    panelsAndInverterEur: number
    fixedInstallEur: number
    batteryEur: number
  }
  battery: null | {
    enabled: boolean
    nominalKwh: number
    presetLabel: string | null
    minSocFrac: number
    chargeEff: number
    dischargeEff: number
    maxPowerKw: number
    annualDegradationPct: number
    warrantyYears: number
  }
  /** Jaar 0: totale elektriciteitsvraag (kWh) — zelfde schaal als simulatie. */
  annualConsumptionKwh: number
  productionMonthly: number[]
  consumptionProfileMonthly: number[]
  withBatterySelfMonthly: number[]
  noBatterySelfMonthly: number[]
  withBatteryExportMonthly: number[]
  noBatteryExportMonthly: number[]
  tariffs: { purchaseEurPerKwh: number; feedinEurPerKwh: number }
  yearlyTable: readonly YearlyRow[]
}): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = MARGIN
  const line = (t: string, size = 10, gap = 5) => {
    const lines = doc.splitTextToSize(t, MM_PAGE_W - 2 * MARGIN)
    doc.setFontSize(size)
    if (y + (Array.isArray(lines) ? lines.length * gap * 0.4 : 0) > MM_PAGE_H - FOOTER_MM) {
      doc.addPage()
      y = MARGIN
    }
    if (Array.isArray(lines)) {
      doc.text(lines, MARGIN, y)
      y += lines.length * (gap * 0.85) + 2
    } else {
      doc.text(lines, MARGIN, y)
      y += gap + 2
    }
  }
  const head = (t: string) => {
    y += 3
    line(t, 12, 6)
    y += 1
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(data.title, MARGIN, y)
  y += 8
  doc.setFont('helvetica', 'normal')
  line(`Locatie: ${data.locationLabel} (${formatNumber(data.lat, 4, 4)}°N, ${formatNumber(data.lon, 4, 4)}°E)`)

  head('1. Parameters PV-installatie (hypothesen)')
  line(
    `Dakhelling: ${formatNumber(data.pvgis.roofTiltDeg, 0, 1)}° (t.o.v. horizontaal)`,
  )
  line(
    `Asimut: ${formatNumber(data.pvgis.panelAzimuthDeg, 0, 0)}° (0° = zuid, + west, − oost)`,
  )
  line(
    `Nomin. vermogen (seriescalc-URL, kWp): ${formatNumber(data.pvgis.peakPowerKwp, 1, 2)} kWp`,
  )
  line(
    `Batterij- en ohmverliezen (PVGIS-systeemverlies): ${formatNumber(data.pvgis.systemLossPct, 0, 1)} %`,
  )
  line(`PV-technologie: ${data.pvgis.pvtechLabel}`)
  line(`Dakoppervlak: ${formatNumber(data.install.roofAreaM2, 0, 1)} m²`)
  line(
    `Initieel paneelrendement (naar kWp-berekening): ${formatNumber(data.install.panelEfficiencyPct, 1, 1)} %`,
  )
  line(
    `Berekend vermogen installatie: ${formatNumber(data.install.systemKwp, 2, 2)} kWp (dak × rendement / 100)`,
  )

  if (data.battery?.enabled) {
    head('2. Thuisbatterij (parameters)')
    const b = data.battery
    if (b.presetLabel) {
      line(`Preset: ${b.presetLabel}`)
    } else {
      line('Handmatig ingesteld (geen cataloguspreset)')
    }
    line(`Nominale capaciteit: ${formatNumber(b.nominalKwh, 0, 1)} kWh`)
    line(`Minimum-SOC: ${formatNumber(b.minSocFrac * 100, 0, 1)} %`)
    line(`Laadrendement: ${formatNumber(b.chargeEff * 100, 1, 1)} %`)
    line(`Ontlaadrendement: ${formatNumber(b.dischargeEff * 100, 1, 1)} %`)
    line(`Max. laad/ontlaadvermogen: ${formatNumber(b.maxPowerKw, 1, 1)} kW`)
    line(`Geschatte degradatie: ${formatNumber(b.annualDegradationPct, 1, 1)} %/jaar (informatief)`)
    line(`Garantie / levensduur (richting): ${formatNumber(b.warrantyYears, 0, 0)} jaar`)
  }

  const secVerbruik = data.battery?.enabled ? '3' : '2'
  const secTarieven = data.battery?.enabled ? '4' : '3'
  const secTabel = data.battery?.enabled ? '5' : '4'

  head(`${secVerbruik}. Jaarlijks verbruik (jaar 0) en maandverdeling`)
  line(
    `Totaal jaarverbruik elektriciteit (modeljaar, kWh): ${formatNumber(data.annualConsumptionKwh, 0, 0)} kWh`,
  )
  y += 2
  doc.setFontSize(7)
  const colW = (MM_PAGE_W - 2 * MARGIN) / 7
  const rowH = 4
  let x0 = MARGIN
  const hRow = (cells: string[], bold = false) => {
    if (y + rowH > MM_PAGE_H - FOOTER_MM) {
      doc.addPage()
      y = MARGIN
    }
    if (bold) {
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setFont('helvetica', 'normal')
    }
    x0 = MARGIN
    for (const c of cells) {
      doc.text(c, x0, y + 3, { maxWidth: colW - 1 })
      x0 += colW
    }
    y += rowH
  }
  hRow(
    [
      'Maand',
      'Prod.',
      'Verbr.',
      'Zelfv. z. accu',
      'Zelfv. m. accu',
      'Exp. z. accu',
      'Exp. m. accu',
    ],
    true,
  )
  for (let i = 0; i < 12; i++) {
    hRow([
      MONTH_LABELS_NL[i]!,
      formatKwhOne(data.productionMonthly[i]!),
      formatKwhOne(data.consumptionProfileMonthly[i]!),
      formatKwhOne(data.noBatterySelfMonthly[i]!),
      formatKwhOne(data.withBatterySelfMonthly[i]!),
      formatKwhOne(data.noBatteryExportMonthly[i]!),
      formatKwhOne(data.withBatteryExportMonthly[i]!),
    ])
  }
  y += 4
  doc.setFontSize(9)
  if (!data.battery?.enabled) {
    line('Geen thuisbatterij in model: de kolommen «z. accu» en «m. accu» zijn identiek; idem export.', 8, 3.2)
  }
  line(
    'Kolombrekening: verbruik = modelprofiel; zelfv. = zonne-energie lokaal benut; export = productie min zelfv. (per maand).',
    8,
    3.5,
  )

  head(`${secTarieven}. Nettarieven (basiswaarden, zoals in de app)`)
  line(
    `Netinvoer: ${data.digitalMeter ? 'Digitale (prosument) teller' : 'Analoge (historische) teller'}`,
  )
  if (data.digitalMeter) {
    line(
      `Zoals in kosten-simulatie: prosumententarief ${formatEur(
        PROSUMENT_EUR_PER_KWP_YEAR * data.install.systemKwp,
      )} /jaar (≈${formatEur(PROSUMENT_EUR_PER_KWP_YEAR)}/kWp) opgelegd in besparing, niet in onderstaande tabel per kWh.`,
      8,
      3.5,
    )
  }
  line(
    `Aankoopprijs netstroom: ${formatNumber(data.tariffs.purchaseEurPerKwh, 2, 3)} €/kWh`,
  )
  line(
    `Injectietarief: ${formatNumber(data.tariffs.feedinEurPerKwh, 3, 3)} €/kWh`,
  )

  head(`${secTabel}. Simulatie over de jaren (fysische energie + tarieven met inflatie, zoals NPV)`)
  line(
    'Jaar 0: alleen investering. Jaar 1–25: productie kWh met 0,5% paneeldegradatie per jaar, zelfv./export in dezelfde verhouding; aankoopprijs en injectie met 2% elektriciteitsinflatie per jaar. Investering: panelen+omvormer, vaste post en optioneel accu, conform app-model.',
    8,
    3.2,
  )
  y += 3
  addYearlyTableLandscape(doc, data.investment, data.yearlyTable)

  doc.addPage('a4', 'p')
  let ySum = 20
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Samenvatting kosten (model)', MARGIN, ySum)
  ySum += 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const sumLines = [
    `Geschatte jaarlijkse besparing: ${formatEur(data.annualSavingsEur)}`,
    `Eenvoudige terugverdientijd: ${formatPayback(data.paybackYears)}`,
    `NPV (25 jaar, 3% discont): ${formatEur(data.npv25Eur)}`,
    `Geschatte totale investering: ${formatEur(data.totalCostEur)}`,
  ]
  for (const sl of sumLines) {
    doc.text(sl, MARGIN, ySum)
    ySum += 5
  }
  ySum += 4
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text(
    'Dit rapport is indicatief; controleer offertes, nettarieven en technische haalbaarheid.',
    MARGIN,
    MM_PAGE_H - 8,
  )

  doc.save(`solarsim-belgium-${new Date().toISOString().slice(0, 10)}.pdf`)
}

function formatKwhOne(v: number): string {
  return formatNumber(v, 0, 0)
}

function formatPayback(y: number): string {
  if (!Number.isFinite(y) || y > 1e6) {
    return 'n.v.t.'
  }
  return `${formatNumber(y, 1, 1)} jaar`
}

function addYearlyTableLandscape(
  doc: jsPDF,
  inv: { panelsAndInverterEur: number; fixedInstallEur: number; batteryEur: number },
  rows: readonly YearlyRow[],
) {
  const w = 297
  const h = 210
  doc.addPage('a4', 'l')
  const margin = 10
  let y = margin
  const fs = 6.2
  doc.setFontSize(fs)
  doc.setFont('helvetica', 'bold')
  const colLabels = [
    'Jr',
    'Inv PV+omv',
    'Vast',
    'Inv accu',
    'Prod kWh',
    'Zelf z.',
    'Zelf m.',
    'Exp z.',
    'Exp m.',
    '€/kWh afn',
    '€/kWh inj',
  ]
  const colW = (w - 2 * margin) / colLabels.length
  let x = margin
  for (const cl of colLabels) {
    doc.text(cl, x, y, { maxWidth: colW - 0.5 })
    x += colW
  }
  y += 4
  doc.setFont('helvetica', 'normal')
  for (const r of rows) {
    if (y + 3.5 > h - 8) {
      doc.addPage('a4', 'l')
      y = margin
    }
    x = margin
    const is0 = r.year === 0
    const cells: string[] = [
      String(r.year),
      is0 ? formatEurCompact(inv.panelsAndInverterEur) : '—',
      is0 ? formatEurCompact(inv.fixedInstallEur) : '—',
      is0 ? (inv.batteryEur > 0 ? formatEurCompact(inv.batteryEur) : '—') : '—',
      is0 ? '—' : formatInt(r.productionKwh),
      is0 ? '—' : formatInt(r.selfNoBattKwh),
      is0 ? '—' : formatInt(r.selfWithBattKwh),
      is0 ? '—' : formatInt(r.exportNoBattKwh),
      is0 ? '—' : formatInt(r.exportWithBattKwh),
      formatTar(r.purchaseEurPerKwh),
      formatTar(r.feedinEurPerKwh),
    ]
    for (const c of cells) {
      doc.text(c, x, y, { maxWidth: colW - 0.5 })
      x += colW
    }
    y += 3.2
  }
  doc.setTextColor(60, 60, 60)
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(5.5)
  doc.text(
    'Vast = vaste installatiepost (€). Zelf/Exp = kWh zonne-zelfv. en restexport; z. / m. = zonder / met thuisbatterij. Zonder accu: z.- en m.-kolommen zijn gelijk. Tarieven: referentie jaar 0, daarna +2% elektriciteitsinflatie per jaar.',
    margin,
    h - 4,
  )
  doc.setTextColor(0, 0, 0)
}

function formatEurCompact(n: number): string {
  return formatNumber(n, 0, 0) + ' €'
}

function formatInt(n: number): string {
  return formatNumber(n, 0, 0)
}

function formatTar(n: number): string {
  return formatNumber(n, 3, 3)
}
