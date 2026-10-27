import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import type { PurchaseOrder } from '../../types'
import { Modal } from '../../components/common/Modal'

interface Props { po: PurchaseOrder | null; isOpen: boolean; onClose: () => void; onRecorded: () => void }
interface ReceiptInput { pr_item_id: number; received_qty: number; accepted_qty: number; rejected_qty: number; rejection_reason: string }
export const GoodsReceiptModal: React.FC<Props> = ({ po, isOpen, onClose, onRecorded }) => {
  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [lines, setLines] = useState<ReceiptInput[]>([])
  const [receivedDate, setReceivedDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!isOpen || !po) return
    let cancelled = false
    setOrder(null); setLines([]); setError(''); setLoading(true); setReceivedDate(new Date().toISOString().slice(0, 10))
    void api.getPurchaseOrderById(po.id).then(({ order: actual }) => {
      if (cancelled) return
      if (actual.status !== 'dispatched') throw new Error('Only dispatched orders with outstanding items can receive goods.')
      setOrder(actual)
      setLines((actual.items || []).map((item: any) => ({ pr_item_id: item.id, received_qty: Number(item.remaining_qty), accepted_qty: Number(item.remaining_qty), rejected_qty: 0, rejection_reason: '' })))
    }).catch(err => { if (!cancelled) setError(err.message || 'Unable to load outstanding quantities.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [po, isOpen])
  const change = (id: number, patch: Partial<ReceiptInput>) => setLines(previous => previous.map(line => line.pr_item_id === id ? { ...line, ...patch } : line))
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!order || loading || saving) return
    const received = lines.filter(line => line.received_qty > 0)
    if (!received.length || lines.some(line => line.received_qty !== line.accepted_qty + line.rejected_qty || line.accepted_qty < 0 || line.rejected_qty < 0 || (line.rejected_qty > 0 && !line.rejection_reason.trim()))) {
      setError('Record at least one received unit. Accepted plus rejected must equal received; rejected units need a reason.'); return
    }
    setSaving(true); setError('')
    try {
      await api.createGoodsReceipt({ po_id: order.id, received_date: receivedDate, items: received })
      onRecorded(); onClose()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to record goods receipt.') }
    finally { setSaving(false) }
  }
  const inputClass = 'w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900'
  return <Modal isOpen={isOpen} onClose={onClose} title={po ? `Record Delivery / GRN: ${po.po_number}` : 'Goods Receipt'} subtitle="Accept delivered items after inspection. Rejected units remain outstanding." maxWidth="2xl">
    <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {loading && <p>Loading outstanding order quantities...</p>}
      <label className="block text-xs">Receipt date<input className={inputClass} required type="date" value={receivedDate} onChange={e => setReceivedDate(e.target.value)} /></label>
      {lines.map(line => {
        const item = order?.items?.find(candidate => candidate.id === line.pr_item_id)
        return <div key={line.pr_item_id} className="rounded-xl border p-3 space-y-3">
          <p className="font-semibold">{item?.item_name}</p>
          <p className="text-xs">Ordered: {item?.quantity} · Previously accepted: {item?.accepted_qty || 0} · Outstanding: {item?.remaining_qty || 0}</p>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs">Received now<input className={inputClass} type="number" min="0" max={item?.remaining_qty} step="1" required value={line.received_qty} onChange={e => { const value = Number(e.target.value); change(line.pr_item_id, { received_qty: value, accepted_qty: Math.max(0, value - line.rejected_qty) }) }} /></label>
            <label className="text-xs">Accepted<input className={inputClass} type="number" min="0" max={line.received_qty} step="1" required value={line.accepted_qty} onChange={e => change(line.pr_item_id, { accepted_qty: Number(e.target.value) })} /></label>
            <label className="text-xs">Rejected<input className={inputClass} type="number" min="0" max={line.received_qty} step="1" required value={line.rejected_qty} onChange={e => { const value = Number(e.target.value); change(line.pr_item_id, { rejected_qty: value, accepted_qty: Math.max(0, line.received_qty - value) }) }} /></label>
          </div>
          {line.rejected_qty > 0 && <label className="block text-xs">Rejection reason<textarea className={inputClass} required value={line.rejection_reason} onChange={e => change(line.pr_item_id, { rejection_reason: e.target.value })} /></label>}
        </div>
      })}
      <p className="rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800">Once every ordered item has been accepted, this order becomes Delivered and the employee purchase request becomes Completed. Invoicing and payment continue separately.</p>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Cancel</button>
        <button type="submit" disabled={loading || saving || !lines.length} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">{saving ? 'Recording...' : 'Confirm Goods Receipt'}</button>
      </div>
    </form>
  </Modal>
}
