import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { Department, Category } from '../../types'
import { Modal } from '../../components/common/Modal'
import { Building, Tags, Plus, PlusCircle, AlertCircle } from 'lucide-react'

export const DepartmentCategoryPage: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Dept Modal
  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [deptCode, setDeptCode] = useState('')
  const [deptName, setDeptName] = useState('')
  const [deptSubmitting, setDeptSubmitting] = useState(false)

  // Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catName, setCatName] = useState('')
  const [catDesc, setCatDesc] = useState('')
  const [catSubmitting, setCatSubmitting] = useState(false)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [dRes, cRes] = await Promise.all([api.getDepartments(), api.getCategories()])
      setDepartments(dRes.departments)
      setCategories(cRes.categories)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deptCode || !deptName) return
    setDeptSubmitting(true)
    setError(null)
    try {
      await api.createDepartment({ code: deptCode, name: deptName })
      setDeptModalOpen(false)
      setDeptCode('')
      setDeptName('')
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to create department')
    } finally {
      setDeptSubmitting(false)
    }
  }

  const handleCreateCat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!catName) return
    setCatSubmitting(true)
    setError(null)
    try {
      await api.createCategory({ name: catName, description: catDesc })
      setCatModalOpen(false)
      setCatName('')
      setCatDesc('')
      await loadData()
    } catch (err: any) {
      setError(err.message || 'Failed to create category')
    } finally {
      setCatSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
          Departments & Categories
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Manage organizational departments and item categories.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Departments Column */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Departments ({departments.length})
              </h2>
            </div>
            <button
              onClick={() => setDeptModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Dept
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {departments.map(d => (
              <div key={d.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/50">
                      {d.code}
                    </span>
                    <span className="text-sm font-bold text-slate-800">{d.name}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Manager: {d.manager_name || 'Anita Roy'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Categories Column */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Tags className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Procurement Categories ({categories.length})
              </h2>
            </div>
            <button
              onClick={() => setCatModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Category
            </button>
          </div>

          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {categories.map(c => (
              <div key={c.id} className="p-4 hover:bg-slate-50/80 transition-colors flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-slate-800">{c.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {c.description || 'Standard procurement classification'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dept Modal */}
      <Modal
        isOpen={deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        title="Create Department Cost Center"
        maxWidth="md"
      >
        <form onSubmit={handleCreateDept} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department Code</label>
            <input
              type="text"
              required
              placeholder="e.g. FIN, MKT, SEC"
              value={deptCode}
              onChange={e => setDeptCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Department Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Corporate Finance"
              value={deptName}
              onChange={e => setDeptName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setDeptModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deptSubmitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {deptSubmitting ? 'Creating...' : 'Save Department'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal
        isOpen={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title="Create Procurement Category"
        maxWidth="md"
      >
        <form onSubmit={handleCreateCat} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Cloud Infrastructure"
              value={catName}
              onChange={e => setCatName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Scope of items and supplier goods"
              value={catDesc}
              onChange={e => setCatDesc(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCatModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={catSubmitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {catSubmitting ? 'Creating...' : 'Save Category'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
