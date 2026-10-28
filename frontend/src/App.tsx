import React, { useState, useEffect } from 'react'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Layout } from './components/layout/Layout'
import { LoginPage } from './pages/auth/LoginPage'
import { EmployeeDashboard } from './pages/employee/EmployeeDashboard'
import { CreatePurchaseRequest } from './pages/employee/CreatePurchaseRequest'
import { ManagerDashboard } from './pages/manager/ManagerDashboard'
import { ProcurementDashboard } from './pages/procurement/ProcurementDashboard'
import { QuotationComparisonPage } from './pages/procurement/QuotationComparisonPage'
import { PurchaseOrdersPage } from './pages/procurement/PurchaseOrdersPage'
import { VendorDashboard } from './pages/vendor/VendorDashboard'
import { UserManagementPage } from './pages/admin/UserManagementPage'
import { DepartmentCategoryPage } from './pages/admin/DepartmentCategoryPage'
import { AuditLogsPage } from './pages/admin/AuditLogsPage'
import { ReportsPage } from './pages/reports/ReportsPage'
import { VendorDirectoryPage } from './pages/vendors/VendorDirectoryPage'
import { InvoicesPage } from './pages/invoices/InvoicesPage'

const AppContent: React.FC = () => {
  const { user, loading } = useAuth()
  const [currentView, setCurrentView] = useState('dashboard')
  const [targetPoId, setTargetPoId] = useState<number | null>(null)
  const [targetRfqId, setTargetRfqId] = useState<number | null>(null)

  // Reset to default dashboard on user role change
  useEffect(() => {
    if (user) {
      setCurrentView('dashboard')
      setTargetPoId(null)
      setTargetRfqId(null)
    }
  }, [user?.id, user?.role])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-900 dark:text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Loading ProcureFlow...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  const renderView = () => {
    // Shared views accessible across roles
    if (currentView === 'reports') {
      return <ReportsPage />
    }
    if (currentView === 'vendors') {
      return <VendorDirectoryPage />
    }
    if (currentView === 'invoices') {
      return <InvoicesPage />
    }
    if (currentView === 'purchase-orders') {
      return <PurchaseOrdersPage initialPoId={targetPoId} />
    }
    if (currentView === 'comparison') {
      if (!targetRfqId) return <div className="space-y-3 p-6"><p>Select Compare Matrix on an active RFQ in the Procurement dashboard.</p><button type="button" className="rounded-lg bg-indigo-600 px-4 py-2 text-white" onClick={() => setCurrentView('dashboard')}>Back to Procurement Dashboard</button></div>
      return <QuotationComparisonPage rfqId={targetRfqId} onBack={() => { setTargetRfqId(null); setCurrentView('dashboard') }} />
    }

    // Role-specific rendering
    switch (user.role) {
      case 'employee':
        if (currentView === 'create-pr') {
          return (
            <CreatePurchaseRequest
              onBack={() => setCurrentView('dashboard')}
              onCreated={() => setCurrentView('dashboard')}
            />
          )
        }
        return <EmployeeDashboard onCreateRequest={() => setCurrentView('create-pr')} />

      case 'manager':
        return <ManagerDashboard />

      case 'procurement_officer':
        return (
          <ProcurementDashboard
            onNavigateToComparison={rfqId => {
              setTargetRfqId(rfqId)
              setCurrentView('comparison')
            }}
            onNavigateToPo={poId => {
              setTargetPoId(poId)
              setCurrentView('purchase-orders')
            }}
          />
        )

      case 'vendor':
        return <VendorDashboard />

      case 'admin':
        if (currentView === 'departments') {
          return <DepartmentCategoryPage />
        }
        if (currentView === 'audit-logs') {
          return <AuditLogsPage />
        }
        return <UserManagementPage />

      default:
        return <EmployeeDashboard onCreateRequest={() => setCurrentView('create-pr')} />
    }
  }

  return (
    <Layout currentView={currentView} onNavigate={view => { setTargetPoId(null); setTargetRfqId(null); setCurrentView(view) }}>
      <React.Fragment key={`${user.id}-${user.role}`}>{renderView()}</React.Fragment>
    </Layout>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}
