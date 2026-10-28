import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { RFQ, PurchaseOrder, Invoice } from '../../types'
import { StatCard } from '../../components/common/StatCard'
import { Badge } from '../../components/common/Badge'
import { SubmitQuotationModal } from './SubmitQuotationModal'
import { VendorOrderDetailsModal } from './VendorOrderDetailsModal'
import { canSubmitQuotation } from '../../services/quotationEligibility'
import { Modal } from '../../components/common/Modal'
import {
  Send,
  Package,
  Receipt,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Check,
} from 'lucide-react'

export const VendorDashboard: React.FC = () => {
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [quoteModalOpen, setQuoteModalOpen] = useState(false)
  const [detailsOrderId, setDetailsOrderId] = useState<number | null>(null)
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false)
  const [selectedRfq, setSelectedRfq] = useState<RFQ | null>(null)

  // Dispatch modal
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false)
  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null)
  const [courierName, setCourierName] = useState('BlueDart Express')
  const [trackingRef, setTrackingRef] = useState('')
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split('T')[0])
  const [dispatchLoading, setDispatchLoading] = useState(false)

  // Invoice modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false)
  const [invPo, setInvPo] = useState<PurchaseOrder | null>(null)
  const [invNumber, setInvNumber] = useState('')
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0])
  const [invDueDate, setInvDueDate] = useState('')
  const [invAmount, setInvAmount] = useState(0)
  const [invNotes, setInvNotes] = useState('Standard GST Tax Invoice for PO fulfillment')
  const [invLoading, setInvLoading] = useState(false)

  useEffect(() => {
    loadVendorData()
  }, [])

  const loadVendorData = async () => {
    setLoading(true)
    try {
      const [rfqRes, poRes, invRes] = await Promise.all([
        api.getRfqs(),
        api.getPurchaseOrders(),
        api.getInvoices(),
      ])
      setRfqs(rfqRes.rfqs)
      setOrders(poRes.orders)
      setInvoices(invRes.invoices)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openOrderDetails = (id: number) => {
    setDetailsOrderId(id)
    setOrderDetailsOpen(true)
  }

  const handleDispatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPo || !trackingRef.trim()) return

    setDispatchLoading(true)
    try {
      await api.updatePurchaseOrderStatus(selectedPo.id, {
        status: 'dispatched',
        dispatch_date: dispatchDate,
        courier_name: courierName,
        tracking_ref: trackingRef,
      })
      alert(`Consignment marked as dispatched with tracking reference ${trackingRef}!`)
      setDispatchModalOpen(false)
      setSelectedPo(null)
      await loadVendorData()
    } catch (err: any) {
      alert(err.message || 'Failed to update dispatch')
    } finally {
      setDispatchLoading(false)
    }
  }

  const openInvoiceModal = (po: PurchaseOrder) => {
    setInvPo(po)
    setInvNumber(`INV-${crypto.randomUUID()}`)
    setInvAmount(Number(po.total_amount))
    const d = new Date()
    d.setDate(d.getDate() + 30)
    setInvDueDate(d.toISOString().split('T')[0])
    setInvoiceModalOpen(true)
  }

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!invPo) return

    setInvLoading(true)
    try {
      await api.submitInvoice({
        po_id: invPo.id,
        invoice_number: invNumber,
        invoice_date: invDate,
        due_date: invDueDate,
        amount: invAmount,
        notes: invNotes,
      })
      alert(`Invoice ${invNumber} submitted to procurement for accounts processing!`)
      setInvoiceModalOpen(false)
      setInvPo(null)
      await loadVendorData()
    } catch (err: any) {
      alert(err.message || 'Failed to submit invoice')
    } finally {
      setInvLoading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
          Vendor Partner Portal
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review invited tender RFQs, submit competitive quotations, confirm orders, and dispatch shipments.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Open Tenders"
          value={rfqs.filter(canSubmitQuotation).length}
          subtitle="Ready for quotation"
          icon={Send}
          color="indigo"
        />
        <StatCard
          title="Active POs"
          value={orders.filter(o => o.status !== 'completed').length}
          subtitle="Orders in progress"
          icon={Package}
          color="sky"
        />
        <StatCard
          title="Dispatched"
          value={orders.filter(o => o.status === 'dispatched').length}
          subtitle="Consignments in transit"
          icon={Truck}
          color="amber"
        />
        <StatCard
          title="Invoices Submitted"
          value={invoices.length}
          subtitle="Billing ledger"
          icon={Receipt}
          color="emerald"
        />
      </div>

      {/* Section 1: Open RFQs for Bidding */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Invited RFQ Tenders ({rfqs.length})
            </h2>
            <p className="text-xs text-slate-500">Tenders invited by company procurement</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {rfqs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No active tender invites.</div>
          ) : (
            rfqs.map(rfq => (
              <div key={rfq.id} className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/50">
                      {rfq.rfq_number}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{rfq.title}</span>
                    <Badge status={rfq.status} size="sm" />
                  </div>
                  <p className="text-xs text-slate-600">{rfq.terms}</p>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Deadline: <strong className="text-slate-800">{rfq.deadline}</strong> • Target Delivery: {rfq.expected_delivery_date || 'N/A'}
                  </div>
                </div>

                {canSubmitQuotation(rfq) ? (
                  <button
                    onClick={() => {
                      setSelectedRfq(rfq)
                      setQuoteModalOpen(true)
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Submit Quotation Bid
                  </button>
                ) : (
                  <span className="px-4 py-2 text-xs font-semibold text-slate-500">
                    {rfq.has_submitted_quotation ? 'Quotation submitted' : 'Bidding closed'}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Section 2: Purchase Orders & Order Processing */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Purchase Orders & Dispatch Actions
            </h2>
            <p className="text-xs text-slate-500">Manage orders awarded to your supplier account</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">PO Identifier</th>
                <th className="py-3 px-4 text-right">Order Value</th>
                <th className="py-3 px-4">Required Delivery</th>
                <th className="py-3 px-4">Dispatch Reference</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Vendor Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orders.map(po => (
                <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-700"><button type="button" onClick={() => openOrderDetails(po.id)} className="underline underline-offset-2" aria-label={`View order ${po.po_number}`}>{po.po_number}</button></td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                    ₹{Number(po.total_amount).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{po.expected_delivery}</td>
                  <td className="py-3.5 px-4 font-mono">
                    {po.tracking_ref ? (
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
                        {po.courier_name}: {po.tracking_ref}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Not yet dispatched</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge status={po.status} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-1.5">
                    <button type="button" onClick={() => openOrderDetails(po.id)} className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1">
                      {po.status === 'issued' ? 'Review & Accept' : 'View Details'}
                    </button>

                    {(['accepted', 'processing'].includes(po.status) || (po.status === 'dispatched' && Number(po.remaining_qty) > 0)) && (
                      <button
                        onClick={() => {
                          setSelectedPo(po)
                          setTrackingRef('')
                          setDispatchModalOpen(true)
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Truck className="w-3 h-3" /> Update Dispatch
                      </button>
                    )}

                    {po.status === 'delivered' && !po.invoice_submitted && (
                      <button
                        onClick={() => openInvoiceModal(po)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Receipt className="w-3 h-3" /> Submit Invoice
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <VendorOrderDetailsModal orderId={detailsOrderId} isOpen={orderDetailsOpen} onClose={() => setOrderDetailsOpen(false)} onAccepted={loadVendorData} />

      {/* Submit Quotation Modal */}
      <SubmitQuotationModal
        rfq={selectedRfq}
        isOpen={quoteModalOpen}
        onClose={() => setQuoteModalOpen(false)}
        onSubmitted={loadVendorData}
      />

      {/* Dispatch Modal */}
      <Modal
        isOpen={dispatchModalOpen}
        onClose={() => setDispatchModalOpen(false)}
        title={selectedPo ? `Update Dispatch: ${selectedPo.po_number}` : 'Update Dispatch'}
        subtitle="Provide courier consignment and tracking number"
        maxWidth="md"
      >
        <form onSubmit={handleDispatchSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Logistics / Courier Partner</label>
            <input
              type="text"
              required
              value={courierName}
              onChange={e => setCourierName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tracking / Consignment Reference</label>
            <input
              type="text"
              required
              value={trackingRef}
              onChange={e => setTrackingRef(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatch Date</label>
            <input
              type="date"
              required
              value={dispatchDate}
              onChange={e => setDispatchDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setDispatchModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={dispatchLoading}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5" /> {dispatchLoading ? 'Updating...' : 'Confirm Shipment Dispatch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Invoice Submission Modal */}
      <Modal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        title={invPo ? `Submit Invoice for PO: ${invPo.po_number}` : 'Submit Invoice'}
        subtitle="Submit commercial tax invoice for settlement"
        maxWidth="md"
      >
        <form onSubmit={handleInvoiceSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Number</label>
            <input
              type="text"
              required
              value={invNumber}
              onChange={e => setInvNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Invoice Date</label>
              <input
                type="date"
                required
                value={invDate}
                onChange={e => setInvDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
              <input
                type="date"
                required
                value={invDueDate}
                onChange={e => setInvDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Approved Order Amount (₹)</label>
            <input
              type="number"
              required
              value={invAmount}
              readOnly
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / GST Details</label>
            <input
              type="text"
              value={invNotes}
              onChange={e => setInvNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setInvoiceModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={invLoading}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Receipt className="w-3.5 h-3.5" /> {invLoading ? 'Submitting...' : 'Submit Commercial Invoice'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
