import React, { useState, useEffect } from 'react'
import { api } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Category, Department } from '../../types'
import { Plus, Trash2, ArrowLeft, Send, Save, AlertCircle } from 'lucide-react'

interface ItemRow {
  id: string
  item_name: string
  category: string
  quantity: number
  estimated_unit_price: number
  specification: string
}

interface Props {
  onBack: () => void
  onCreated: () => void
}

export const CreatePurchaseRequest: React.FC<Props> = ({ onBack, onCreated }) => {
  const { user } = useAuth()
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [departmentId, setDepartmentId] = useState<number>(user?.department_id || 1)
  const [requiredDate, setRequiredDate] = useState('')
  const [priority, setPriority] = useState('medium')
  const [purpose, setPurpose] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [items, setItems] = useState<ItemRow[]>([
    {
      id: '1',
      item_name: 'Dell Latitude 7440 Laptop',
      category: 'IT Equipment',
      quantity: 5,
      estimated_unit_price: 52000,
      specification: '16GB RAM, 512GB SSD, Intel Core i7 13th Gen, 3-Yr Warranty',
    },
  ])

  useEffect(() => {
    // Set default required date to 14 days in future
    const date = new Date()
    date.setDate(date.getDate() + 14)
    setRequiredDate(date.toISOString().split('T')[0])

    loadMetadata()
  }, [])

  const loadMetadata = async () => {
    try {
      const [deptRes, catRes] = await Promise.all([api.getDepartments(), api.getCategories()])
      setDepartments(deptRes.departments)
      setCategories(catRes.categories)
    } catch (err) {
      console.error(err)
    }
  }

  const addItemRow = () => {
    setItems(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        item_name: '',
        category: categories[0]?.name || 'IT Equipment',
        quantity: 1,
        estimated_unit_price: 1000,
        specification: '',
      },
    ])
  }

  const removeItemRow = (id: string) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof ItemRow, value: any) => {
    setItems(prev =>
      prev.map(i => (i.id === id ? { ...i, [field]: value } : i))
    )
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.estimated_unit_price || 0)), 0)
  }

  const handleSubmit = async (status: 'pending' | 'draft') => {
    if (!requiredDate) {
      setError('Please provide a required by date.')
      return
    }
    if (!purpose.trim()) {
      setError('Please state the business reason/purpose for this purchase.')
      return
    }
    for (const item of items) {
      if (!item.item_name.trim()) {
        setError('All items must have a name.')
        return
      }
      if (item.quantity <= 0) {
        setError('Item quantity must be greater than 0.')
        return
      }
    }

    setLoading(true)
    setError(null)
    try {
      await api.createPurchaseRequest({
        required_date: requiredDate,
        priority,
        purpose,
        status,
        items: items.map(i => ({
          item_name: i.item_name,
          category: i.category,
          quantity: Number(i.quantity),
          estimated_unit_price: Number(i.estimated_unit_price),
          specification: i.specification,
        })),
      })
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  const grandTotal = calculateTotal()

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to My Requests
          </button>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Create Purchase Request</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit new equipment or service requisition for manager approval and procurement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit('draft')}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" /> Save Draft
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSubmit('pending')}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> {loading ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Form Fields */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Requisition Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Department</label>
            <select
              value={departmentId}
              onChange={e => setDepartmentId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Required By Date</label>
            <input
              type="date"
              value={requiredDate}
              onChange={e => setRequiredDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Priority Level</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
            >
              <option value="low">Low (Routine replenishment)</option>
              <option value="medium">Medium (Standard requirement)</option>
              <option value="high">High (Urgent project need)</option>
              <option value="urgent">Urgent (Critical blocker)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Business Purpose / Justification
          </label>
          <textarea
            rows={3}
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            placeholder="e.g., Equipment required for 10 newly recruited senior backend developers joining in Q4."
            className="w-full p-3 rounded-xl border border-slate-200 text-xs text-slate-800 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
          />
        </div>
      </div>

      {/* Items Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Itemized Breakdown</h3>
            <p className="text-xs text-slate-500">Specify items, expected quantities, and market estimates</p>
          </div>
          <button
            type="button"
            onClick={addItemRow}
            className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Another Item
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/40 space-y-3 relative transition-all"
            >
              <div className="flex items-center justify-between text-xs font-bold text-slate-500 pb-1 border-b border-slate-200/60">
                <span>Item #{idx + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItemRow(item.id)}
                    className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Item Name</label>
                  <input
                    type="text"
                    required
                    value={item.item_name}
                    onChange={e => updateItem(item.id, 'item_name', e.target.value)}
                    placeholder="e.g. Dell Latitude 7440 Laptop"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
                  <select
                    value={item.category}
                    onChange={e => updateItem(item.id, 'category', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {categories.length === 0 && <option value="IT Equipment">IT Equipment</option>}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={e => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Est. Unit Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={item.estimated_unit_price}
                    onChange={e => updateItem(item.id, 'estimated_unit_price', Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Technical Specifications / Requirements
                </label>
                <input
                  type="text"
                  value={item.specification}
                  onChange={e => updateItem(item.id, 'specification', e.target.value)}
                  placeholder="e.g. 16GB RAM, 512GB NVMe SSD, FHD Screen, 3-Yr Onsite Warranty"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="text-right text-xs font-medium text-slate-500">
                Item Subtotal:{' '}
                <span className="font-mono font-bold text-slate-900">
                  ₹{(Number(item.quantity || 0) * Number(item.estimated_unit_price || 0)).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Grand Total Bar */}
        <div className="mt-4 p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between shadow-md">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total Estimated Requisition Value
            </div>
            <div className="text-[11px] text-slate-400">{items.length} item line(s) specified</div>
          </div>
          <div className="text-2xl font-extrabold font-mono text-indigo-400">
            ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  )
}
