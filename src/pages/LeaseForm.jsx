import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { generateLeasePdf, downloadPdf } from '../lib/pdfGenerator'

const UTILITY_OPTIONS = ['Electricity', 'Water', 'Internet access', 'Washing machine', 'Waste disposal', 'Gas']

const DEFAULTS = {
  tenantNames: '',
  tenantMailingAddress: '',
  premisesAddress: '',
  bedrooms: '3',
  monthlyRent: '',
  utilitiesIncluded: [...UTILITY_OPTIONS],
  paymentMethod: '',
  leaseStartDate: '',
  securityDeposit: '',
  petsAllowed: true,
  petPolicy: '',
  keysProvided: '2',
  mailboxKeys: '1',
  keyReplacementFee: '30',
  lawyerName: '',
  landlordSignerName: '',
  landlordSignature: '',
  lawyerSignature: '',
  tenantSignature: '',
}

function Field({ label, children, hint }) {
  return (
    <label className="block mb-5">
      <span className="font-mono text-[11px] uppercase tracking-wide text-stone">{label}</span>
      {children}
      {hint && <span className="block text-xs text-stone-light mt-1">{hint}</span>}
    </label>
  )
}

const inputClass =
  'mt-1 w-full border border-ledger-line rounded-sm px-3 py-2 text-ink bg-white focus:border-slate outline-none text-sm'

