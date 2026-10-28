import React, { useEffect, useState } from 'react'
import { api } from '../../services/api'
import { Vendor, Category } from '../../types'
import { Badge } from '../../components/common/Badge'
import { Modal } from '../../components/common/Modal'
import { Building2, Plus, Star, Phone, Mail, MapPin, Search, AlertCircle } from 'lucide-react'

export const VendorDirectoryPage: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Add Vendor Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [address, setAddress] = useState('')
  const [gstNumber, setGstNumber] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [rating, setRating] = useState(4.5)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadVendors()
  }, [])

  const loadVendors = async () => {
    setLoading(true)
    try {
      const [vRes, cRes] = await Promise.all([api.getVendors(), api.getCategories()])
      setVendors(vRes.vendors)
      setCategories(cRes.categories)
      if (cRes.categories.length > 0) setCategoryId(cRes.categories[0].id)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email) {
      setError('Company Name and Business Email are required.')
      return
    }

    if (password.trim().length < 12 || new TextEncoder().encode(password).length > 72) {
      setError('Choose a vendor login password of at least 12 characters and no more than 72 UTF-8 bytes.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await api.createVendor({
        name,
        email,
        password,
        phone,
        contact_person: contactPerson,
        address,
        gst_number: gstNumber,
        category_id: categoryId ? Number(categoryId) : null,
        rating,
      })
      alert(`Vendor ${name} registered successfully! The vendor can sign in with the email and password you supplied.`)
      setModalOpen(false)
      resetForm()
      await loadVendors()
    } catch (err: any) {
      setError(err.message || 'Failed to add vendor')
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setName('')
    setEmail('')
    setPassword('')
    setPhone('')
    setContactPerson('')
    setAddress('')
    setGstNumber('')
    setRating(4.5)
    setError(null)
  }

  const filteredVendors = vendors.filter(v => {
    const q = search.toLowerCase()
    return (
      v.name.toLowerCase().includes(q) ||
      v.vendor_code.toLowerCase().includes(q) ||
      (v.contact_person && v.contact_person.toLowerCase().includes(q)) ||
      (v.category_name && v.category_name.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans">
            Vendor Directory
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Maintain registered vendors and contact details.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Vendor
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search vendor by name, code, contact..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <span className="text-xs font-bold text-slate-500">{filteredVendors.length} verified vendors</span>
        </div>

        {/* Vendors Grid / Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50/30">
          {filteredVendors.map(v => (
            <div
              key={v.id}
              className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/50">
                      {v.vendor_code}
                    </span>
                    <h2 className="text-base font-extrabold text-slate-900 mt-1">{v.name}</h2>
                    <p className="text-xs text-indigo-600 font-semibold">{v.category_name || 'IT Equipment'}</p>
                  </div>
                  <div className="flex items-center gap-1 font-bold text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg border border-amber-200">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>{v.rating}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">{v.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{v.phone || '+91 80 2345 6789'} ({v.contact_person || 'Representative'})</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-1">{v.address || 'Bengaluru, Karnataka'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="font-mono text-[11px] text-slate-400">GST: {v.gst_number || '29ABCDE1234F1Z5'}</span>
                <Badge status={v.status} size="sm" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Vendor Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setPassword('')
        }}
        title="Onboard New Supplier Vendor"
        subtitle="Registers supplier profile and provisions portal login credentials"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateVendor} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Legal Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Tech Solutions Ltd"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business Email</label>
              <input
                type="email"
                required
                placeholder="bids@acmetech.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                placeholder="+91 80 1234 5678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                placeholder="Account Manager Name"
                value={contactPerson}
                onChange={e => setContactPerson(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN Number</label>
              <input
                type="text"
                placeholder="29AAAAA0000A1Z5"
                value={gstNumber}
                onChange={e => setGstNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Supply Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Rating</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="5"
                value={rating}
                onChange={e => setRating(parseFloat(e.target.value) || 4.5)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="vendor-login-password" className="block text-xs font-semibold text-slate-700 mb-1">Vendor Login Password</label>
            <input
              id="vendor-login-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={72}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">Use a unique password with at least 12 characters. Share it privately with the vendor.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Business Address</label>
            <textarea
              rows={2}
              placeholder="Full office or warehouse address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setModalOpen(false)
                setPassword('')
              }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Complete Vendor Onboarding'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
