import React from 'react'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: string
  trendType?: 'positive' | 'negative' | 'neutral'
  color?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky'
  onClick?: () => void
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendType = 'positive',
  color = 'indigo',
  onClick,
}) => {
  const colorMap = {
    indigo: {
      bg: 'bg-indigo-50/70 text-indigo-600 border-indigo-100',
      border: 'hover:border-indigo-200',
      glow: 'group-hover:shadow-indigo-500/5',
    },
    emerald: {
      bg: 'bg-emerald-50/70 text-emerald-600 border-emerald-100',
      border: 'hover:border-emerald-200',
      glow: 'group-hover:shadow-emerald-500/5',
    },
    amber: {
      bg: 'bg-amber-50/70 text-amber-600 border-amber-100',
      border: 'hover:border-amber-200',
      glow: 'group-hover:shadow-amber-500/5',
    },
    rose: {
      bg: 'bg-rose-50/70 text-rose-600 border-rose-100',
      border: 'hover:border-rose-200',
      glow: 'group-hover:shadow-rose-500/5',
    },
    sky: {
      bg: 'bg-sky-50/70 text-sky-600 border-sky-100',
      border: 'hover:border-sky-200',
      glow: 'group-hover:shadow-sky-500/5',
    },
  }

  const selectedColor = colorMap[color]

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md ' + selectedColor.border : ''
      } ${selectedColor.glow}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</span>
        <div className={`p-2 rounded-lg border ${selectedColor.bg} transition-transform duration-200 group-hover:scale-105`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-slate-900 font-sans">{value}</div>
        {(subtitle || trend) && (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            {trend && (
              <span
                className={`font-semibold ${
                  trendType === 'positive'
                    ? 'text-emerald-600'
                    : trendType === 'negative'
                    ? 'text-rose-600'
                    : 'text-slate-600'
                }`}
              >
                {trend}
              </span>
            )}
            {subtitle && <span>{subtitle}</span>}
          </div>
        )}
      </div>
    </div>
  )
}
