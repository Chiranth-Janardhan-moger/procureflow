import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { RFQ } from '../../types'
import { Modal } from '../../components/common/Modal'
import { Send, AlertCircle, Calculator } from 'lucide-react'

interface Props {
  rfq: RFQ | null
  isOpen: boolean
  onClose: () => void
  onSubmitted: () => void
}

export const SubmitQuotationModal: React.FC<Props> = ({ rfq, isOpen, onClose, onSubmitted }) => {
  const [unitPrice, setUnitPrice] = useState<number>(48000)
  const [quantity, setQuantity] = useState<number>(10)
  const [deliveryDays, setDeliveryDays] = useState<number>(7)
  const [warrantyYears, setWarrantyYears] = useState<number>(3)
  const [taxRate, setTaxRate] = useState<number>(18)
  const [discountAmount, setDiscountAmount] = useState<number>(0)
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days after GRN')
  const [validityDate, setValidityDate] = useState('')
  const [notes, setNotes] = useState(
    'Authorized Platinum Partner. 3-Year Next Business Day onsite service and courier freight included.'
  )

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (rfq) {
      const q = rfq.items?.[0]?.quantity || 10
      setQuantity(q)
      const d = new Date()
      d.setDate(d.getDate() + 30)
      setValidityDate(d.toISOString().split('T')[0])
    }
  }, [rfq])

  const subtotal = unitPrice * quantity
  const taxAmount = Math.round(subtotal * (taxRate / 100))
  const finalAmount = Math.max(0, subtotal + taxAmount - discountAmount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rfq) return

    if (unitPrice <= 0 || deliveryDays <= 0) {
      setError('Please provide a valid unit price and delivery lead time.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await api.submitQuotation(rfq.id, {
        unit_price: unitPrice,
        subtotal,
        tax_amount: taxAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        delivery_days: deliveryDays,
        warranty_years: warrantyYears,
        payment_terms: paymentTerms,
        validity_date: validityDate,
        notes,
      })
      onSubmitted()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to submit quotation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rfq ? `Submit Quotation: ${rfq.rfq_number}` : 'Submit Quotation'}
      subtitle={rfq ? `Bidding for: ${rfq.title}` : ''}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Commercial Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unit Price (₹ / item)
            </label>
            <input
              type="number"
              min="1"
              required
              value={unitPrice}
              onChange={e => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantity Quoted
            </label>
            <input
              type="number"
              min="1"
              disabled
              value={quantity}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-500 bg-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Time (Days)</label>
            <input
              type="number"
              min="1"
              required
              value={deliveryDays}
              onChange={e => setDeliveryDays(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty (Years)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              required
              value={warrantyYears}
              onChange={e => setWarrantyYears(parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">GST / Tax (%)</label>
            <input
              type="number"
              min="0"
              value={taxRate}
              onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
            <input
              type="text"
              value={paymentTerms}
              onChange={e => setPaymentTerms(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Quotation Validity Until</label>
            <input
              type="date"
              value={validityDate}
              onChange={e => setValidityDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Supplier Proposal Notes / Certifications
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Live Calculation Matrix */}
        <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Subtotal ({quantity} units @ ₹{unitPrice.toLocaleString('en-IN')})</span>
            <span className="font-mono text-slate-200">₹{subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>GST Amount ({taxRate}%)</span>
            <span className="font-mono text-slate-200">₹{taxAmount.toLocaleString('en-IN')}</span>
          </div>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              Final Net Payable Amount
            </span>
            <span className="text-xl font-extrabold font-mono text-indigo-400">
              ₹{finalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> {loading ? 'Submitting...' : 'Submit Commercial Bid'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
