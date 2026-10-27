import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { RFQ, Quotation } from '../../types'
import { Badge } from '../../components/common/Badge'
import { Modal } from '../../components/common/Modal'
import {
  Scale,
  Award,
  Zap,
  Star,
  CheckCircle,
  ShieldCheck,
  Building2,
  Calendar,
  Clock,
  Sparkles,
} from 'lucide-react'

interface Props {
  rfqId: number
  onBack: () => void
}

export const QuotationComparisonPage: React.FC<Props> = ({ rfqId, onBack }) => {
  const [rfq, setRfq] = useState<RFQ | null>(null)
  const [loading, setLoading] = useState(true)
  const [recommendModalOpen, setRecommendModalOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadRfq(rfqId)
  }, [rfqId])

  const loadRfq = async (id: number) => {
    setLoading(true)
    setRfq(null)
    try {
      const res = await api.getRfqById(id)
      setRfq(res.rfq)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const quotes = rfq?.quotations || []
  const quotedQuantity = rfq?.items?.reduce((sum, item) => sum + Number(item.quantity), 0) ?? null

  // Auto-calculated analytical badges
  const lowestPriceQuote = quotes.length
    ? [...quotes].sort((a, b) => Number(a.final_amount) - Number(b.final_amount))[0]
    : null

  const fastestDeliveryQuote = quotes.length
    ? [...quotes].sort((a, b) => Number(a.delivery_days) - Number(b.delivery_days))[0]
    : null

  const highestRatingQuote = quotes.length
    ? [...quotes].sort((a, b) => Number(b.vendor_rating || 0) - Number(a.vendor_rating || 0))[0]
    : null

  const openRecommendModal = (q: Quotation) => {
    setSelectedQuote(q)
    setReason(
      `Strongest overall commercial proposal with ${q.warranty_years}-year warranty coverage, verified vendor delivery rating of ${q.vendor_rating || 4.5} stars, and acceptable delivery lead time of ${q.delivery_days} days.`
    )
    setRecommendModalOpen(true)
  }

  const handleRecommendSubmit = async () => {
    if (!selectedQuote || !reason.trim()) return
    setSubmitting(true)
    try {
      await api.recommendQuotation(selectedQuote.id, reason)
      setRecommendModalOpen(false)
      setSelectedQuote(null)
      await loadRfq(rfqId)
    } catch (err: any) {
      alert(err.message || 'Failed to submit recommendation')
    } finally {
      setSubmitting(false)
    }
  }

  const backButton = <button type="button" onClick={onBack} className="text-sm font-semibold text-indigo-600 hover:underline">← Back to Procurement Dashboard</button>
  if (loading) {
    return <div className="space-y-4">{backButton}<p className="py-16 text-center text-xs text-slate-400">Loading quotation comparative matrix...</p></div>
  }

  if (!rfq) {
    return <div className="space-y-4">{backButton}<p className="py-16 text-center text-xs text-slate-400">The selected RFQ could not be loaded. Return to the dashboard and choose an active RFQ.</p></div>
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {backButton}
      {/* Title & Context */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              {rfq.rfq_number}
            </span>
            <Badge status={rfq.status} size="sm" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
            Quotation Comparison Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-evaluate vendor proposals side-by-side on price, delivery speed, warranty, and reputation.
          </p>
        </div>

        <div className="text-right bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-[11px] text-slate-400 uppercase font-semibold">Requirement</div>
          <div className="text-xs font-bold text-slate-800">{rfq.title}</div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            PR: {rfq.pr_number} • Deadline: {rfq.deadline}
          </div>
        </div>
      </div>

      {/* Auto Analytical Highlights Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {lowestPriceQuote && (
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                Lowest Price Bid
              </div>
              <div className="text-sm font-extrabold text-emerald-950 font-sans">
                {lowestPriceQuote.vendor_name}
              </div>
              <div className="text-xs font-mono font-bold text-emerald-700">
                ₹{Number(lowestPriceQuote.final_amount).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )}

        {fastestDeliveryQuote && (
          <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-100 text-sky-700">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-800">
                Fastest Delivery
              </div>
              <div className="text-sm font-extrabold text-sky-950 font-sans">
                {fastestDeliveryQuote.vendor_name}
              </div>
              <div className="text-xs font-mono font-bold text-sky-700">
                {fastestDeliveryQuote.delivery_days} calendar days
              </div>
            </div>
          </div>
        )}

        {highestRatingQuote && (
          <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-700">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                Highest Rated Supplier
              </div>
              <div className="text-sm font-extrabold text-purple-950 font-sans">
                {highestRatingQuote.vendor_name}
              </div>
              <div className="text-xs font-mono font-bold text-purple-700">
                {highestRatingQuote.vendor_rating || 4.6} / 5.0 Rating
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Side-by-Side Comparison Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 w-1/4">
                  Evaluation Criteria
                </th>
                {quotes.map(q => {
                  const isLowest = lowestPriceQuote?.id === q.id
                  const isFastest = fastestDeliveryQuote?.id === q.id
                  const isHighestRating = highestRatingQuote?.id === q.id
                  const isRec = q.is_recommended

                  return (
                    <th key={q.id} className={`p-4 text-left w-1/4 ${isRec ? 'bg-purple-50/40 ring-1 ring-purple-200' : ''}`}>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400 font-semibold">{q.quote_number}</span>
                          {isRec && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-600 text-white shadow-xs inline-flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Recommended
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 font-sans">{q.vendor_name}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {isLowest && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Lowest Price
                            </span>
                          )}
                          {isFastest && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                              Fastest
                            </span>
                          )}
                          {isHighestRating && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                              Top Rated
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {/* Unit Price */}
              <tr className="hover:bg-slate-50/60">
                <td className="p-4 font-bold text-slate-900 bg-slate-50/30">Quoted Item Prices</td>
                {quotes.map(q => (
                  <td key={q.id} className="p-4 font-mono font-bold text-sm text-slate-900">
                    {q.line_items?.length ? q.line_items.map(line => (
                      <p key={line.pr_item_id} className="mb-1 text-xs">{line.item_name}: {line.quantity} × ₹{Number(line.unit_price).toLocaleString('en-IN')}</p>
                    )) : `₹${Number(q.unit_price).toLocaleString('en-IN')}`}
                  </td>
                ))}
              </tr>

              {/* Subtotal */}
              <tr className="hover:bg-slate-50/60">
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/30">Subtotal{quotedQuantity !== null ? ` (${quotedQuantity} ${quotedQuantity === 1 ? 'unit' : 'units'})` : ''}</td>
                {quotes.map(q => (
                  <td key={q.id} className="p-4 font-mono text-slate-700">
                    ₹{Number(q.subtotal).toLocaleString('en-IN')}
                  </td>
                ))}
              </tr>

              {/* Tax & GST */}
              <tr className="hover:bg-slate-50/60">
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/30">GST / Tax Amount</td>
                {quotes.map(q => (
                  <td key={q.id} className="p-4 font-mono text-slate-600">
                    ₹{Number(q.tax_amount).toLocaleString('en-IN')}
                  </td>
                ))}
              </tr>

              {/* Final Amount */}
              <tr className="bg-indigo-50/20 font-bold hover:bg-indigo-50/30">
                <td className="p-4 font-bold text-indigo-950 bg-indigo-50/40">Final Commercial Total</td>
                {quotes.map(q => (
                  <td key={q.id} className="p-4 font-mono font-extrabold text-base text-indigo-900">
                    ₹{Number(q.final_amount).toLocaleString('en-IN')}
                  </td>
                ))}
              </tr>

              {/* Delivery Lead Time */}
              <tr className="hover:bg-slate-50/60">
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/30">Delivery Lead Time</td>
                {quotes.map(q => (
                  <td key={q.id} className="p-4">
                    <span className="font-mono font-bold text-slate-900">{q.delivery_days} calendar days</span>
                  </td>
                ))}
              </tr>

              {/* Warranty Coverage */}
              <tr className="hover:bg-slate-50/60">
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/30">OEM Warranty Period</td>
                {quotes.map(q => (
                  <td key={q.id} className="p-4 font-mono font-bold text-slate-900">
                    {q.warranty_years} Years Onsite
                  </td>
                ))}
              </tr>

              {/* Vendor Rating */}
              <tr className="hover:bg-slate-50/60">
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/30">Vendor Historical Score</td>
                {quotes.map(q => (
                  <td key={q.id} className="p-4">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>{q.vendor_rating || 4.5}</span>
                      <span className="text-[10px] text-slate-400 font-normal">/ 5.0</span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* Payment Terms */}
              <tr className="hover:bg-slate-50/60">
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/30">Payment Terms</td>
                {quotes.map(q => (
                  <td key={q.id} className="p-4 font-medium text-slate-700">
                    {q.payment_terms}
                  </td>
                ))}
              </tr>

              {/* Notes & Partner Tier */}
              <tr className="hover:bg-slate-50/60">
                <td className="p-4 font-semibold text-slate-600 bg-slate-50/30">Vendor Proposal Notes</td>
                {quotes.map(q => (
                  <td key={q.id} className="p-4 text-slate-500 text-[11px] leading-relaxed">
                    {q.notes || 'Standard warranty terms applicable.'}
                  </td>
                ))}
              </tr>

              {/* Decision Action Row */}
              <tr className="bg-slate-50">
                <td className="p-4 font-bold text-slate-900">Procurement Action</td>
                {quotes.map(q => (
                  <td key={q.id} className="p-4">
                    {q.status === 'selected' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-xs bg-emerald-100 px-3 py-1.5 rounded-lg">
                        <CheckCircle className="w-4 h-4" /> Selected & PO Issued
                      </span>
                    ) : ['closed', 'cancelled'].includes(rfq.status) ? (
                      <span className="text-xs text-slate-500">Not selected</span>
                    ) : q.is_recommended ? (
                      <div className="space-y-1.5">
                        <span className="inline-flex items-center gap-1 text-purple-700 font-bold text-xs bg-purple-100 px-2.5 py-1 rounded-md">
                          <CheckCircle className="w-3.5 h-3.5" /> Recommended
                        </span>
                        <p className="mt-1 text-xs font-semibold text-amber-700">
                          Awaiting manager approval
                        </p>
                      </div>
                    ) : (
                      <button
                        onClick={() => openRecommendModal(q)}
                        className="w-full px-3 py-1.5 rounded-lg border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                      >
                        Recommend Vendor
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommendation Justification Modal */}
      <Modal
        isOpen={recommendModalOpen}
        onClose={() => setRecommendModalOpen(false)}
        title={selectedQuote ? `Recommend ${selectedQuote.vendor_name}` : 'Recommend Vendor'}
        subtitle="This selection will be forwarded to the Department Manager for final sign-off."
        maxWidth="lg"
      >
        {selectedQuote && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-400 font-semibold uppercase">Total Quotation Value</span>
                <div className="text-lg font-bold font-mono text-slate-900">
                  ₹{Number(selectedQuote.final_amount).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-semibold uppercase">Delivery Window</span>
                <div className="text-sm font-bold text-slate-800">{selectedQuote.delivery_days} days</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Commercial & Technical Justification / Rationale
              </label>
              <textarea
                rows={4}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="State why this vendor should be selected over other bids..."
                className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Example: Good price, strong vendor history, three-year warranty, acceptable delivery time.
              </p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setRecommendModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !reason.trim()}
                onClick={handleRecommendSubmit}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {submitting ? 'Submitting...' : 'Submit Recommendation for Approval'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
