// src/components/public/sales-point/receipt.tsx


import type { CartItem, Customer } from '@renderer/components/public/types/sales'
import { formatCurrency, formatDateTime } from '@renderer/components/public/types/utils'
import React, { useCallback, useRef, useState } from 'react'


// ─── Types ────────────────────────────────────────────────────────────────
type ReceiptData = {
  receiptNumber: string
  saleIds: number[]
  items: CartItem[]
  customer: Customer | null
  paymentMethod: string
  amountPaid: number
  totalPrice: number
  isDebt: boolean
  remainingBalance: number
  change: number
  referenceNumber: string
  description: string
  soldAt: number
  partialErrors?: string[]
}

interface ReceiptProps {
  receiptData: ReceiptData
  onClose: () => void
  onNewSale: () => void
}

// ─── HTML escape ──────────────────────────────────────────────────────────
function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Build self-contained thermal receipt HTML ────────────────────────────
// Targets 80mm paper width (~302px at 96dpi).
// Uses @page size so the OS print dialog defaults correctly.
// No external resources — fully self-contained.
function buildThermalHTML(d: ReceiptData): string {
  const itemRows = d.items
    .map((item, idx) => {
      const lineTotal = item.unitPrice * item.quantity
      const isLast = idx === d.items.length - 1
      return `
      <div class="item">
        <div class="item-name">${esc(item.productName)}</div>
        <div class="item-sub">${esc(item.sku.sku_name)}${item.sku.code ? ` &middot; ${esc(item.sku.code)}` : ''}</div>
        ${item.purchase.batch_number ? `<div class="item-meta">Batch: ${esc(item.purchase.batch_number)}</div>` : ''}
        <div class="row">
          <span>${esc(item.quantity)} &times; ${esc(formatCurrency(item.unitPrice))}</span>
          <span class="bold">${esc(formatCurrency(lineTotal))}</span>
        </div>
        ${!isLast ? '<div class="dots"></div>' : ''}
      </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt ${esc(d.receiptNumber)}</title>
<style>
  /* ── Page: 80mm thermal roll ─────────────────────────────────────── */
  @page {
    size: 80mm auto;   /* width fixed, height grows with content     */
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #000;
    background: #fff;
    width: 80mm;
    padding: 3mm 4mm 10mm 4mm;   /* bottom pad so last line isn't cut */
  }

  /* ── Layout helpers ──────────────────────────────────────────────── */
  .center  { text-align: center; }
  .bold    { font-weight: bold; }
  .large   { font-size: 16px; }
  .xlarge  { font-size: 20px; }
  .small   { font-size: 11px; }
  .xsmall  { font-size: 9px;  color: #555; }
  .upper   { text-transform: uppercase; letter-spacing: 1px; }
  .section { margin-bottom: 5px; }

  /* row = two columns: left grows, right shrinks */
  .row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .row > span:first-child { flex: 1; padding-right: 4px; }

  /* ── Dividers ────────────────────────────────────────────────────── */
  .dash   { border-top: 1px dashed #000; margin: 5px 0; }
  .solid  { border-top: 1px solid  #000; margin: 5px 0; }
  .double { border-top: 3px double #000; margin: 6px 0; }
  .dots   { border-top: 1px dotted #888; margin: 4px 0; }

  /* ── Items ───────────────────────────────────────────────────────── */
  .item-name { font-weight: bold; word-break: break-word; }
  .item-sub  { font-size: 11px; }
  .item-meta { font-size: 10px; color: #555; }
  .item      { margin-bottom: 2px; }

  /* ── Debt box ────────────────────────────────────────────────────── */
  .debt-box {
    border: 2px solid #000;
    padding: 5px 6px;
    text-align: center;
    margin: 5px 0;
  }
  .debt-amount { font-size: 18px; font-weight: bold; }
</style>
</head>
<body>

  <!-- Header -->
  <div class="section center">
    <div class="xlarge bold">RECEIPT</div>
    <div class="small" style="margin-top:2px">${esc(formatDateTime(d.soldAt))}</div>
    <div class="xsmall">Ref: ${esc(d.receiptNumber)}</div>
  </div>

  <div class="dash"></div>

  <!-- Customer -->
  <div class="section">
    <div class="xsmall upper">Customer</div>
    <div class="bold">${esc(d.customer ? d.customer.name : 'Walk-in Customer')}</div>
    ${d.customer?.phone ? `<div class="small">${esc(d.customer.phone)}</div>` : ''}
    ${d.customer?.email ? `<div class="small">${esc(d.customer.email)}</div>` : ''}
  </div>

  <div class="dash"></div>

  <!-- Items -->
  <div class="section">
    <div class="xsmall upper" style="margin-bottom:3px">Items</div>
    ${itemRows}
  </div>

  <div class="solid"></div>

  <!-- Total -->
  <div class="section row large">
    <span class="bold">TOTAL</span>
    <span class="bold">${esc(formatCurrency(d.totalPrice))}</span>
  </div>

  <div class="dash"></div>

  <!-- Payment -->
  <div class="section">
    <div class="xsmall upper" style="margin-bottom:3px">Payment</div>
    <div class="row">
      <span>Method</span>
      <span class="bold">${esc(d.paymentMethod.toUpperCase())}</span>
    </div>
    <div class="row">
      <span>Amount Paid</span>
      <span class="bold">${esc(formatCurrency(d.amountPaid))}</span>
    </div>
    ${d.change > 0 ? `
    <div class="row bold">
      <span>Change</span>
      <span>${esc(formatCurrency(d.change))}</span>
    </div>` : ''}
    ${d.referenceNumber ? `
    <div class="row xsmall">
      <span>Reference</span>
      <span>${esc(d.referenceNumber)}</span>
    </div>` : ''}
  </div>

  ${d.isDebt && d.remainingBalance > 0 ? `
  <div class="double"></div>
  <div class="debt-box">
    <div class="xsmall upper">Balance Due</div>
    <div class="debt-amount">${esc(formatCurrency(d.remainingBalance))}</div>
    <div class="xsmall">Please pay at your earliest convenience</div>
  </div>
  <div class="double"></div>
  ` : '<div class="dash"></div>'}

  ${d.description ? `
  <div class="section">
    <div class="xsmall upper">Note</div>
    <div class="small">${esc(d.description)}</div>
  </div>
  <div class="dash"></div>
  ` : ''}

  <!-- Footer -->
  <div class="center xsmall" style="margin-top:6px; line-height:2">
    Thank you for your business!<br>
    ${esc(d.receiptNumber)}
  </div>

</body>
</html>`
}

// ─── Save as file via data URI (CSP-safe — no blob: URL needed) ──────────
function downloadFile(content: string, filename: string, mime: string) {
  // Use a data URI instead of a blob URL so CSP doesn't block it.
  // btoa only handles Latin-1; use encodeURIComponent for full Unicode support.
  const dataUri = `data:${mime};charset=utf-8,${encodeURIComponent(content)}`
  const a = document.createElement('a')
  a.href = dataUri
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ─── Component ────────────────────────────────────────────────────────────
export const Receipt: React.FC<ReceiptProps> = ({ receiptData, onClose, onNewSale }) => {
  // The iframe lives permanently in the DOM (hidden).
  // We write receipt HTML into it, wait for load, then call .print().
  // This is the only approach that reliably works in Electron without
  // needing any IPC or window.open.
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [printing, setPrinting] = useState(false)
  const [saved, setSaved] = useState(false)

  const { receiptNumber, items, customer, paymentMethod, amountPaid,
    totalPrice, isDebt, remainingBalance, change, referenceNumber,
    description, soldAt, partialErrors } = receiptData

  // ── Print via srcdoc (CSP-safe: no blob URLs, no doc.write) ────────────
  // srcdoc is permitted by 'self' CSP and works in Electron without any IPC.
  // The OS print dialog will appear with the USB thermal printer listed.
  const handlePrint = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    setPrinting(true)
    const html = buildThermalHTML(receiptData)

    // Setting srcdoc triggers a load event — no blob URL needed
    iframe.srcdoc = html

    const onLoad = () => {
      iframe.removeEventListener('load', onLoad)
      try {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      } catch (e) {
        console.error('iframe print failed:', e)
      }
      setPrinting(false)
    }

    iframe.addEventListener('load', onLoad)
  }, [receiptData])

  // ── Save as HTML (re-openable in browser for reprinting) ─────────────
  const handleSave = () => {
    downloadFile(
      buildThermalHTML(receiptData),
      `receipt-${receiptNumber}.html`,
      'text/html'
    )
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <>
      {/* Hidden print iframe — must be in the real DOM, not inside the modal */}
      <iframe
        ref={iframeRef}
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: 0, height: 0,
          border: 'none',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
        title="receipt-print-frame"
      />

      {/* Modal overlay */}
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Sale receipt"
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden
          flex flex-col max-h-[92vh] border border-slate-200">

          {/* ── Success header ────────────────────────────────────── */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white text-center shrink-0">
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
              <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">Sale Complete!</h2>
            <p className="text-blue-200 text-sm mt-1">Receipt #{receiptNumber}</p>
            {isDebt && (
              <div className="mt-2 bg-amber-400/30 text-amber-200 text-xs font-bold px-3 py-1.5 rounded-full inline-block">
                ⚠️ Balance Due: {formatCurrency(remainingBalance)}
              </div>
            )}
          </div>

          {/* ── Partial errors ─────────────────────────────────────── */}
          {partialErrors && partialErrors.length > 0 && (
            <div className="px-5 pt-4 shrink-0">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                <p className="font-bold mb-1">Some items had errors:</p>
                {partialErrors.map((e, i) => <p key={i}>• {e}</p>)}
              </div>
            </div>
          )}

          {/* ── Receipt preview (mimics thermal look) ─────────────── */}
          <div className="flex-1 overflow-y-auto p-5">
            <div
              className="font-mono text-xs bg-white rounded-xl border border-dashed border-slate-300 p-4"
              style={{ lineHeight: 1.65 }}
            >
              <p className="text-center font-bold text-sm">* * * RECEIPT * * *</p>
              <p className="text-center text-slate-500" style={{ fontSize: 10 }}>{formatDateTime(soldAt)}</p>
              <p className="text-center text-slate-400" style={{ fontSize: 10 }}>Ref: {receiptNumber}</p>

              <RuleDash />

              <p className="text-slate-400 uppercase tracking-widest" style={{ fontSize: 9 }}>Customer</p>
              <p className="font-bold">{customer ? customer.name : 'Walk-in Customer'}</p>
              {customer?.phone && <p className="text-slate-500 text-xs">{customer.phone}</p>}

              <RuleDash />

              <p className="text-slate-400 uppercase tracking-widest mb-1" style={{ fontSize: 9 }}>Items</p>
              {items.map((item, idx) => {
                const lineTotal = item.unitPrice * item.quantity
                return (
                  <div key={item.cartId}>
                    <p className="font-bold leading-tight">{item.productName}</p>
                    <p className="text-slate-500" style={{ fontSize: 10 }}>
                      {item.sku.sku_name}{item.sku.code ? ` · ${item.sku.code}` : ''}
                    </p>
                    {item.purchase.batch_number && (
                      <p className="text-slate-400" style={{ fontSize: 9 }}>Batch: {item.purchase.batch_number}</p>
                    )}
                    <div className="flex justify-between">
                      <span>{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                      <span className="font-bold">{formatCurrency(lineTotal)}</span>
                    </div>
                    {idx < items.length - 1 && <RuleDots />}
                  </div>
                )
              })}

              <RuleSolid />

              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL</span>
                <span>{formatCurrency(totalPrice)}</span>
              </div>

              <RuleDash />

              <p className="text-slate-400 uppercase tracking-widest mb-1" style={{ fontSize: 9 }}>Payment</p>
              <PreviewRow label="Method" value={paymentMethod.toUpperCase()} />
              <PreviewRow label="Amount Paid" value={formatCurrency(amountPaid)} />
              {change > 0 && <PreviewRow label="Change" value={formatCurrency(change)} bold />}
              {referenceNumber && <PreviewRow label="Ref" value={referenceNumber} />}

              {isDebt && remainingBalance > 0 && (
                <>
                  <RuleDouble />
                  <p className="text-center font-bold">** BALANCE DUE **</p>
                  <p className="text-center font-bold text-base">{formatCurrency(remainingBalance)}</p>
                  <RuleDouble />
                </>
              )}

              {description && (
                <>
                  <RuleDash />
                  <p className="text-slate-400 uppercase tracking-widest" style={{ fontSize: 9 }}>Note</p>
                  <p style={{ fontSize: 10 }}>{description}</p>
                </>
              )}

              <RuleDash />
              <p className="text-center text-slate-400" style={{ fontSize: 9, marginTop: 4 }}>
                Thank you for your business!
              </p>
            </div>
          </div>

          {/* ── Actions ───────────────────────────────────────────── */}
          <div className="p-4 border-t border-slate-100 space-y-2 shrink-0">

            {/* Print + Save */}
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                disabled={printing}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold
                  text-blue-600 border-2 border-blue-300 rounded-xl hover:bg-blue-50
                  disabled:opacity-60 transition-colors"
              >
                {printing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Sending to printer…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Receipt
                  </>
                )}
              </button>

              <button
                onClick={handleSave}
                title="Save as HTML — open in browser to reprint"
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold
                  text-slate-600 border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                {saved ? (
                  <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {saved ? 'Saved!' : 'Save'}
              </button>
            </div>

            {/* New sale + close */}
            <div className="flex gap-2">
              <button onClick={onNewSale}
                className="flex-1 py-3 text-sm font-bold bg-blue-600 text-white rounded-xl
                  hover:bg-blue-700 transition-colors">
                New Sale
              </button>
              <button onClick={onClose}
                className="px-5 py-3 text-sm text-slate-500 hover:text-slate-700
                  hover:bg-slate-100 rounded-xl transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Preview rule helpers ──────────────────────────────────────────────────
const RuleDash  = () => <div style={{ borderTop: '1px dashed #bbb', margin: '5px 0' }} />
const RuleDots  = () => <div style={{ borderTop: '1px dotted #ccc', margin: '4px 0' }} />
const RuleSolid = () => <div style={{ borderTop: '1px solid  #000', margin: '5px 0' }} />
const RuleDouble= () => <div style={{ borderTop: '3px double #000', margin: '6px 0' }} />

const PreviewRow: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
  <div className="flex justify-between" style={{ fontSize: 11 }}>
    <span className="text-slate-500">{label}</span>
    <span className={bold ? 'font-bold' : ''}>{value}</span>
  </div>
)