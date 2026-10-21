import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { PurchaseOrder } from '../../types'
import { Badge } from '../../components/common/Badge'
import { GoodsReceiptModal } from './GoodsReceiptModal'
import { Modal } from '../../components/common/Modal'
import {
  ShoppingCart,
  Truck,
  CheckCircle2,
  Package,
  Calendar,
  Building,
  CreditCard,
  Eye,
  FileCheck2,
} from 'lucide-react'

interface Props {
  initialPoId?: number | null
}

export const PurchaseOrdersPage: React.FC<Props> = ({ initialPoId }) => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')

  const [selectedPo, setSelectedPo] = useState<PurchaseOrder | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [grnModalOpen, setGrnModalOpen] = useState(false)

  // Payment Recording State
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payAmount, setPayAmount] = useState(0)
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payRef, setPayRef] = useState('')
  const [payNotes, setPayNotes] = useState('Electronic NEFT Treasury Settlement')
  const [paySubmitting, setPaySubmitting] = useState(false)

  useEffect(() => {
    loadOrders()
  }, [])

  useEffect(() => {
    if (initialPoId && orders.length > 0) {
      openPoDetails(initialPoId)
    }
  }, [initialPoId, orders])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await api.getPurchaseOrders()
      setOrders(res.orders)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openPoDetails = async (id: number) => {
    try {
      const res = await api.getPurchaseOrderById(id)
      setSelectedPo(res.order)
      setDetailsModalOpen(true)
    } catch (err) {
      console.error(err)
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPo || !selectedPo.invoices || selectedPo.invoices.length === 0) return

    const inv = selectedPo.invoices[0]
    setPaySubmitting(true)
    try {
      await api.recordPayment(inv.id, {
        amount: payAmount || inv.amount,
        payment_date: payDate,
        payment_ref: payRef || undefined,
        notes: payNotes,
      })
      alert(`Payment settled successfully! Reference: ${payRef || 'auto-assigned'}`)
      setPayModalOpen(false)
      await openPoDetails(selectedPo.id)
      await loadOrders()
    } catch (err: any) {
      alert(err.message || 'Payment failed')
    } finally {
      setPaySubmitting(false)
    }
  }

  const filteredOrders = orders.filter(po => {
    if (statusFilter !== 'all' && po.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
            Purchase Orders & Delivery Fulfillment
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track order issuance, vendor dispatch status, courier consignments, and goods receipt inspections (GRN).
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['all', 'issued', 'dispatched', 'delivered', 'completed'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading purchase orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">No purchase orders found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">PO Identifier</th>
                  <th className="py-3 px-4">Vendor Partner</th>
                  <th className="py-3 px-4 text-right">Order Value</th>
                  <th className="py-3 px-4">Expected Date</th>
                  <th className="py-3 px-4">Dispatch & Tracking</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredOrders.map(po => (
                  <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">{po.po_number}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{po.vendor_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{po.vendor_code}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      ₹{Number(po.total_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{po.expected_delivery}</td>
                    <td className="py-3.5 px-4">
                      {po.tracking_ref ? (
                        <div className="flex items-center gap-1.5 font-mono">
                          <Truck className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-bold text-slate-800">{po.courier_name}:</span>
                          <span className="text-slate-600">{po.tracking_ref}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Processing at vendor warehouse</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={po.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openPoDetails(po.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-600 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PO Full Details Modal */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={selectedPo ? `Purchase Order: ${selectedPo.po_number}` : 'PO Details'}
        subtitle={selectedPo ? `Issued to ${selectedPo.vendor_name} on ${new Date(selectedPo.created_at).toLocaleDateString()}` : ''}
        maxWidth="3xl"
      >
        {selectedPo && (
          <div className="space-y-6">
            {/* Top Stat Banner */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Badge status={selectedPo.status} size="md" />
                <span className="text-xs text-slate-500 font-mono">Terms: {selectedPo.payment_terms}</span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 uppercase font-semibold">Total PO Commitment</span>
                <div className="text-xl font-bold font-mono text-slate-900">
                  ₹{Number(selectedPo.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Consignment & Delivery Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase mb-2">
                  <Building className="w-3.5 h-3.5 text-indigo-600" /> Supplier Details
                </div>
                <div className="text-sm font-bold text-slate-900">{selectedPo.vendor_name}</div>
                <div className="text-xs text-slate-600 mt-0.5">{selectedPo.vendor_address || 'Electronics City, Bengaluru'}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">GSTIN: {selectedPo.gst_number || '29ABCDE1234F1Z5'}</div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase mb-2">
                  <Truck className="w-3.5 h-3.5 text-indigo-600" /> Dispatch & Consignment
                </div>
                {selectedPo.tracking_ref ? (
                  <div className="space-y-1 text-xs">
                    <div>Carrier: <strong className="text-slate-800">{selectedPo.courier_name}</strong></div>
                    <div>Tracking Reference: <strong className="text-indigo-600 font-mono">{selectedPo.tracking_ref}</strong></div>
                    <div className="text-[11px] text-slate-400">Dispatched: {selectedPo.dispatch_date || 'In Transit'}</div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No dispatch tracking uploaded by supplier yet.</p>
                )}
              </div>
            </div>

            {/* Goods Receipt Notes (GRN) Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Goods Receipt Notes (GRN)
                </h4>
                {['dispatched', 'delivered'].includes(selectedPo.status) && (
                  <button
                    onClick={() => setGrnModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" /> Record Goods Receipt
                  </button>
                )}
              </div>

              {selectedPo.goods_receipts && selectedPo.goods_receipts.length > 0 ? (
                <div className="space-y-2">
                  {selectedPo.goods_receipts.map(grn => (
                    <div key={grn.id} className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                          {grn.grn_number}
                        </span>
                        <span className="text-slate-500 font-mono">Date: {grn.received_date}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-emerald-200/60 font-mono">
                        <div>Ordered: <strong className="text-slate-900">{grn.ordered_qty}</strong></div>
                        <div>Received: <strong className="text-slate-900">{grn.received_qty}</strong></div>
                        <div>Accepted: <strong className="text-emerald-700">{grn.accepted_qty}</strong></div>
                        <div>Rejected: <strong className="text-rose-700">{grn.rejected_qty}</strong></div>
                      </div>
                      {grn.rejection_reason && (
                        <div className="mt-2 text-rose-800 text-[11px] italic bg-rose-50 p-2 rounded border border-rose-200">
                          Rejection note: "{grn.rejection_reason}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                  No GRN recorded. When items arrive physically at company warehouse, record the receipt note.
                </p>
              )}
            </div>

            {/* Invoices & Payment Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Associated Invoices & Payments
                </h4>
              </div>

              {selectedPo.invoices && selectedPo.invoices.length > 0 ? (
                <div className="space-y-2">
                  {selectedPo.invoices.map(inv => (
                    <div key={inv.id} className="p-3.5 rounded-xl border border-slate-200 bg-white text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-indigo-700">{inv.invoice_number}</span>
                          <span className="text-slate-500 ml-2">Due: {inv.due_date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            ₹{Number(inv.amount).toLocaleString('en-IN')}
                          </span>
                          <Badge status={inv.status} size="sm" />
                        </div>
                      </div>

                      {inv.payment ? (
                        <div className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] flex items-center justify-between font-mono">
                          <span>Settled Ref: <strong>{inv.payment.payment_ref}</strong></span>
                          <span>Paid on {inv.payment.payment_date}</span>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                          <button
                            onClick={() => {
                              setPayAmount(inv.amount)
                              setPayModalOpen(true)
                            }}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Record Payment Settlement
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-xl border border-slate-200">
                  No invoice submitted by vendor yet.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Record GRN Modal */}
      <GoodsReceiptModal
        po={selectedPo}
        isOpen={grnModalOpen}
        onClose={() => setGrnModalOpen(false)}
        onRecorded={async () => {
          if (selectedPo) await openPoDetails(selectedPo.id)
          await loadOrders()
        }}
      />

      {/* Payment Settlement Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title="Record Treasury Payment Settlement"
        subtitle="Log internal accounts clearing reference (No live banking gateway required)"
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Settlement Amount (₹)</label>
            <input
              type="number"
              required
              value={payAmount}
              onChange={e => setPayAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
            <input
              type="date"
              required
              value={payDate}
              onChange={e => setPayDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Reference Number</label>
            <input
              type="text"
              placeholder="e.g. PAY-92731 or NEFT-883921"
              value={payRef}
              onChange={e => setPayRef(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">Leave blank to auto-generate reference ID</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Banking Channel</label>
            <input
              type="text"
              value={payNotes}
              onChange={e => setPayNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setPayModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={paySubmitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {paySubmitting ? 'Recording...' : 'Confirm Payment Settlement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
