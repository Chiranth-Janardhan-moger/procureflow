import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { UserRole } from '../../types'
import {
  Bell,
  ChevronDown,
  LogOut,
  UserCheck,
  Shield,
  Briefcase,
  Building2,
  User as UserIcon,
  Check,
  ExternalLink,
  Layers,
  Sun,
  Moon,
} from 'lucide-react'

export const Navbar: React.FC = () => {
  const { user, logout, switchRole, notifications, unreadCount, markNotificationRead } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const [showNotifMenu, setShowNotifMenu] = useState(false)

  const demoRoles: Array<{ role: UserRole; name: string; title: string; icon: any; color: string }> = [
    {
      role: 'employee',
      name: 'Rahul Sharma',
      title: 'IT Developer (Employee)',
      icon: UserIcon,
      color: 'bg-blue-50 text-blue-600',
    },
    {
      role: 'manager',
      name: 'Anita Roy',
      title: 'IT Dept Manager',
      icon: Briefcase,
      color: 'bg-purple-50 text-purple-600',
    },
    {
      role: 'procurement_officer',
      name: 'Kiran Patel',
      title: 'Lead Procurement Officer',
      icon: Layers,
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      role: 'vendor',
      name: 'TechWorld Solutions',
      title: 'Vendor / External Supplier',
      icon: Building2,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      role: 'admin',
      name: 'Priya Nair',
      title: 'Enterprise System Admin',
      icon: Shield,
      color: 'bg-amber-50 text-amber-600',
    },
  ]

  const handleRoleSelect = (role: UserRole) => {
    switchRole(role)
    setShowRoleMenu(false)
  }

  return (
    <header className="sticky top-0 z-40 h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between transition-colors">
      {/* Brand & Context */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 dark:text-white tracking-tight text-base font-sans">ProcureFlow</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 uppercase tracking-wider border border-indigo-200/60 dark:border-indigo-800">
                Enterprise
              </span>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-400 font-medium hidden sm:block">Procurement & Vendor Lifecycle Platform</p>
          </div>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Demo Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => {
              setShowRoleMenu(!showRoleMenu)
              setShowNotifMenu(false)
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-2xs"
            title="Switch demo persona to test workflows"
          >
            <UserCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="hidden md:inline font-semibold text-slate-500 dark:text-slate-400">Switch Demo Role:</span>
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-none">
              {user?.name?.split(' ')[0] || 'Role'} ({user?.role?.replace('_', ' ')})
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showRoleMenu && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200/90 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-900 dark:text-white">Switch Demo Persona</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Explore the full procurement journey across all 5 roles</p>
              </div>
              <div className="p-1 space-y-1">
                {demoRoles.map(item => {
                  const Icon = item.icon
                  const isCurrent = user?.role === item.role
                  return (
                    <button
                      key={item.role}
                      onClick={() => handleRoleSelect(item.role)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        isCurrent
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-bold border border-indigo-200/60 dark:border-indigo-800'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md ${item.color}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-400 font-normal">{item.title}</div>
                        </div>
                      </div>
                      {isCurrent && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-transparent dark:border-slate-800"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4.5 h-4.5 text-amber-400 animate-in spin-in-90 duration-200" />
          ) : (
            <Moon className="w-4.5 h-4.5 text-slate-600 animate-in spin-in-90 duration-200" />
          )}
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifMenu(!showNotifMenu)
              setShowRoleMenu(false)
            }}
            className="relative p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200/90 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Notifications & Workflow Alerts</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{unreadCount} unread actions</p>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">No notifications yet.</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                        !n.is_read ? 'bg-indigo-50/30 dark:bg-indigo-950/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-xs ${!n.is_read ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                          {n.title}
                        </p>
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-1" />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-[9px] font-mono text-slate-400 mt-1">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Pill & Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="hidden lg:block text-left leading-tight">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{user?.name}</div>
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{user?.role?.replace('_', ' ')}</div>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors ml-1 cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
