import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { PurchaseRequest } from '../../types'
import { StatCard } from '../../components/common/StatCard'
import { Badge } from '../../components/common/Badge'
import { PurchaseRequestDetailsModal } from './PurchaseRequestDetailsModal'
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Search,
  Filter,
  Eye,
  ArrowUpRight,
} from 'lucide-react'

interface Props {
  onCreateRequest: () => void
}

export const EmployeeDashboard: React.FC<Props> = ({ onCreateRequest }) => {
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPrId, setSelectedPrId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    loadRequests()
    const refresh = () => { void loadRequests() }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const res = await api.getPurchaseRequests()
      setRequests(res.requests)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Metrics
  const total = requests.length
  const pending = requests.filter(r => r.status === 'pending').length
  const approved = requests.filter(r => r.status === 'approved' || r.status === 'in_procurement').length
  const completed = requests.filter(r => r.status === 'completed').length
  const rejected = requests.filter(r => r.status === 'rejected').length

  const filteredRequests = requests.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        r.pr_number.toLowerCase().includes(q) ||
        r.purpose.toLowerCase().includes(q) ||
        (r.department_name && r.department_name.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
            Employee Purchase Workspace
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Raise procurement requirements, track approvals, and view fulfillment milestones.
          </p>
        </div>

        <button
          onClick={onCreateRequest}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer inline-flex items-center gap-2 shrink-0"
        >
          <PlusCircle className="w-4 h-4" /> Create Purchase Request
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          title="Total Requests"
          value={total}
          subtitle="All requisitions"
          icon={FileText}
          color="indigo"
        />
        <StatCard
          title="Pending Approval"
          value={pending}
          subtitle="With Dept Manager"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="In Procurement"
          value={approved}
          subtitle="RFQ & Sourcing"
          icon={CheckCircle2}
          color="sky"
        />
        <StatCard
          title="Fulfilled"
          value={completed}
          subtitle="Delivered & Closed"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Rejected"
          value={rejected}
          subtitle="Review remarks"
          icon={XCircle}
          color="rose"
        />
      </div>

      {/* Requests Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by PR # or keyword..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {['all', 'pending', 'approved', 'in_procurement', 'completed', 'rejected'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading your purchase requests...</div>
        ) : filteredRequests.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No requests found</p>
            <p className="text-xs text-slate-400 mt-1">Get started by creating your first purchase requisition.</p>
            <button
              onClick={onCreateRequest}
              className="mt-4 px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" /> Create Request Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Items / Purpose</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Required Date</th>
                  <th className="py-3 px-4 text-right">Estimated Value</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRequests.map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/50">
                        {req.pr_number}
                      </span>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">
                        {new Date(req.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="font-medium text-slate-900 truncate">{req.purpose}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {req.item_count ? `${req.item_count} items listed` : 'Itemized'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={req.priority} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{req.required_date}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{Number(req.total_estimated_cost).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={req.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {req.status === 'draft' && <button type="button" onClick={async () => {
                        try { await api.updatePurchaseRequestStatus(req.id, 'pending'); await loadRequests() }
                        catch (error) { alert(error instanceof Error ? error.message : 'Unable to submit request.') }
                      }} className="mr-2 rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white">Submit for approval</button>}
                      <button
                        onClick={() => {
                          setSelectedPrId(req.id)
                          setModalOpen(true)
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer inline-flex items-center gap-1 font-semibold text-xs"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <PurchaseRequestDetailsModal
        requestId={selectedPrId}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedPrId(null)
        }}
        onUpdated={loadRequests}
      />
    </div>
  )
}
