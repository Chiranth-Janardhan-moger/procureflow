import React from 'react'
import type { PurchaseOrder } from '../../types'

const money = (value: unknown): string => value === null || value === undefined || !Number.isFinite(Number(value))
  ? 'Not recorded' : `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

export const PurchaseOrderContents: React.FC<{ order: PurchaseOrder }> = ({ order }) => (
  <section aria-label="Purchase items and commercial terms" className="space-y-4">
    <h3 className="text-sm font-bold">Purchased Items &amp; Terms</h3>
      <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4 text-sm">
        <div><dt className="text-xs text-slate-500">Purchase request</dt><dd>{order.pr_number || 'Not recorded'}</dd></div>
        <div><dt className="text-xs text-slate-500">RFQ / quotation</dt><dd>{order.rfq_number || '—'} / {order.quote_number || '—'}</dd></div>
        <div><dt className="text-xs text-slate-500">Required delivery</dt><dd>{String(order.expected_delivery).slice(0, 10)}</dd></div>
        <div><dt className="text-xs text-slate-500">Payment terms</dt><dd>{order.payment_terms || 'Not recorded'}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-slate-500">Deliver to</dt><dd>{order.delivery_address || 'Not recorded'}</dd></div>
        <div className="col-span-2"><dt className="text-xs text-slate-500">Request purpose</dt><dd>{order.pr_purpose || 'Not recorded'}</dd></div>
      </dl>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700"><tr><th className="p-3">Item and specification</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Agreed unit price</th><th className="p-3 text-right">Line amount</th></tr></thead>
          <tbody>{order.items?.map(item => <tr key={item.id} className="border-t border-slate-200">
            <td className="p-3"><p className="font-semibold">{item.item_name}</p><p className="mt-1 text-xs text-slate-500">{item.specification || 'No additional specification'}</p></td>
            <td className="p-3 text-right">{item.quantity}</td><td className="p-3 text-right">{money(item.quoted_unit_price)}</td><td className="p-3 text-right">{money(item.quoted_subtotal)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {order.quotation && <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-4 text-sm">
        <p>Subtotal: <strong>{money(order.quotation.subtotal)}</strong></p><p>GST / tax: <strong>{money(order.quotation.tax_amount)}</strong></p>
        <p>Discount: <strong>{money(order.quotation.discount_amount)}</strong></p><p>Warranty: <strong>{order.quotation.warranty_years} years</strong></p>
        <p>Quoted lead time: <strong>{order.quotation.delivery_days} days</strong></p>
      </div>}
  </section>
)
