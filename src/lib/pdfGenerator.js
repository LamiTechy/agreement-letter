import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const PAGE_WIDTH = 612 // US Letter, points
const PAGE_HEIGHT = 792
const MARGIN = 64
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const INK = rgb(0.106, 0.141, 0.188) // #1B2430
const STONE = rgb(0.541, 0.517, 0.471) // #8A8478

function formatDate(dateStr) {
  if (!dateStr) return '[DATE]'
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function money(n) {
  const num = Number(n)
  if (Number.isNaN(num)) return '$0.00'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function dataUrlToPngBytes(dataUrl) {
  if (!dataUrl?.startsWith('data:image/png;base64,')) return null

  try {
    const base64 = dataUrl.replace('data:image/png;base64,', '')
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes
  } catch {
    return null
  }
}

/**
 * Wraps text to fit within maxWidth, returns array of lines.
 */
function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/)
  const lines = []
  let current = ''
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(trial, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = trial
    }
  }
  if (current) lines.push(current)
  return lines
}

class PageCursor {
  constructor(doc, fonts) {
    this.doc = doc
    this.fonts = fonts
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y = PAGE_HEIGHT - MARGIN
  }

  ensureSpace(height) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      this.y = PAGE_HEIGHT - MARGIN
    }
  }

  heading(text) {
    this.ensureSpace(28)
    this.page.drawText(text, {
      x: MARGIN,
      y: this.y,
      size: 11,
      font: this.fonts.bold,
      color: INK,
    })
    this.y -= 6
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: STONE,
    })
    this.y -= 16
  }

  paragraph(text, { size = 10, gap = 12, font } = {}) {
    const useFont = font || this.fonts.regular
    const lines = wrapText(text, useFont, size, CONTENT_WIDTH)
    for (const line of lines) {
      this.ensureSpace(size + 4)
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font: useFont, color: INK })
      this.y -= size + 4
    }
    this.y -= gap
  }

  spacer(h = 10) {
    this.y -= h
  }
}

/**
 * data shape:
 * {
 *   tenantNames: string,
 *   tenantMailingAddress: string,
 *   premisesAddress: string,
 *   bedrooms: string,
 *   monthlyRent: string,
 *   utilitiesIncluded: string[],
 *   paymentMethod: string,
 *   leaseStartDate: string (yyyy-mm-dd),
 *   securityDeposit: string,
 *   petPolicy: string,
 *   keysProvided: string,
 *   mailboxKeys: string,
 *   keyReplacementFee: string,
 *   lawyerName: string,
 *   landlordSignerName: string,
 * }
 */
