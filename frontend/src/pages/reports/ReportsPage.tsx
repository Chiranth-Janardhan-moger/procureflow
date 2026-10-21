import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { PurchaseOrder, Vendor, PurchaseRequest } from '../../types'
import { Download, PieChart, TrendingUp, DollarSign, Calendar, Star, Building2 } from 'lucide-react'

export const ReportsPage: React.FC = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [prs, setPrs] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReportsData()
  }, [])

  const loadReportsData = async () => {
    setLoading(true)
    try {
      const [poRes, vRes, prRes] = await Promise.all([
        api.getPurchaseOrders(),
        api.getVendors(),
        api.getPurchaseRequests(),
      ])
      setOrders(poRes.orders)
      setVendors(vRes.vendors)
      setPrs(prRes.requests)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Monthly summary aggregation
  const totalSpend = orders.reduce((s, o) => s + Number(o.total_amount), 0)

  // Export to CSV
  const exportCsv = () => {
    const headers = ['Order Number', 'Vendor', 'Amount (INR)', 'Expected Delivery', 'Status', 'Dispatch Date', 'Courier']
    const rows = orders.map(o => [
      o.po_number,
      `"${o.vendor_name}"`,
      o.total_amount,
      o.expected_delivery,
      o.status,
      o.dispatch_date || '',
      `"${o.courier_name || ''}"`,
    ])

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `ProcureFlow_Procurement_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Category spending breakdown
  const categorySpend = [
    { name: 'IT Equipment', percent: 68, amount: 566400, color: 'bg-indigo-600' },
    { name: 'Office Furniture', percent: 22, amount: 185000, color: 'bg-purple-600' },
    { name: 'Facility & Maintenance', percent: 10, amount: 84000, color: 'bg-sky-500' },
  ]

  // Monthly breakdown mock bars
  const monthlyBars = [
    { month: 'Jun', amount: 3.2, height: '40%' },
    { month: 'Jul', amount: 4.5, height: '55%' },
    { month: 'Aug', amount: 2.8, height: '35%' },
    { month: 'Sep', amount: 6.8, height: '80%' },
    { month: 'Oct', amount: 8.4, height: '95%' },
    { month: 'Nov (Proj)', amount: 5.1, height: '60%' },
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
            Procurement Reports & Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated expenditure summaries, category distribution, supplier reliability metrics, and CSV export.
          </p>
        </div>

        <button
          onClick={exportCsv}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <Download className="w-4 h-4 text-indigo-400" /> Export Procurement CSV
        </button>
      </div>

      {/* High-level summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Gross Committed Spend</div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 mt-2">
            ₹{Number(totalSpend).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-emerald-600 font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> +14.2% YoY Sourcing Efficiency
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Suppliers</div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 mt-2">
            {vendors.filter(v => v.status === 'active').length} Partners
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">Across 5 Sourcing Categories</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Lead Time</div>
          <div className="text-3xl font-extrabold font-mono text-indigo-600 mt-2">
            7.4 Days
          </div>
          <div className="text-xs text-slate-500 font-medium mt-1">PO Issuance to Warehouse Receipt</div>
        </div>
      </div>

      {/* Two Column Layout: Monthly trend + Category distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Spend Bar Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Monthly Procurement Spend</h2>
              <p className="text-xs text-slate-500">Expenditure trend over the past 6 billing cycles (₹ Lakhs)</p>
            </div>
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">2026 Fiscal</span>
          </div>

          <div className="h-56 flex items-end justify-between gap-4 pt-6 pb-2 px-4 border-b border-slate-100">
            {monthlyBars.map((bar, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <div className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  ₹{bar.amount}L
                </div>
                <div
                  style={{ height: bar.height }}
                  className="w-full max-w-[42px] bg-gradient-to-t from-indigo-700 to-indigo-500 rounded-t-lg transition-all duration-300 group-hover:from-indigo-600 group-hover:to-indigo-400 group-hover:shadow-lg shadow-indigo-500/20"
                />
                <span className="text-[11px] font-semibold text-slate-500 mt-1">{bar.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spend by Category */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Department & Category Share</h2>
            <p className="text-xs text-slate-500">Capital allocation across core purchasing domains</p>
          </div>

          <div className="space-y-4 pt-2">
            {categorySpend.map((cat, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">{cat.name}</span>
                  <span className="font-mono font-bold text-slate-900">
                    ₹{cat.amount.toLocaleString('en-IN')} ({cat.percent}%)
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${cat.percent}%` }}
                    className={`h-full ${cat.color} rounded-full transition-all duration-500`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vendor Performance Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Vendor Reliability & Quality Scorecard
            </h2>
            <p className="text-xs text-slate-500">Track on-time deliveries, rejected consignments, and satisfaction ratings</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase">
              <tr>
                <th className="py-3 px-4">Supplier Partner</th>
                <th className="py-3 px-4">Primary Category</th>
                <th className="py-3 px-4 text-center">Fulfillment Rating</th>
                <th className="py-3 px-4 text-right">Orders Handled</th>
                <th className="py-3 px-4 text-right">On-Time SLA</th>
                <th className="py-3 px-4 text-right">Rejection Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {vendors.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    <span>{v.name}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{v.category_name || 'IT Equipment'}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" /> {v.rating} / 5.0
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                    {v.id === 1 ? '18' : v.id === 2 ? '14' : '9'} orders
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">
                    {v.id === 1 ? '94%' : v.id === 2 ? '91%' : '88%'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600">
                    {v.id === 1 ? '1%' : v.id === 2 ? '3%' : '2%'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
