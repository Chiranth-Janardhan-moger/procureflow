import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Invoice } from '../../types'
import { Badge } from '../../components/common/Badge'
import { Modal } from '../../components/common/Modal'
import { CreditCard, CheckCircle2, Clock, Search } from 'lucide-react'

export const InvoicesPage: React.FC = () => {
  const { user } = useAuth()
  const canSettle = ['procurement_officer', 'admin'].includes(user?.role || '')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Payment Settlement Modal
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [amount, setAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentRef, setPaymentRef] = useState('')
  const [notes, setNotes] = useState('NEFT settlement via corporate treasury account')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadInvoices()
  }, [])

  const loadInvoices = async () => {
    setLoading(true)
    try {
      const res = await api.getInvoices()
      setInvoices(res.invoices)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openPayModal = (inv: Invoice) => {
    setSelectedInvoice(inv)
    setAmount(Number(inv.amount))
    setPaymentRef(`PAY-${crypto.randomUUID()}`)
    setPayModalOpen(true)
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInvoice) return

    setSubmitting(true)
    try {
      await api.recordPayment(selectedInvoice.id, {
        amount,
        payment_date: paymentDate,
        payment_ref: paymentRef,
        notes,
      })
      alert(`Payment recorded under reference ${paymentRef}!`)
      setPayModalOpen(false)
      setSelectedInvoice(null)
      await loadInvoices()
    } catch (err: any) {
      alert(err.message || 'Payment failed')
    } finally {
      setSubmitting(false)
    }
  }

  const filtered = invoices.filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        inv.invoice_number.toLowerCase().includes(q) ||
        (inv.vendor_name && inv.vendor_name.toLowerCase().includes(q)) ||
        (inv.po_number && inv.po_number.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
            Invoices & Payment Settlements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supplier commercial tax invoices, due dates, three-way matching, and corporate treasury settlements.
          </p>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['all', 'submitted', 'verified', 'paid'].map(st => (
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

      {/* Invoices Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by invoice #, PO #, vendor..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs font-bold text-slate-500">{filtered.length} invoice records</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading invoice ledger...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">No invoices found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Vendor Supplier</th>
                  <th className="py-3 px-4">Associated PO</th>
                  <th className="py-3 px-4 text-right">Invoice Value</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Settlement Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">{inv.invoice_number}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{inv.vendor_name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 font-medium">{inv.po_number}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      ₹{Number(inv.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">{inv.due_date}</td>
                    <td className="py-3.5 px-4 font-mono">
                      {inv.payment ? (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/50">
                          {inv.payment.payment_ref} ({inv.payment.payment_date})
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unsettled</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={inv.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {canSettle && ['submitted', 'verified', 'pending_payment'].includes(inv.status) && (
                        <button
                          onClick={() => openPayModal(inv)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1"
                        >
                          <CreditCard className="w-3.5 h-3.5" /> Settle Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Settlement Modal */}
      <Modal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        title={selectedInvoice ? `Record Payment: ${selectedInvoice.invoice_number}` : 'Record Payment'}
        subtitle="Log internal treasury settlement reference (Completes procurement lifecycle)"
        maxWidth="md"
      >
        <form onSubmit={handlePaymentSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Settlement Amount (₹)</label>
            <input
              type="number"
              required
              value={amount}
              readOnly
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Settlement Date</label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Reference (NEFT / RTGS)</label>
            <input
              type="text"
              required
              value={paymentRef}
              onChange={e => setPaymentRef(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Treasury Notes / Channel</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
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
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {submitting ? 'Recording...' : 'Confirm Settlement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
