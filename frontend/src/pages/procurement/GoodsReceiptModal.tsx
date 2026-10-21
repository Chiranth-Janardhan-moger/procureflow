import React, { useState } from 'react'
import { api } from '../../services/api'
import { PurchaseOrder } from '../../types'
import { Modal } from '../../components/common/Modal'
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react'

interface Props {
  po: PurchaseOrder | null
  isOpen: boolean
  onClose: () => void
  onRecorded: () => void
}

export const GoodsReceiptModal: React.FC<Props> = ({ po, isOpen, onClose, onRecorded }) => {
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0])
  const [orderedQty, setOrderedQty] = useState(10)
  const [receivedQty, setReceivedQty] = useState(10)
  const [acceptedQty, setAcceptedQty] = useState(10)
  const [rejectedQty, setRejectedQty] = useState(0)
  const [rejectionReason, setRejectionReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  React.useEffect(() => {
    if (po) {
      const totalQty = po.items?.reduce((s, i) => s + i.quantity, 0) || 10
      setOrderedQty(totalQty)
      setReceivedQty(totalQty)
      setAcceptedQty(totalQty)
      setRejectedQty(0)
      setRejectionReason('')
    }
  }, [po])

  const handleReceivedChange = (val: number) => {
    setReceivedQty(val)
    setAcceptedQty(val - rejectedQty)
  }

  const handleRejectedChange = (val: number) => {
    setRejectedQty(val)
    setAcceptedQty(Math.max(0, receivedQty - val))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!po) return

    if (acceptedQty + rejectedQty !== receivedQty) {
      setError('Accepted quantity plus rejected quantity must match total received quantity.')
      return
    }

    if (rejectedQty > 0 && !rejectionReason.trim()) {
      setError('Please provide a reason for the rejected units (e.g. transit damage, spec mismatch).')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await api.createGoodsReceipt({
        po_id: po.id,
        received_date: receivedDate,
        ordered_qty: orderedQty,
        received_qty: receivedQty,
        accepted_qty: acceptedQty,
        rejected_qty: rejectedQty,
        rejection_reason: rejectionReason || undefined,
      })
      onRecorded()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to record Goods Receipt Note')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={po ? `Generate Goods Receipt Note (GRN): ${po.po_number}` : 'Goods Receipt Note'}
      subtitle={po ? `Physical inspection for delivery from ${po.vendor_name}` : ''}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 font-semibold uppercase">Vendor Supplier</span>
            <div className="text-sm font-bold text-slate-800">{po?.vendor_name}</div>
          </div>
          <div className="text-right">
            <span className="text-slate-400 font-semibold uppercase">PO Order Value</span>
            <div className="text-sm font-mono font-bold text-slate-900">
              ₹{Number(po?.total_amount).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Date</label>
          <input
            type="date"
            required
            value={receivedDate}
            onChange={e => setReceivedDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Ordered Quantity</label>
            <input
              type="number"
              disabled
              value={orderedQty}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-500 bg-slate-100 font-mono font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Actual Received Qty</label>
            <input
              type="number"
              min="1"
              value={receivedQty}
              onChange={e => handleReceivedChange(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div>
            <label className="block text-xs font-bold text-emerald-800 uppercase mb-1">Accepted Units</label>
            <input
              type="number"
              min="0"
              value={acceptedQty}
              onChange={e => setAcceptedQty(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-emerald-300 text-xs text-emerald-900 font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-rose-800 uppercase mb-1">Rejected Units</label>
            <input
              type="number"
              min="0"
              value={rejectedQty}
              onChange={e => handleRejectedChange(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-rose-300 text-xs text-rose-900 font-mono font-bold bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        {rejectedQty > 0 && (
          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Reason for Rejection</span>
            </div>
            <textarea
              rows={2}
              required
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="e.g. Screen bezel cracked during courier transport. Notified vendor for replacement."
              className="w-full p-2.5 rounded-lg border border-rose-300 text-xs text-rose-900 bg-white placeholder-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        )}

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
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> {loading ? 'Recording...' : 'Confirm Goods Receipt (GRN)'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
