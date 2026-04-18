import { jsPDF } from 'jspdf'
import { formatEur, formatNumber } from './format'

export function downloadSolarSimPdf(input: {
  title: string
  locationLabel: string
  systemKwp: number
  annualProductionKwh: number
  annualSavingsEur: number
  paybackYears: number
  npv25Eur: number
  totalCostEur: number
}): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 20
  const line = (t: string, gap = 7) => {
    doc.text(t, 20, y)
    y += gap
  }

  doc.setFontSize(18)
  line(input.title, 12)
  doc.setFontSize(11)
  line(`Locatie: ${input.locationLabel}`, 8)
  line(`Vermogen: ${formatNumber(input.systemKwp, 1, 2)} kWp`)
  line(`Jaarproductie: ${formatNumber(input.annualProductionKwh, 0, 0)} kWh`)
  line(`Geschatte jaarlijkse besparing: ${formatEur(input.annualSavingsEur)}`)
  line(`Eenvoudige terugverdientijd: ${formatPayback(input.paybackYears)}`)
  line(`NPV (25 jaar, 3% discont): ${formatEur(input.npv25Eur)}`)
  line(`Geschatte investering: ${formatEur(input.totalCostEur)}`)
  y += 4
  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  line('Dit rapport is indicatief; controleer offertes, nettarieven en technische haalbaarheid.', 5)

  doc.save(`solarsim-belgium-${new Date().toISOString().slice(0, 10)}.pdf`)
}

function formatPayback(y: number): string {
  if (!Number.isFinite(y) || y > 1e6) {
    return 'n.v.t.'
  }
  return `${formatNumber(y, 1, 1)} jaar`
}
