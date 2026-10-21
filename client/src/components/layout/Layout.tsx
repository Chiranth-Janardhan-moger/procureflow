import React from 'react'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'

interface LayoutProps {
  currentView: string
  onNavigate: (view: string) => void
  children: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onNavigate, children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentView={currentView} onNavigate={onNavigate} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  )
}
