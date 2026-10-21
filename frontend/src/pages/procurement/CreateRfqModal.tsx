import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { PurchaseRequest, Vendor } from '../../types'
import { Modal } from '../../components/common/Modal'
import { Send, Check, Building2, Calendar, AlertCircle } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  preselectedPrId?: number | null
}

export const CreateRfqModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onCreated,
  preselectedPrId,
}) => {
  const [prs, setPrs] = useState<PurchaseRequest[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])

  const [selectedPrId, setSelectedPrId] = useState<number>(preselectedPrId || 0)
  const [title, setTitle] = useState('')
  const [deadline, setDeadline] = useState('')
  const [expectedDelivery, setExpectedDelivery] = useState('')
  const [terms, setTerms] = useState(
    'Standard Net 30 payment terms post Goods Receipt Note verification. Vendor must provide minimum 2-year OEM onsite support. Delivery within 10 days of PO issuance.'
  )
  const [selectedVendorIds, setSelectedVendorIds] = useState<number[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadData()
      const d = new Date()
      d.setDate(d.getDate() + 7)
      setDeadline(d.toISOString().split('T')[0])

      const d2 = new Date()
      d2.setDate(d2.getDate() + 14)
      setExpectedDelivery(d2.toISOString().split('T')[0])
    }
  }, [isOpen])

  const loadData = async () => {
    try {
      const [prRes, vendorRes] = await Promise.all([
        api.getPurchaseRequests(),
        api.getVendors(),
      ])
      const approvedOnly = prRes.requests.filter(
        r => r.status === 'approved' || r.status === 'in_procurement'
      )
      setPrs(approvedOnly)
      setVendors(vendorRes.vendors)

      if (approvedOnly.length > 0) {
        const target = preselectedPrId
          ? approvedOnly.find(p => p.id === preselectedPrId) || approvedOnly[0]
          : approvedOnly[0]

        setSelectedPrId(target.id)
        setTitle(`Request for Quotation: ${target.purpose.slice(0, 60)}`)
      }

      // Default invite all active IT vendors
      setSelectedVendorIds(vendorRes.vendors.slice(0, 3).map(v => v.id))
    } catch (err) {
      console.error(err)
    }
  }

  const toggleVendor = (id: number) => {
    setSelectedVendorIds(prev =>
      prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPrId) {
      setError('Please select an approved Purchase Request.')
      return
    }
    if (!title.trim() || !deadline) {
      setError('Title and bidding deadline are required.')
      return
    }
    if (selectedVendorIds.length === 0) {
      setError('Please select at least one vendor to invite to this tender.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      await api.createRfq({
        pr_id: selectedPrId,
        title,
        deadline,
        expected_delivery_date: expectedDelivery || undefined,
        terms,
        vendor_ids: selectedVendorIds,
      })
      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create RFQ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Request for Quotation (RFQ)"
      subtitle="Publish tender from approved purchase requisition and invite verified vendors"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Linked Approved Purchase Request
          </label>
          <select
            value={selectedPrId}
            onChange={e => {
              const id = Number(e.target.value)
              setSelectedPrId(id)
              const matched = prs.find(p => p.id === id)
              if (matched) setTitle(`RFQ for ${matched.purpose.slice(0, 60)}`)
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {prs.map(p => (
              <option key={p.id} value={p.id}>
                {p.pr_number} — {p.purpose.slice(0, 50)}... (₹{Number(p.total_estimated_cost).toLocaleString('en-IN')})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">RFQ Title / Tender Header</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Quotation Bid Deadline</label>
            <input
              type="date"
              required
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Expected Delivery Date</label>
            <input
              type="date"
              value={expectedDelivery}
              onChange={e => setExpectedDelivery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Procurement Terms & Conditions</label>
          <textarea
            rows={2}
            value={terms}
            onChange={e => setTerms(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Vendors Checkbox Grid */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Select Vendors to Invite ({selectedVendorIds.length} chosen)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
            {vendors.map(v => {
              const isChecked = selectedVendorIds.includes(v.id)
              return (
                <div
                  key={v.id}
                  onClick={() => toggleVendor(v.id)}
                  className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                    isChecked
                      ? 'bg-indigo-50/70 border-indigo-300 text-indigo-900 font-semibold'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center text-slate-600">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="font-bold">{v.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {v.category_name || 'IT'} • {v.rating} ★
                      </div>
                    </div>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200">
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
            <Send className="w-3.5 h-3.5" /> {loading ? 'Publishing...' : 'Publish & Dispatch RFQ'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
