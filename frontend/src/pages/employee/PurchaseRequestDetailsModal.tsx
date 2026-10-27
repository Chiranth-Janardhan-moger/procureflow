import React, { useEffect, useState } from 'react'
import { PurchaseRequest } from '../../types'
import { api } from '../../services/api'
import { Modal } from '../../components/common/Modal'
import { Badge } from '../../components/common/Badge'
import { TimelineStepper, TimelineStep } from '../../components/common/TimelineStepper'
import { Calendar, User, Building, FileText, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

interface Props {
  requestId: number | null
  isOpen: boolean
  onClose: () => void
  onUpdated?: () => void
}

export const PurchaseRequestDetailsModal: React.FC<Props> = ({
  requestId,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [pr, setPr] = useState<PurchaseRequest | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (requestId && isOpen) {
      loadDetails(requestId)
    }
  }, [requestId, isOpen])

  const loadDetails = async (id: number) => {
    setLoading(true)
    try {
      const res = await api.getPurchaseRequestById(id)
      setPr(res.request)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // Build timeline steps based on actual status
  const getTimelineSteps = (req: PurchaseRequest): TimelineStep[] => {
    const isApproved = ['approved', 'in_procurement', 'completed'].includes(req.status)
    const isProcurement = ['in_procurement', 'completed'].includes(req.status)
    const isCompleted = req.status === 'completed'
    const isRejected = req.status === 'rejected'

    return [
      {
        title: 'Request Created',
        subtitle: `Submitted by ${req.employee_name}`,
        date: new Date(req.created_at).toLocaleDateString(),
        status: 'completed',
      },
      {
        title: isRejected ? 'Manager Rejected' : 'Manager Review',
        subtitle: req.manager_remarks || (isApproved ? 'Approved by department manager' : 'Awaiting review'),
        date: req.updated_at ? new Date(req.updated_at).toLocaleDateString() : null,
        status: isRejected ? 'rejected' : isApproved ? 'completed' : 'current',
      },
      {
        title: 'Procurement & RFQ',
        subtitle: req.rfq ? `Published ${req.rfq.rfq_number}` : 'Vendor quotation & RFQ',
        date: req.rfq?.deadline ? `Deadline: ${req.rfq.deadline}` : null,
        status: isCompleted ? 'completed' : isProcurement ? 'current' : 'upcoming',
      },
      {
        title: 'Goods Received & Closed',
        subtitle: isCompleted ? 'GRN inspected & items delivered' : 'Awaiting full accepted delivery',
        status: isCompleted ? 'completed' : 'upcoming',
      },
    ]
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={pr ? `Purchase Request: ${pr.pr_number}` : 'Purchase Request Details'}
      subtitle={pr ? `Created on ${new Date(pr.created_at).toLocaleDateString()}` : undefined}
      maxWidth="3xl"
    >
      {loading || !pr ? (
        <div className="py-12 text-center text-sm text-slate-400">Loading request details...</div>
      ) : (
        <div className="space-y-6">
          {/* Top badges & summary card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge status={pr.status} size="md" />
              <Badge status={pr.priority} size="md" label={`Priority: ${pr.priority.toUpperCase()}`} />
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 uppercase font-semibold">Total Estimated Cost</div>
              <div className="text-xl font-bold font-mono text-slate-900">
                ₹{Number(pr.total_estimated_cost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Workflow Timeline */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Lifecycle Progress
            </h4>
            <div className="p-4 rounded-xl border border-slate-200/80 bg-white shadow-2xs">
              <TimelineStepper steps={getTimelineSteps(pr)} />
            </div>
          </div>

          {/* Key details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mb-1">
                <User className="w-3.5 h-3.5" /> Requester
              </div>
              <div className="text-sm font-bold text-slate-800">{pr.employee_name}</div>
              <div className="text-xs text-slate-500">{pr.employee_email}</div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mb-1">
                <Building className="w-3.5 h-3.5" /> Department
              </div>
              <div className="text-sm font-bold text-slate-800">{pr.department_name || 'IT Tech'}</div>
              <div className="text-xs text-slate-500">Cost Center: {pr.department_name}</div>
            </div>

            <div className="p-3 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mb-1">
                <Calendar className="w-3.5 h-3.5" /> Required Date
              </div>
              <div className="text-sm font-bold text-slate-800">{pr.required_date}</div>
              <div className="text-xs text-slate-500 font-mono">Target Fulfillment</div>
            </div>
          </div>

          {/* Business justification */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
            <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Business Justification / Reason
            </h5>
            <p className="text-sm text-slate-700 leading-relaxed">{pr.purpose}</p>

            {pr.manager_remarks && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="text-xs font-bold text-indigo-700 uppercase">Manager Remarks: </span>
                <span className="text-xs text-slate-700 italic">"{pr.manager_remarks}"</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Requested Items ({pr.items?.length || 0})
            </h4>
            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Est. Unit (₹)</th>
                    <th className="py-2.5 px-3 text-right">Total (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-sans">
                  {pr.items?.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{item.item_name}</div>
                        {item.specification && (
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {item.specification}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">{item.category || 'General'}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">{item.quantity}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">
                        ₹{Number(item.estimated_unit_price).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        ₹{Number(item.estimated_total).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
