import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { PurchaseRequest, RFQ } from '../../types'
import { StatCard } from '../../components/common/StatCard'
import { Badge } from '../../components/common/Badge'
import { Modal } from '../../components/common/Modal'
import {
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Scale,
  Check,
  X,
  FileText,
  AlertCircle,
  Eye,
} from 'lucide-react'

export const ManagerDashboard: React.FC = () => {
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [loading, setLoading] = useState(true)

  // Approval Modal state
  const [selectedPr, setSelectedPr] = useState<PurchaseRequest | null>(null)
  const [remarks, setRemarks] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Vendor Approval Modal state
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null)
  const [vendorModalOpen, setVendorModalOpen] = useState(false)
  const [returnReason, setReturnReason] = useState('')
  const [selectedVendorQuoteId, setSelectedVendorQuoteId] = useState<number | null>(null)
  const [selectionReason, setSelectionReason] = useState('')

  useEffect(() => {
    loadData()
    const refresh = () => { void loadData() }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [prRes, rfqRes] = await Promise.all([
        api.getPurchaseRequests(),
        api.getRfqs(),
      ])
      setRequests(prRes.requests)
      setRfqs(rfqRes.rfqs)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Pending PRs
  const pendingPrs = requests.filter(r => r.status === 'pending')
  const approvedPrs = requests.filter(r => r.status === 'approved' || r.status === 'in_procurement' || r.status === 'completed')
  const rejectedPrs = requests.filter(r => r.status === 'rejected')

  // RFQs with a recommended vendor awaiting manager sign-off
  const pendingVendorApprovals = rfqs.filter(r => r.status === 'evaluation' && r.has_recommendation)

  const totalSpend = approvedPrs.reduce((sum, r) => sum + Number(r.total_estimated_cost), 0)

  const handlePrDecision = async (status: 'approved' | 'rejected') => {
    if (!selectedPr) return
    setActionLoading(true)
    try {
      await api.updatePurchaseRequestStatus(selectedPr.id, status, remarks || undefined)
      setModalOpen(false)
      setSelectedPr(null)
      setRemarks('')
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to update request')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReturnRecommendation = async () => {
    if (!selectedRfq || !returnReason.trim()) { alert('Enter a reason for sending the recommendation back.'); return }
    setActionLoading(true)
    try {
      await api.returnVendorRecommendation(selectedRfq.id, returnReason.trim())
      setVendorModalOpen(false); setSelectedRfq(null); setReturnReason('')
      await loadData()
    } catch (error) { alert(error instanceof Error ? error.message : 'Unable to send back recommendation.') }
    finally { setActionLoading(false) }
  }

  const handleApproveVendorSelection = async (rfq: RFQ) => {
    const recommendedQuote = rfq.quotations?.find(q => q.is_recommended)
    const selectedQuote = rfq.quotations?.find(q => q.id === selectedVendorQuoteId)
    if (!recommendedQuote || !selectedQuote) return
    if (selectedQuote.id !== recommendedQuote.id && !selectionReason.trim()) {
      alert('Explain why you are choosing another vendor.'); return
    }

    setActionLoading(true)
    try {
      await api.createPurchaseOrder({
        quote_id: selectedQuote.id,
        expected_delivery: rfq.expected_delivery_date || new Date().toISOString().split('T')[0],
        selection_reason: selectionReason.trim() || undefined,
      })
      alert(`Vendor ${selectedQuote.vendor_name} approved! Purchase Order generated automatically.`)
      setVendorModalOpen(false)
      setSelectedRfq(null)
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to approve vendor')
    } finally {
      setActionLoading(false)
    }
  }

  const openPrReview = async (id: number) => {
    try {
      const res = await api.getPurchaseRequestById(id)
      setSelectedPr(res.request)
      setRemarks('Approved. Equipment required for departmental deliverables.')
      setModalOpen(true)
    } catch (err) {
      console.error(err)
    }
  }

  const openVendorReview = async (id: number) => {
    try {
      const res = await api.getRfqById(id)
      setSelectedRfq(res.rfq)
      setReturnReason('')
      setSelectedVendorQuoteId(res.rfq.quotations?.find((quote: any) => quote.is_recommended)?.id ?? null)
      setSelectionReason('')
      setVendorModalOpen(true)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
          Manager Approval Console
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review department purchase requisitions, approve budgets, and sign off on recommended vendor bids.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Awaiting PR Approval"
          value={pendingPrs.length}
          subtitle="Department requisitions"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Approved PRs"
          value={approvedPrs.length}
          subtitle="Sent to Procurement"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Vendor Approvals"
          value={pendingVendorApprovals.length}
          subtitle="Awaiting final selection"
          icon={Scale}
          color="indigo"
        />
        <StatCard
          title="Dept Spend"
          value={`₹${(totalSpend / 100000).toFixed(2)}L`}
          subtitle="Active commitments"
          icon={TrendingUp}
          color="sky"
        />
      </div>

      {/* Two Columns: Section 1 (PR Approvals) & Section 2 (Vendor Selection Approvals) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending PR Approvals */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Requisitions Awaiting Approval ({pendingPrs.length})
              </h2>
              <p className="text-xs text-slate-500">Employee requests needing departmental budget authorization</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {pendingPrs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                All pending purchase requests have been reviewed!
              </div>
            ) : (
              pendingPrs.map(pr => (
                <div key={pr.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/50">
                        {pr.pr_number}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{pr.employee_name}</span>
                      <Badge status={pr.priority} size="sm" />
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1">{pr.purpose}</p>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Target: {pr.required_date} • Est: <strong className="text-slate-900">₹{Number(pr.total_estimated_cost).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => openPrReview(pr.id)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer inline-flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" /> Review & Sign
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Vendor Selection Approvals */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Vendor Selections Awaiting Sign-Off ({pendingVendorApprovals.length})
              </h2>
              <p className="text-xs text-slate-500">Procurement recommended suppliers ready for PO generation</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {pendingVendorApprovals.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-indigo-500 mx-auto mb-1.5 opacity-80" />
                No vendor selections pending manager authorization.
              </div>
            ) : (
              pendingVendorApprovals.map(rfq => (
                <div key={rfq.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/50">
                        {rfq.rfq_number}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{rfq.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">Ref: {rfq.pr_number}</p>
                    <div className="text-[11px] text-slate-400">
                      Bids evaluated: <strong className="text-slate-800">{rfq.quotation_count || 3} quotations</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => openVendorReview(rfq.id)}
                    className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs transition-colors shrink-0 cursor-pointer inline-flex items-center gap-1"
                  >
                    <Scale className="w-3.5 h-3.5" /> Evaluate & Authorize
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* PR Decision Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedPr ? `Review Request ${selectedPr.pr_number}` : 'Review Request'}
        subtitle={selectedPr ? `Submitted by ${selectedPr.employee_name} (${selectedPr.department_name})` : ''}
        maxWidth="2xl"
      >
        {selectedPr && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase">Total Commitment</span>
                <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                  ₹{Number(selectedPr.total_estimated_cost).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-semibold uppercase">Priority</span>
                <div className="mt-1">
                  <Badge status={selectedPr.priority} size="sm" />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase mb-1">Business Purpose</h4>
              <p className="text-xs text-slate-700 p-3 bg-white border border-slate-200 rounded-lg">
                {selectedPr.purpose}
              </p>
            </div>

            {selectedPr.items && selectedPr.items.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase mb-1">
                  Items to Purchase ({selectedPr.items.length})
                </h4>
                <div className="rounded-lg border border-slate-200 overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 text-slate-600 font-semibold">
                      <tr>
                        <th className="p-2">Item</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2 text-right">Unit (₹)</th>
                        <th className="p-2 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedPr.items.map((i, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-medium text-slate-800">{i.item_name}</td>
                          <td className="p-2 text-right font-mono">{i.quantity}</td>
                          <td className="p-2 text-right font-mono">₹{Number(i.estimated_unit_price).toLocaleString('en-IN')}</td>
                          <td className="p-2 text-right font-mono font-bold text-slate-900">
                            ₹{Number(i.estimated_total).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Manager Remarks / Instructions
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Enter approval note or modification guidance..."
                className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handlePrDecision('rejected')}
                className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" /> Reject Request
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handlePrDecision('approved')}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Approve & Dispatch to Procurement
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Vendor Selection Approval Modal */}
      <Modal
        isOpen={vendorModalOpen}
        onClose={() => setVendorModalOpen(false)}
        title={selectedRfq ? `Approve Vendor Selection: ${selectedRfq.rfq_number}` : 'Vendor Selection'}
        subtitle="Review Procurement Officer recommendation against other vendor bids"
        maxWidth="3xl"
      >
        {selectedRfq && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200">
              <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider mb-1">
                Procurement Officer Recommendation
              </h4>
              {selectedRfq.quotations?.find(q => q.is_recommended) ? (
                (() => {
                  const rec = selectedRfq.quotations!.find(q => q.is_recommended)!
                  return (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">{rec.vendor_name}</span>
                        <span className="text-base font-extrabold font-mono text-purple-700">
                          ₹{Number(rec.final_amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 italic">
                        "
                        {rec.recommendation_reason ||
                          'Balanced pricing with best warranty and verified vendor delivery performance.'}
                        "
                      </p>
                      <div className="flex gap-4 text-xs text-slate-500 pt-1 border-t border-purple-200/50">
                        <span>Lead Time: <strong className="text-slate-800">{rec.delivery_days} days</strong></span>
                        <span>Warranty: <strong className="text-slate-800">{rec.warranty_years} yrs</strong></span>
                        <span>Rating: <strong className="text-slate-800">{rec.vendor_rating || 4.5} ★</strong></span>
                      </div>
                    </div>
                  )
                })()
              ) : (
                <p className="text-xs text-slate-500">No quotation marked as recommended yet.</p>
              )}
            </div>

            {/* Other quotes comparison */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase mb-2">Choose a Vendor from All Submitted Quotations</h4>
              <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 font-semibold">
                    <tr>
                      <th className="p-2.5">Select</th>
                      <th className="p-2.5">Vendor</th>
                      <th className="p-2.5 text-right">Price</th>
                      <th className="p-2.5 text-right">Delivery</th>
                      <th className="p-2.5 text-right">Warranty</th>
                      <th className="p-2.5 text-right">Rating</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {selectedRfq.quotations?.map(q => (
                      <tr key={q.id} className={selectedVendorQuoteId === q.id ? 'bg-purple-50/30 font-semibold' : ''}>
                        <td className="p-2.5"><input type="radio" name="manager-vendor-selection" aria-label={`Select ${q.vendor_name}`} checked={selectedVendorQuoteId === q.id} disabled={!['submitted', 'recommended'].includes(q.status)} onChange={() => setSelectedVendorQuoteId(q.id)} /></td>
                        <td className="p-2.5 text-slate-900">{q.vendor_name}</td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          ₹{Number(q.final_amount).toLocaleString('en-IN')}
                        </td>
                        <td className="p-2.5 text-right font-mono">{q.delivery_days} days</td>
                        <td className="p-2.5 text-right font-mono">{q.warranty_years} yrs</td>
                        <td className="p-2.5 text-right font-mono">{q.vendor_rating || 4.5} ★</td>
                        <td className="p-2.5 text-center">
                          <Badge status={q.is_recommended ? 'recommended' : q.status} size="sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <label className="block text-xs font-semibold">Vendor selection reason {selectedVendorQuoteId !== selectedRfq.quotations?.find(q => q.is_recommended)?.id ? '(required for an alternative)' : '(optional)'}
              <textarea value={selectionReason} onChange={event => setSelectionReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900" placeholder="Explain your decision, for example delivery deadline or warranty" />
            </label>
            <p className="text-xs text-slate-500">Procurement recommendation is advisory. An alternative selection requires a reason and is recorded in the audit log.</p>
            <label className="block text-xs font-semibold">Reason for sending back to Procurement
              <textarea value={returnReason} onChange={event => setReturnReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-900" placeholder="Explain what Procurement should reconsider" />
            </label>
            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
              <button type="button" disabled={actionLoading || !returnReason.trim()} onClick={handleReturnRecommendation} className="rounded-xl border border-amber-400 px-4 py-2 text-xs font-bold text-amber-700 disabled:opacity-50">Send back to Procurement</button>
              <button
                type="button"
                onClick={() => setVendorModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={actionLoading || !selectedVendorQuoteId || (selectedVendorQuoteId !== selectedRfq.quotations?.find(q => q.is_recommended)?.id && !selectionReason.trim())}
                onClick={() => handleApproveVendorSelection(selectedRfq)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Approve Selected Vendor & Generate PO
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
