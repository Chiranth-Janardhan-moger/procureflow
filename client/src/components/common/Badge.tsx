import React from 'react'

export interface BadgeProps {
  status: string
  label?: string
  size?: 'sm' | 'md'
  showDot?: boolean
}

export const Badge: React.FC<BadgeProps> = ({ status, label, size = 'sm', showDot = true }) => {
  const norm = status?.toLowerCase().replace(/_/g, ' ') || 'unknown'
  const displayLabel = label || norm.charAt(0).toUpperCase() + norm.slice(1)

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200'
  let dotColor = 'bg-slate-400'

  if (['approved', 'active', 'paid', 'selected', 'delivered', 'completed'].includes(status?.toLowerCase())) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-emerald-500/5'
    dotColor = 'bg-emerald-500'
  } else if (['pending', 'evaluation', 'draft', 'pending_approval', 'pending_payment'].includes(status?.toLowerCase())) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200/80'
    dotColor = 'bg-amber-500'
  } else if (['rejected', 'cancelled', 'disabled', 'failed', 'urgent'].includes(status?.toLowerCase())) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200/80'
    dotColor = 'bg-rose-500'
  } else if (['in_procurement', 'processing', 'dispatched', 'issued', 'open', 'high'].includes(status?.toLowerCase())) {
    colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
    dotColor = 'bg-indigo-500'
  } else if (['medium', 'submitted', 'verified'].includes(status?.toLowerCase())) {
    colorClasses = 'bg-sky-50 text-sky-700 border-sky-200/80'
    dotColor = 'bg-sky-500'
  } else if (['recommended'].includes(status?.toLowerCase())) {
    colorClasses = 'bg-purple-50 text-purple-700 border-purple-200/80 ring-1 ring-purple-400/20'
    dotColor = 'bg-purple-500'
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${colorClasses} ${sizeClasses} transition-colors select-none`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColor} ${status === 'urgent' ? 'animate-ping' : ''}`}
        />
      )}
      <span className="capitalize">{displayLabel}</span>
    </span>
  )
}