export async function generateLeasePdf(data) {
  const doc = await PDFDocument.create()
  doc.setTitle(`Rental Agreement - ${data.tenantNames}`)
  doc.setAuthor('Advance Property Management')

  const regular = await doc.embedFont(StandardFonts.TimesRoman)
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const italic = await doc.embedFont(StandardFonts.TimesRomanItalic)
  const fonts = { regular, bold, italic }

  const c = new PageCursor(doc, fonts)

  // Title
  c.page.drawText('RENTAL AGREEMENT', {
    x: MARGIN,
    y: c.y,
    size: 18,
    font: bold,
    color: INK,
  })
  c.y -= 26

  c.paragraph(
    `This Rental Agreement ("Lease") is entered into by and between Advance Property Management, 8555 Lyra Dr, Columbus, OH 43240 ("Landlord"), and ${data.tenantNames || '[TENANT NAME(S)]'}, of ${data.tenantMailingAddress || '[TENANT MAILING ADDRESS]'} ("Tenant"). Landlord and Tenant may collectively be referred to as the "Parties." This Lease creates joint and several liability in the case of multiple Tenants. The Parties agree as follows:`
  )

  c.heading('1. Premises')
  c.paragraph(
    `Landlord leases to Tenant the ${data.bedrooms || '[NUMBER OF]'}-bedroom residence located at ${data.premisesAddress || '[PREMISES ADDRESS]'} (the "Premises").`
  )

  c.heading('2. Lease Payments')
  const utilitiesText = data.utilitiesIncluded?.length
    ? data.utilitiesIncluded.join(', ')
    : 'none'
  c.paragraph(
    `Payment shall be made via ${data.paymentMethod || '[PAYMENT METHOD]'} in an amount equal to the monthly rent. Tenant agrees to pay Landlord ${money(data.monthlyRent)} per month as rent, which includes the following utilities: ${utilitiesText}.`
  )

  c.heading('3. Term')
  c.paragraph(
    `This is a periodic, month-to-month tenancy commencing at 12:00 noon on ${formatDate(data.leaseStartDate)} and continuing on a month-to-month basis until either Landlord or Tenant provides notice to terminate or extend the tenancy, as permitted by law.`
  )

  c.heading('4. Security Deposit')
  c.paragraph(
    `At signing, Tenant shall deposit with Landlord, in trust, a security deposit of ${money(data.securityDeposit)} as security for Tenant's performance under this Lease and for any damage caused by Tenant, Tenant's family, agents, or visitors to the Premises. Landlord may apply part or all of the deposit toward repair of any such damage; Landlord is not limited to the deposit amount, and Tenant remains liable for any balance. Tenant may not apply or deduct any portion of the deposit from rent at any time, including the final month of the tenancy. If Tenant breaches any term of this Lease, Tenant may forfeit the deposit as permitted by law. The deposit is refundable at the end of the Lease, subject to applicable law and deductions for damage beyond normal wear and tear.`
  )

  c.heading('5. Quiet Enjoyment')
  c.paragraph(
    `Tenant is entitled to quiet enjoyment of the Premises, and Landlord will not interfere with that right so long as Tenant pays rent in a timely manner and performs all other obligations under this Lease.`
  )

  c.heading('6. Use of Premises')
  c.paragraph(
    `Tenant shall use the Premises solely as a private residence. The Premises shall not be used to conduct any business or trade without Landlord's prior written consent. Tenant shall comply with all applicable laws, ordinances, and regulations governing use of the Premises.`
  )

  c.heading('7. Pets')
  c.paragraph(`${data.petPolicy || 'Pets are permitted, subject to Landlord\'s standard pet policy.'}`)

  c.heading('8. Damage to Premises')
  c.paragraph(
    `If the Premises are damaged or destroyed by fire or other casualty not due to Tenant's negligence, rent shall abate for any period the Premises are uninhabitable. If Landlord elects not to repair or rebuild, this Lease shall terminate and rent shall be prorated to the date of the damage, with any unearned prepaid rent refunded to Tenant.`
  )

  c.heading('9. Maintenance and Repair')
  c.paragraph(
    `Tenant shall, at Tenant's expense, keep the Premises in good, clean, and sanitary condition throughout the term of this Lease. Tenant is responsible for repairing any damage to the Premises, fixtures, appliances, or equipment caused by Tenant's misuse, waste, or neglect, or that of Tenant's family, agents, or visitors. No painting or alteration may be made without Landlord's prior written consent. Tenant shall promptly notify Landlord of any damage, defect, or equipment failure, and Landlord will use best efforts to repair or replace the affected item in a timely manner.`
  )

  c.heading('10. Security')
  c.paragraph(
    `Landlord does not provide a security alarm system for the Premises. If an alarm system is present, it is not warranted to be complete or sufficient to protect Tenant or the Premises. Tenant releases Landlord from any loss, damage, claim, or injury resulting from the presence, absence, or failure of any alarm or security system.`
  )

  c.heading('11. Governing Law')
  c.paragraph(`This Lease is governed by and construed in accordance with the laws of the state in which the Premises are located.`)

  c.heading('12. Notice')
  c.paragraph(
    `Any notice required under this Lease shall be in writing and delivered by certified mail (return receipt requested, postage prepaid) or overnight delivery service — to Tenant at the Premises, and to Landlord at the address for payment of rent. Either Party may update its notice address by providing written notice as described above.`
  )

  c.heading('13. Cumulative Rights')
  c.paragraph(`The rights of Landlord and Tenant under this Lease are cumulative and are not exclusive of any other right or remedy, unless otherwise required by law.`)

  c.heading('14. Keys')
  c.paragraph(
    `Tenant will be issued ${data.keysProvided || '2'} key(s) to the Premises and ${data.mailboxKeys || '1'} mailbox key(s). Tenant will be charged ${money(data.keyReplacementFee || 30)} if all keys are not returned to Landlord upon termination of this Lease.`
  )

  c.heading('15. Full Disclosure')
  c.paragraph(
    `By signing below, Tenant states that all questions about this Lease have been answered and that Tenant fully understands the provisions, obligations, and responsibilities described herein, and agrees to fulfill those obligations or bear the legal and financial consequences of any violation of this Agreement.`
  )

  // Signature block
  c.ensureSpace(220)
  c.spacer(6)
  c.page.drawText('Signatures', { x: MARGIN, y: c.y, size: 12, font: bold, color: INK })
  c.y -= 20

  const rowH = 100
  const col1W = 200
  const drawSigRow = async (label, signerName, signatureDataUrl) => {
    c.ensureSpace(rowH)
    const top = c.y
    c.page.drawRectangle({
      x: MARGIN,
      y: top - rowH,
      width: CONTENT_WIDTH,
      height: rowH,
      borderColor: STONE,
      borderWidth: 0.75,
    })
    c.page.drawLine({
      start: { x: MARGIN + col1W, y: top },
      end: { x: MARGIN + col1W, y: top - rowH },
      thickness: 0.75,
      color: STONE,
    })
    c.page.drawText(label, { x: MARGIN + 10, y: top - 18, size: 10, font: bold, color: INK })
    if (signerName) {
      c.page.drawText(signerName, { x: MARGIN + 10, y: top - 34, size: 10, font: regular, color: INK })
    }

    const sigBoxX = MARGIN + col1W + 10
    const sigBoxWidth = CONTENT_WIDTH - col1W - 20
    const sigBoxHeight = rowH - 20
    c.page.drawRectangle({
      x: sigBoxX,
      y: top - rowH + 10,
      width: sigBoxWidth,
      height: sigBoxHeight,
      borderColor: STONE,
      borderWidth: 0.5,
    })

    if (signatureDataUrl) {
      try {
        const pngBytes = dataUrlToPngBytes(signatureDataUrl)
        if (!pngBytes) throw new Error('Invalid signature data URL')

        const image = await doc.embedPng(pngBytes)
        const maxWidth = sigBoxWidth - 12
        const maxHeight = sigBoxHeight - 12
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1)
        const imgWidth = image.width * scale
        const imgHeight = image.height * scale
        const imgX = sigBoxX + 6 + (maxWidth - imgWidth) / 2
        const imgY = top - 10 - imgHeight - (sigBoxHeight - imgHeight) / 2
        c.page.drawImage(image, { x: imgX, y: imgY, width: imgWidth, height: imgHeight })
      } catch (err) {
        console.error('Signature embed failed:', err)
        c.page.drawText('Invalid signature image', { x: sigBoxX + 6, y: top - 40, size: 8, font: regular, color: rgb(1, 0, 0) })
      }
    } else {
      c.page.drawText('X', { x: sigBoxX + 4, y: top - 30, size: 10, font: italic, color: STONE })
      c.page.drawLine({
        start: { x: sigBoxX + 20, y: top - 32 },
        end: { x: sigBoxX + sigBoxWidth - 10, y: top - 32 },
        thickness: 0.75,
        color: STONE,
      })
    }

    c.y = top - rowH - 4
  }

  await drawSigRow('Landlord: Advance Property Management', data.landlordSignerName, data.landlordSignature)
  if (data.lawyerName || data.lawyerSignature) {
    await drawSigRow('Lawyer', data.lawyerName, data.lawyerSignature)
  }
  await drawSigRow('Tenant', data.tenantNames, data.tenantSignature)

  c.spacer(10)
  c.paragraph(`Date: ${formatDate(data.leaseStartDate)}`, { size: 9, font: italic, gap: 0 })

  const bytes = await doc.save()
  return bytes
}

export function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
