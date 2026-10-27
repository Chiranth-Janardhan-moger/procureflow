import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import type { RFQ } from '../../types'
import { Modal } from '../../components/common/Modal'

interface Props { rfq: RFQ | null; isOpen: boolean; onClose: () => void; onSubmitted: () => void }
export const SubmitQuotationModal: React.FC<Props> = ({ rfq, isOpen, onClose, onSubmitted }) => {
  const [details, setDetails] = useState<RFQ | null>(null)
  const [prices, setPrices] = useState<Record<number, string>>({})
  const [deliveryDays, setDeliveryDays] = useState(7)
  const [warranty, setWarranty] = useState(1)
  const [taxRate, setTaxRate] = useState(18)
  const [discount, setDiscount] = useState(0)
  const [terms, setTerms] = useState('Net 30 Days after GRN')
  const [validity, setValidity] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!isOpen || !rfq) return
    let cancelled = false
    setDetails(null); setPrices({}); setError(''); setLoading(true)
    setDeliveryDays(7); setWarranty(1); setTaxRate(18); setDiscount(0); setNotes(''); setTerms('Net 30 Days after GRN')
    const until = new Date(); until.setDate(until.getDate() + 30); setValidity(until.toISOString().slice(0, 10))
    void api.getRfqById(rfq.id).then(({ rfq: result }) => {
      if (cancelled) return
      if (!['open', 'evaluation'].includes(result.status)) throw new Error('Bidding is closed for this RFQ.')
      if (!result.items?.length) throw new Error('This RFQ has no requested items.')
      setDetails(result)
    }).catch(err => { if (!cancelled) setError(err.message || 'Unable to load RFQ details.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [rfq, isOpen])
  const items = details?.items || []
  const subtotalCents = items.reduce((sum, item) => sum + Math.round(Number(prices[item.id] || 0) * 100) * Number(item.quantity), 0)
  const taxCents = Math.round(subtotalCents * taxRate / 100)
  const finalCents = subtotalCents + taxCents - Math.round(discount * 100)
  const money = (cents: number) => `₹${(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!rfq || !details || details.id !== rfq.id || loading || submitting) return
    if (items.some(item => !Number.isFinite(Number(prices[item.id])) || Number(prices[item.id]) <= 0) || finalCents <= 0) {
      setError('Enter a positive price for every item and a valid discount.'); return
    }
    setSubmitting(true); setError('')
    try {
      await api.submitQuotation(rfq.id, {
        line_items: items.map(item => ({ pr_item_id: item.id, unit_price: Number(prices[item.id]) })),
        tax_rate: taxRate, discount_amount: discount, delivery_days: deliveryDays, warranty_years: warranty,
        payment_terms: terms, validity_date: validity || undefined, notes,
      })
      onSubmitted(); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to submit quotation.') }
    finally { setSubmitting(false) }
  }
  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900'
  return <Modal isOpen={isOpen} onClose={onClose} title={rfq ? `Submit Quotation: ${rfq.rfq_number}` : 'Submit Quotation'} subtitle={rfq?.title} maxWidth="2xl">
    <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {loading && <p>Loading the requested items...</p>}
      <div className="space-y-3">
        {items.map(item => <div key={item.id} className="rounded-xl border border-slate-200 p-3 space-y-2">
          <p className="font-bold">{item.item_name}</p>
          <p className="text-xs">Requested quantity: {item.quantity} · Estimated unit price: ₹{Number(item.estimated_unit_price).toLocaleString('en-IN')}</p>
          {item.specification && <p className="text-xs text-slate-500">{item.specification}</p>}
          <label className="block text-xs font-semibold">Your quoted unit price (₹)
            <input aria-label={`Quoted price for ${item.item_name}`} className={inputClass} type="number" min="0.01" step="0.01" required value={prices[item.id] || ''} onChange={event => setPrices(previous => ({ ...previous, [item.id]: event.target.value }))} />
          </label>
          <p className="text-xs">Line subtotal: {money(Math.round(Number(prices[item.id] || 0) * 100) * Number(item.quantity))}</p>
        </div>)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs">Lead time (days)<input className={inputClass} type="number" min="1" required value={deliveryDays} onChange={e => setDeliveryDays(Number(e.target.value))} /></label>
        <label className="text-xs">Warranty (years)<input className={inputClass} type="number" min="0" step="0.5" value={warranty} onChange={e => setWarranty(Number(e.target.value))} /></label>
        <label className="text-xs">GST / tax (%)<input className={inputClass} type="number" min="0" max="100" step="0.01" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} /></label>
        <label className="text-xs">Discount (₹)<input className={inputClass} type="number" min="0" step="0.01" value={discount} onChange={e => setDiscount(Number(e.target.value))} /></label>
        <label className="text-xs">Payment terms<input className={inputClass} value={terms} onChange={e => setTerms(e.target.value)} /></label>
        <label className="text-xs">Quotation valid until<input className={inputClass} type="date" value={validity} onChange={e => setValidity(e.target.value)} /></label>
      </div>
      <label className="block text-xs">Proposal notes<textarea className={inputClass} rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      <div className="rounded-xl bg-slate-900 p-4 text-white text-sm space-y-2">
        <p>Subtotal: {money(subtotalCents)}</p><p>Tax ({taxRate}%): {money(taxCents)}</p><p>Discount: {money(Math.round(discount * 100))}</p>
        <p className="text-lg font-bold">Final amount: {money(finalCents)}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Cancel</button>
        <button disabled={loading || submitting || !items.length} type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit Commercial Bid'}</button>
      </div>
    </form>
  </Modal>
}
