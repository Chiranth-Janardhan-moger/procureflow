import React from 'react'
import { CheckCircle2, Clock, AlertCircle, CircleDot } from 'lucide-react'

export interface TimelineStep {
  title: string
  subtitle?: string
  date?: string | null
  status: 'completed' | 'current' | 'upcoming' | 'rejected'
}

interface TimelineStepperProps {
  steps: TimelineStep[]
  layout?: 'horizontal' | 'vertical'
}

export const TimelineStepper: React.FC<TimelineStepperProps> = ({ steps, layout = 'horizontal' }) => {
  if (layout === 'vertical') {
    return (
      <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200">
        {steps.map((step, idx) => {
          let icon = <CircleDot className="w-5 h-5 text-slate-300 bg-white" />
          let textClass = 'text-slate-500'

          if (step.status === 'completed') {
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 bg-white" />
            textClass = 'text-slate-900 font-semibold'
          } else if (step.status === 'current') {
            icon = <Clock className="w-5 h-5 text-indigo-600 bg-white animate-pulse" />
            textClass = 'text-indigo-600 font-semibold'
          } else if (step.status === 'rejected') {
            icon = <AlertCircle className="w-5 h-5 text-rose-600 bg-white" />
            textClass = 'text-rose-600 font-semibold'
          }

          return (
            <div key={idx} className="relative flex items-start gap-3">
              <div className="absolute -left-6 top-0.5 z-10">{icon}</div>
              <div className="flex-1">
                <div className={`text-sm ${textClass}`}>{step.title}</div>
                {step.subtitle && <p className="text-xs text-slate-500 mt-0.5">{step.subtitle}</p>}
                {step.date && <p className="text-[11px] font-mono text-slate-400 mt-0.5">{step.date}</p>}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // Horizontal Stepper
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute left-6 right-6 top-4 h-[2px] bg-slate-200 -z-0" />
        {steps.map((step, idx) => {
          const isCompleted = step.status === 'completed'
          const isCurrent = step.status === 'current'
          const isRejected = step.status === 'rejected'

          let dotClass = 'bg-white border-2 border-slate-300 text-slate-400'
          if (isCompleted) dotClass = 'bg-emerald-600 border-2 border-emerald-600 text-white shadow-xs'
          if (isCurrent) dotClass = 'bg-white border-2 border-indigo-600 text-indigo-600 shadow-indigo-100 ring-4 ring-indigo-50'
          if (isRejected) dotClass = 'bg-rose-600 border-2 border-rose-600 text-white'

          return (
            <div key={idx} className="relative z-10 flex flex-col items-center flex-1 group">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${dotClass}`}>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isRejected ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <div className="mt-2 text-center px-1">
                <p className={`text-xs font-medium truncate max-w-[120px] ${isCurrent ? 'text-indigo-600 font-bold' : isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                  {step.title}
                </p>
                {step.date && (
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{step.date}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