function money(n) {
  const num = Number(n)
  if (!n || Number.isNaN(num)) return '$0.00'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDatePreview(dateStr) {
  if (!dateStr) return '[start date]'
  const d = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const SignaturePad = forwardRef(function SignaturePad({ label, value, onChange, hint }, ref) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const lastPoint = useRef([0, 0])

  useImperativeHandle(ref, () => ({
    getDataUrl() {
      const canvas = canvasRef.current
      if (!canvas) return ''
      return canvas.toDataURL('image/png')
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (value) {
      const image = new Image()
      image.onload = () => {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      }
      image.src = value
    }
  }, [value])

  function updateValue() {
    const canvas = canvasRef.current
    if (!canvas) return
    onChange(canvas.toDataURL('image/png'))
  }

  function handlePointerDown(event) {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    drawing.current = true
    lastPoint.current = [event.clientX - rect.left, event.clientY - rect.top]
    canvas.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event) {
    const canvas = canvasRef.current
    if (!canvas || !drawing.current) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    ctx.strokeStyle = '#1b2430'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(lastPoint.current[0], lastPoint.current[1])
    ctx.lineTo(x, y)
    ctx.stroke()
    lastPoint.current = [x, y]
  }

  function handlePointerUp(event) {
    if (!drawing.current) return
    drawing.current = false
    updateValue()
    const canvas = canvasRef.current
    if (canvas) canvas.releasePointerCapture(event.pointerId)
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <Field label={label} hint={hint}>
      <div className="rounded-sm border border-ledger-line overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={500}
          height={180}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-44 touch-none"
          style={{ touchAction: 'none' }}
        />
      </div>
      <button
        type="button"
        onClick={clearCanvas}
        className="mt-2 text-sm text-slate-700 hover:text-ink"
      >
        Clear signature
      </button>
    </Field>
  )
})

export default function LeaseForm() {
  const [data, setData] = useState(DEFAULTS)
  const [generating, setGenerating] = useState(false)

  const landlordSigRef = useRef(null)
  const lawyerSigRef = useRef(null)
  const tenantSigRef = useRef(null)

  function set(key, value) {
    setData((d) => ({ ...d, [key]: value }))
  }

  function toggleUtility(name) {
    setData((d) => {
      const has = d.utilitiesIncluded.includes(name)
      return {
        ...d,
        utilitiesIncluded: has
          ? d.utilitiesIncluded.filter((u) => u !== name)
          : [...d.utilitiesIncluded, name],
      }
    })
  }

  async function handleGenerate(e) {
    e.preventDefault()
    setGenerating(true)
    try {
      const landlordSignature =
        landlordSigRef.current?.getDataUrl() || data.landlordSignature
      const lawyerSignature =
        lawyerSigRef.current?.getDataUrl() || data.lawyerSignature
      const tenantSignature =
        tenantSigRef.current?.getDataUrl() || data.tenantSignature

      const payload = {
        ...data,
        landlordSignature,
        lawyerSignature,
        tenantSignature,
        petPolicy: data.petsAllowed
          ? data.petPolicy || 'Pets are permitted, subject to Landlord\'s standard pet policy.'
          : 'Pets are not permitted on the Premises.',
      }
      const bytes = await generateLeasePdf(payload)
      const safeName = (data.tenantNames || 'tenant').replace(/[^a-z0-9]+/gi, '_').toLowerCase()
      downloadPdf(bytes, `lease_${safeName}.pdf`)
    } finally {
      setGenerating(false)
    }
  }

  const totalDeposit = data.securityDeposit || 0

  return (
    <div className="min-h-screen bg-ledger">
      <header className="border-b border-ledger-line bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.2em] text-stone uppercase">
              Advance Property Management
            </p>
            <h1 className="font-display text-xl text-ink">Lease Drafting</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Ledger form */}
        <form onSubmit={handleGenerate}>
          <section className="mb-8">
            <h2 className="font-display text-lg text-ink border-b border-ledger-line pb-2 mb-4">
              Tenant
            </h2>
            <Field label="Tenant name(s)">
              <input
                required
                className={inputClass}
                value={data.tenantNames}
                onChange={(e) => set('tenantNames', e.target.value)}
                placeholder="Nathan Durham"
              />
            </Field>
            <Field label="Tenant mailing address" hint="Current address before move-in">
              <input
                required
                className={inputClass}
                value={data.tenantMailingAddress}
                onChange={(e) => set('tenantMailingAddress', e.target.value)}
                placeholder="7749 Knue Rd Apt A, Indianapolis, IN 46250"
              />
            </Field>
          </section>

          <section className="mb-8">
            <h2 className="font-display text-lg text-ink border-b border-ledger-line pb-2 mb-4">
              Premises
            </h2>
            <Field label="Property address">
              <input
                required
                className={inputClass}
                value={data.premisesAddress}
                onChange={(e) => set('premisesAddress', e.target.value)}
                placeholder="318 N Harrison St, Greenfield, IN 46140"
              />
            </Field>
            <Field label="Bedrooms">
              <input
                required
                type="number"
                min="0"
                className={inputClass}
                value={data.bedrooms}
                onChange={(e) => set('bedrooms', e.target.value)}
              />
            </Field>
          </section>

          <section className="mb-8">
            <h2 className="font-display text-lg text-ink border-b border-ledger-line pb-2 mb-4">
              Payment
            </h2>
            <Field label="Monthly rent (USD)">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={data.monthlyRent}
                onChange={(e) => set('monthlyRent', e.target.value)}
                placeholder="1500"
              />
            </Field>
            <Field label="Payment method">
              <input
                required
                className={inputClass}
                value={data.paymentMethod}
                onChange={(e) => set('paymentMethod', e.target.value)}
                placeholder="Zelle, Chime, bank transfer, etc."
              />
            </Field>
            <Field label="Utilities included in rent">
              <div className="mt-2 grid grid-cols-2 gap-2">
                {UTILITY_OPTIONS.map((u) => (
                  <label key={u} className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={data.utilitiesIncluded.includes(u)}
                      onChange={() => toggleUtility(u)}
                      className="accent-[#3D5A73]"
                    />
                    {u}
                  </label>
                ))}
              </div>
            </Field>
          </section>

          <section className="mb-8">
            <h2 className="font-display text-lg text-ink border-b border-ledger-line pb-2 mb-4">
              Term &amp; Deposit
            </h2>
            <Field label="Lease start date">
              <input
                required
                type="date"
                className={inputClass}
                value={data.leaseStartDate}
                onChange={(e) => set('leaseStartDate', e.target.value)}
              />
            </Field>
            <Field label="Security deposit (USD)" hint="Total deposit collected at signing">
              <input
                required
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={data.securityDeposit}
                onChange={(e) => set('securityDeposit', e.target.value)}
                placeholder="2070"
              />
            </Field>
          </section>

          <section className="mb-8">
            <h2 className="font-display text-lg text-ink border-b border-ledger-line pb-2 mb-4">
              Policies
            </h2>
            <Field label="Pets">
              <div className="mt-2 flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={data.petsAllowed}
                    onChange={() => set('petsAllowed', true)}
                  />
                  Allowed
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!data.petsAllowed}
                    onChange={() => set('petsAllowed', false)}
                  />
                  Not allowed
                </label>
              </div>
            </Field>
            <Field label="Keys provided">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={data.keysProvided}
                onChange={(e) => set('keysProvided', e.target.value)}
              />
            </Field>
            <Field label="Mailbox keys provided">
              <input
                type="number"
                min="0"
                className={inputClass}
                value={data.mailboxKeys}
                onChange={(e) => set('mailboxKeys', e.target.value)}
              />
            </Field>
            <Field label="Key replacement fee (USD)">
              <input
                type="number"
                min="0"
                step="0.01"
                className={inputClass}
                value={data.keyReplacementFee}
                onChange={(e) => set('keyReplacementFee', e.target.value)}
              />
            </Field>
          </section>

          <section className="mb-10">
            <h2 className="font-display text-lg text-ink border-b border-ledger-line pb-2 mb-4">
              Signatures
            </h2>
            <Field label="Landlord signer name">
              <input
                className={inputClass}
                value={data.landlordSignerName}
                onChange={(e) => set('landlordSignerName', e.target.value)}
                placeholder="Name of authorized signer"
              />
            </Field>
            <SignaturePad
              ref={landlordSigRef}
              label="Landlord signature"
              value={data.landlordSignature}
              onChange={(value) => set('landlordSignature', value)}
              hint="Draw the landlord's signature inside the box"
            />
            <Field label="Lawyer name" hint="Leave blank to omit this row">
              <input
                className={inputClass}
                value={data.lawyerName}
                onChange={(e) => set('lawyerName', e.target.value)}
                placeholder="Esq. John Frederick"
              />
            </Field>
            <SignaturePad
              ref={lawyerSigRef}
              label="Lawyer signature"
              value={data.lawyerSignature}
              onChange={(value) => set('lawyerSignature', value)}
              hint="Draw the lawyer's signature inside the box"
            />
            <Field label="Tenant signature">
              <input
                className={inputClass}
                value={data.tenantNames}
                readOnly
                placeholder="Tenant name from above"
              />
            </Field>
            <SignaturePad
              ref={tenantSigRef}
              label="Tenant signature"
              value={data.tenantSignature}
              onChange={(value) => set('tenantSignature', value)}
              hint="Draw the tenant's signature inside the box"
            />
          </section>

          <button
            type="submit"
            disabled={generating}
            className="w-full bg-slate hover:bg-slate-dark disabled:opacity-60 text-white font-medium py-3 rounded-sm transition-colors"
          >
            {generating ? 'Preparing PDF…' : 'Generate & Download Lease PDF'}
          </button>
        </form>

        {/* Live paper preview */}
        <div className="lg:sticky lg:top-10 self-start">
          <p className="font-mono text-[11px] uppercase tracking-wide text-stone mb-2">
            Live Preview
          </p>
          <div className="bg-white border border-ledger-line shadow-sm rounded-sm p-10 font-display text-ink">
            <p className="text-center font-semibold text-lg mb-6">RENTAL AGREEMENT</p>
            <p className="text-sm leading-relaxed mb-4">
              This Rental Agreement is entered into by and between{' '}
              <span className="font-semibold">Advance Property Management</span>, 8555 Lyra Dr,
              Columbus, OH 43240, and{' '}
              <span className="font-semibold">{data.tenantNames || '[Tenant Name]'}</span>, of{' '}
              {data.tenantMailingAddress || '[Tenant Mailing Address]'}.
            </p>
            <p className="text-sm leading-relaxed mb-4">
              Landlord leases the {data.bedrooms || '[#]'}-bedroom residence at{' '}
              <span className="font-semibold">{data.premisesAddress || '[Premises Address]'}</span>.
            </p>
            <p className="text-sm leading-relaxed mb-4">
              Rent is <span className="font-semibold">{money(data.monthlyRent)}</span> per month,
              paid via {data.paymentMethod || '[payment method]'}, including:{' '}
              {data.utilitiesIncluded.join(', ') || 'none'}.
            </p>
            <p className="text-sm leading-relaxed mb-4">
              Tenancy begins {formatDatePreview(data.leaseStartDate)}, month-to-month.
            </p>
            <p className="text-sm leading-relaxed mb-4">
              Security deposit: <span className="font-semibold">{money(totalDeposit)}</span>.
            </p>
            <p className="text-sm leading-relaxed mb-4">
              Pets: {data.petsAllowed ? 'Allowed' : 'Not allowed'}.
            </p>
            <p className="text-sm leading-relaxed mb-6">
              Keys: {data.keysProvided || '0'} unit key(s), {data.mailboxKeys || '0'} mailbox
              key(s). Replacement fee {money(data.keyReplacementFee)}.
            </p>
            <div className="border-t border-ledger-line pt-4 text-xs text-stone">
              Full legal text — Quiet Enjoyment, Damage to Premises, Maintenance, Security,
              Governing Law, Notice, Cumulative Rights, and Full Disclosure clauses — is included
              in the generated PDF.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
