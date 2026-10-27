import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import type { PurchaseOrder } from '../../types'
import { Modal } from '../../components/common/Modal'
import { Badge } from '../../components/common/Badge'
import { PurchaseOrderContents } from '../../components/common/PurchaseOrderContents'

interface Props {
  orderId: number | null
  isOpen: boolean
  onClose: () => void
  onAccepted: () => void | Promise<void>
}

const money = (value: unknown): string => value === null || value === undefined || !Number.isFinite(Number(value))
  ? 'Not recorded' : `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export const VendorOrderDetailsModal: React.FC<Props> = ({ orderId, isOpen, onClose, onAccepted }) => {
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!isOpen || !orderId) return
    let cancelled = false
    setOrder(null); setError(''); setNotice(''); setLoading(true)
    void api.getPurchaseOrderById(orderId).then(result => { if (!cancelled) setOrder(result.order) })
      .catch(err => { if (!cancelled) setError(err.message || 'Unable to load this order.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orderId, isOpen])

  const accept = async () => {
    if (!order || order.id !== orderId || order.status !== 'issued' || accepting) return
    setAccepting(true); setError('')
    try {
      await api.updatePurchaseOrderStatus(order.id, { status: 'accepted' })
      const result = await api.getPurchaseOrderById(order.id)
      setOrder(result.order)
      setNotice('Order accepted. You can now arrange dispatch from your vendor dashboard.')
      await onAccepted()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to accept order.') }
    finally { setAccepting(false) }
  }

  return <Modal isOpen={isOpen} onClose={onClose} title={order ? `Purchase Order: ${order.po_number}` : 'Purchase Order Details'} subtitle="Review the awarded items and commercial terms before accepting." maxWidth="3xl">
    {loading && <p className="py-8 text-sm">Loading purchase order...</p>}
    {error && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {notice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {order && order.id === orderId && <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><Badge status={order.status} /><strong className="text-lg">Order total: {money(order.total_amount)}</strong></div>
      <PurchaseOrderContents order={order} />
      <p className="text-xs text-slate-500">Accepted units: {order.accepted_qty || 0} · Outstanding units: {order.remaining_qty || 0}</p>
      {order.tracking_ref && <p className="text-sm">Dispatch: {order.courier_name} · {order.tracking_ref}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Close</button>
        {order.status === 'issued' && <button type="button" disabled={accepting} onClick={accept} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{accepting ? 'Accepting...' : 'Accept Order'}</button>}
      </div>
    </div>}
  </Modal>
}
