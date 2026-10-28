import type { RFQ } from '../types'

export function canSubmitQuotation(rfq: Pick<RFQ, 'status' | 'has_submitted_quotation'> & Partial<Pick<RFQ, 'deadline'>>): boolean {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const today = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
  const withinDeadline = !rfq.deadline || rfq.deadline.slice(0, 10) >= today
  return ['open', 'evaluation'].includes(rfq.status) && !rfq.has_submitted_quotation && withinDeadline
}