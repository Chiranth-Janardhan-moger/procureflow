import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { UserRole } from '../../types'
import { Layers, ShieldCheck, ArrowRight, UserCheck, Lock } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const { login, switchRole } = useAuth()
  const [email, setEmail] = useState('rahul@company.com')
  const [password, setPassword] = useState('password123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoSwitch = async (role: UserRole) => {
    setError(null)
    try {
      await switchRole(role)
    } catch (err: any) {
      setError(err.message || 'Demo login failed')
    }
  }

  const demoAccounts: Array<{ label: string; role: UserRole; email: string; pass: string; dept: string }> = [
    { label: 'Employee', role: 'employee', email: 'rahul@company.com', pass: 'password123', dept: 'IT Tech' },
    { label: 'Manager', role: 'manager', email: 'anita@company.com', pass: 'password123', dept: 'IT Approvals' },
    { label: 'Procurement', role: 'procurement_officer', email: 'kiran@company.com', pass: 'password123', dept: 'Supply Chain' },
    { label: 'Vendor', role: 'vendor', email: 'sales@techworld.com', pass: 'vendor123', dept: 'TechWorld Supplier' },
    { label: 'Admin', role: 'admin', email: 'admin@company.com', pass: 'admin123', dept: 'System Admin' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background radial gradient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white shadow-xl shadow-indigo-500/25 mb-4">
          <Layers className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight font-sans">ProcureFlow</h2>
        <p className="mt-1.5 text-sm text-slate-400">Enterprise Procurement & Vendor Management System</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-slate-900 border border-slate-800 py-8 px-6 shadow-2xl rounded-2xl sm:px-10">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Company Email / User ID
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <span className="text-[11px] text-slate-500">Contact admin for reset</span>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign in to Console'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Personas */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <UserCheck className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Instant 1-Click Demo Login
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {demoAccounts.map(demo => (
                <button
                  key={demo.role}
                  type="button"
                  onClick={() => handleDemoSwitch(demo.role)}
                  className="text-left p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 transition-all group cursor-pointer"
                >
                  <div className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">
                    {demo.label}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{demo.dept}</div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-slate-500 text-center flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" /> Internal system. Public signup is disabled per enterprise policy.
            </p>
          </div>
        </div>

        {/* Neon PostgreSQL footer badge */}
        <div className="mt-6 text-center text-xs text-slate-500">
          Powered by <span className="text-indigo-400 font-semibold">React</span>, <span className="text-slate-300 font-semibold">Node.js</span> & <span className="text-emerald-400 font-semibold">Neon PostgreSQL</span>
        </div>
      </div>
    </div>
  )
}
