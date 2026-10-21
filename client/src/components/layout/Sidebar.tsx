import React from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  CheckCircle,
  Users,
  Send,
  Scale,
  ShoppingCart,
  Truck,
  CreditCard,
  Building2,
  Building,
  ShieldCheck,
  History,
  PieChart,
  Package,
  Receipt,
  Tags,
} from 'lucide-react'

interface SidebarProps {
  currentView: string
  onNavigate: (view: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { user } = useAuth()
  if (!user) return null

  // Define menus per role
  const getMenuItems = () => {
    switch (user.role) {
      case 'employee':
        return [
          { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
          { id: 'create-pr', label: 'Create Purchase Request', icon: FilePlus2, highlight: true },
          { id: 'my-prs', label: 'My Purchase Requests', icon: FileText },
        ]

      case 'manager':
        return [
          { id: 'dashboard', label: 'Manager Dashboard', icon: LayoutDashboard },
          { id: 'pending-approvals', label: 'PR Approvals', icon: CheckCircle },
          { id: 'vendor-approvals', label: 'Vendor Approvals', icon: Users },
          { id: 'reports', label: 'Department Analytics', icon: PieChart },
        ]

      case 'procurement_officer':
        return [
          { id: 'dashboard', label: 'Procurement Console', icon: LayoutDashboard },
          { id: 'approved-prs', label: 'Approved PR Queue', icon: FileText },
          { id: 'rfqs', label: 'RFQs & Bidding', icon: Send },
          { id: 'comparison', label: 'Quotation Comparison', icon: Scale, highlight: true },
          { id: 'purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
          { id: 'deliveries', label: 'Deliveries & GRN', icon: Truck },
          { id: 'invoices', label: 'Invoices & Payments', icon: CreditCard },
          { id: 'vendors', label: 'Vendor Directory', icon: Building2 },
        ]

      case 'vendor':
        return [
          { id: 'dashboard', label: 'Vendor Portal', icon: LayoutDashboard },
          { id: 'vendor-rfqs', label: 'Open RFQs (Bid Requests)', icon: Send },
          { id: 'vendor-orders', label: 'Purchase Orders', icon: Package },
          { id: 'vendor-invoices', label: 'Invoices & Settlements', icon: Receipt },
        ]

      case 'admin':
        return [
          { id: 'dashboard', label: 'Admin Command', icon: LayoutDashboard },
          { id: 'user-management', label: 'User Management', icon: Users },
          { id: 'departments', label: 'Departments & Categories', icon: Tags },
          { id: 'vendors', label: 'Vendor Directory', icon: Building2 },
          { id: 'audit-logs', label: 'Audit Trail (Immutable)', icon: History },
          { id: 'reports', label: 'System Reports', icon: PieChart },
        ]

      default:
        return []
    }
  }

  const menuItems = getMenuItems()

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 min-h-[calc(100vh-4rem)]">
      {/* Navigation list */}
      <div className="p-3.5 space-y-6">
        <div>
          <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {user.role === 'vendor' ? 'Vendor Partner Space' : `${user.role.replace('_', ' ')} workspace`}
          </div>

          <nav className="space-y-1">
            {menuItems.map(item => {
              const Icon = item.icon
              const isActive = currentView === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : item.highlight
                      ? 'text-indigo-400 hover:bg-slate-800/80 hover:text-white font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.highlight && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Common reports link for internal users */}
        {user.role !== 'vendor' && user.role !== 'admin' && (
          <div>
            <div className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Intelligence
            </div>
            <nav className="space-y-1">
              <button
                onClick={() => onNavigate('reports')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  currentView === 'reports'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <PieChart className="w-4 h-4 text-slate-400" />
                <span>Reports & Analytics</span>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Database connection badge at bottom */}
      <div className="p-3.5 border-t border-slate-800/90 bg-slate-950/40">
        <div className="px-3 py-2.5 rounded-lg bg-slate-800/50 border border-slate-700/60 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-slate-200">Database Engine</span>
          </div>
          <p className="text-slate-400 mt-1 text-[10px] leading-relaxed">
            PostgreSQL on Neon ready. Seamless fallback activated.
          </p>
        </div>
      </div>
    </aside>
  )
}
