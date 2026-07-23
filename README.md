# Advance Property Management — Lease Drafting Tool

Internal staff tool: fill in tenant/property details, get a clean, professionally
worded Rental Agreement PDF, ready to print and sign. No lease data is stored —
each PDF is generated in the browser and downloaded directly.

## Stack

- React + Vite
- Tailwind CSS v4
- pdf-lib (client-side PDF generation)
- No authentication required — use the form immediately.

## 1. Run locally

```bash
npm install
npm run dev
```

Visit the local URL and fill out the lease form. The live preview on the right updates as you type; the "Generate & Download Lease PDF" button produces the full document.

## 2. Deploy (Vercel)

1. Push this project to a GitHub repo.
2. Import it in Vercel (vercel.com/new).
3. Deploy the app.

## Editing the fixed legal language

The clauses that stay the same on every lease (Quiet Enjoyment, Damage to
Premises, Maintenance and Repair, Security, Governing Law, Notice, Cumulative
Rights, Full Disclosure) live as plain strings in `src/lib/pdfGenerator.js`,
one `c.heading(...)` / `c.paragraph(...)` pair per clause. Edit the text
directly there — no template engine, just JS strings — and it applies to
every lease generated afterward.

## Editing the input fields

Form fields are defined in `src/pages/LeaseForm.jsx` (the `DEFAULTS` object and the JSX below it). To add a new field: add it to `DEFAULTS`, add an input in the matching section, and reference `data.yourField` in `pdfGenerator.js` wherever it should appear in the document.
