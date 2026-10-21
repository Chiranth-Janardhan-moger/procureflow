import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { PurchaseRequest, RFQ, PurchaseOrder } from '../../types'
import { StatCard } from '../../components/common/StatCard'
import { Badge } from '../../components/common/Badge'
import { CreateRfqModal } from './CreateRfqModal'
import {
  Layers,
  Send,
  Scale,
  ShoppingCart,
  Truck,
  CreditCard,
  PlusCircle,
  Eye,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'

interface Props {
  onNavigateToComparison: (rfqId: number) => void
  onNavigateToPo: (poId: number) => void
}

export const ProcurementDashboard: React.FC<Props> = ({
  onNavigateToComparison,
  onNavigateToPo,
}) => {
  const [prs, setPrs] = useState<PurchaseRequest[]>([])
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)

  const [createRfqModalOpen, setCreateRfqModalOpen] = useState(false)
  const [selectedPrIdForRfq, setSelectedPrIdForRfq] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [prRes, rfqRes, poRes] = await Promise.all([
        api.getPurchaseRequests(),
        api.getRfqs(),
        api.getPurchaseOrders(),
      ])
      setPrs(prRes.requests)
      setRfqs(rfqRes.rfqs)
      setOrders(poRes.orders)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // PRs approved by manager waiting for RFQ
  const approvedPrs = prs.filter(p => p.status === 'approved' || p.status === 'in_procurement')
  const openRfqs = rfqs.filter(r => r.status === 'open' || r.status === 'evaluation')
  const activeOrders = orders.filter(p => p.status !== 'completed' && p.status !== 'cancelled')
  const pendingDeliveries = orders.filter(p => p.status === 'dispatched')

  const totalSpend = orders.reduce((sum, o) => sum + Number(o.total_amount), 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
            Procurement Operations Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage vendor tenders, execute multi-quote evaluation matrices, issue POs, and verify goods receipts.
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedPrIdForRfq(null)
            setCreateRfqModalOpen(true)
          }}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" /> Create Tender / RFQ
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          title="Approved PR Queue"
          value={approvedPrs.length}
          subtitle="Ready for RFQ"
          icon={Layers}
          color="indigo"
        />
        <StatCard
          title="Active RFQs"
          value={openRfqs.length}
          subtitle="Vendor bidding"
          icon={Send}
          color="amber"
        />
        <StatCard
          title="Active Orders"
          value={activeOrders.length}
          subtitle="Issued & Processing"
          icon={ShoppingCart}
          color="sky"
        />
        <StatCard
          title="Pending Deliveries"
          value={pendingDeliveries.length}
          subtitle="Dispatched transit"
          icon={Truck}
          color="rose"
        />
        <StatCard
          title="Procurement Spend"
          value={`₹${(totalSpend / 100000).toFixed(2)}L`}
          subtitle="Total PO value"
          icon={TrendingUp}
          color="emerald"
        />
      </div>

      {/* Grid: Left: Approved PRs awaiting RFQ, Right: Active RFQs with compare action */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Approved PR Queue */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Approved Requisitions Queue ({approvedPrs.length})
              </h2>
              <p className="text-xs text-slate-500">Manager-approved requests ready for vendor quoting</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {approvedPrs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No approved purchase requests currently pending sourcing.
              </div>
            ) : (
              approvedPrs.map(pr => (
                <div key={pr.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/50">
                        {pr.pr_number}
                      </span>
                      <span className="text-xs font-bold text-slate-800">{pr.department_name}</span>
                      <Badge status={pr.status} size="sm" />
                    </div>
                    <p className="text-xs text-slate-700 font-medium line-clamp-1">{pr.purpose}</p>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Requester: {pr.employee_name} • Est: <strong className="text-slate-900">₹{Number(pr.total_estimated_cost).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPrIdForRfq(pr.id)
                      setCreateRfqModalOpen(true)
                    }}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition-colors shrink-0 cursor-pointer inline-flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" /> Start RFQ
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active RFQs / Bids */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Active RFQs & Tender Evaluations ({openRfqs.length})
              </h2>
              <p className="text-xs text-slate-500">Live vendor bids submitted for price and warranty comparison</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {openRfqs.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No active tenders open right now.
              </div>
            ) : (
              openRfqs.map(rfq => (
                <div key={rfq.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/50">
                        {rfq.rfq_number}
                      </span>
                      <Badge status={rfq.status} size="sm" />
                    </div>
                    <p className="text-xs font-bold text-slate-900 line-clamp-1">{rfq.title}</p>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Quotes: <strong className="text-indigo-600 font-bold">{rfq.quotation_count || 0} received</strong> • Deadline: {rfq.deadline}
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigateToComparison(rfq.id)}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors shrink-0 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Scale className="w-3.5 h-3.5" /> Compare Matrix
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Purchase Orders & Goods Receipt Tracker */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Purchase Orders & Dispatch Tracker
            </h2>
            <p className="text-xs text-slate-500">Real-time status of orders issued to external suppliers</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4 text-right">Order Amount</th>
                <th className="py-3 px-4">Expected Arrival</th>
                <th className="py-3 px-4">Tracking Reference</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orders.map(po => (
                <tr key={po.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">{po.po_number}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-800">{po.vendor_name}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    ₹{Number(po.total_amount).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{po.expected_delivery}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">
                    {po.tracking_ref ? (
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
                        {po.courier_name}: {po.tracking_ref}
                      </span>
                    ) : (
                      <span className="text-slate-400">Pending Dispatch</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge status={po.status} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => onNavigateToPo(po.id)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 font-semibold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Details / GRN
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create RFQ Modal */}
      <CreateRfqModal
        isOpen={createRfqModalOpen}
        onClose={() => setCreateRfqModalOpen(false)}
        onCreated={loadData}
        preselectedPrId={selectedPrIdForRfq}
      />
    </div>
  )
}
