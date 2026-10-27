export class PoApprovalError extends Error {
  constructor(message: string, public readonly statusCode: 403 | 404 | 409) {
    super(message)
    this.name = 'PoApprovalError'
  }
}

interface ApprovalContext {
  is_recommended: boolean
  status: string
  department_id: number | null
  rfq_status: string
  request_status: string
}

/** The manager's PO action signs off the recommendation and issues its order together. */
export function requireManagerApprovedQuotation<T extends ApprovalContext>(
  user: { role: string; department_id: number | null },
  quote: T | undefined,
  hasOrder: boolean
): T {
  if (user.role !== 'manager') throw new PoApprovalError('Manager approval is required to issue a purchase order.', 403)
  if (!quote) throw new PoApprovalError('Quotation or linked purchase request not found.', 404)
  if (user.department_id === null || quote.department_id !== user.department_id) {
    throw new PoApprovalError('Only the purchase request department manager can approve this vendor selection.', 403)
  }
  if (hasOrder) throw new PoApprovalError('A purchase order already exists for this RFQ.', 409)
  if (!quote.is_recommended || quote.status !== 'recommended') {
    throw new PoApprovalError('Procurement must recommend this quotation before manager approval.', 409)
  }
  if (!['open', 'evaluation'].includes(quote.rfq_status) || quote.request_status !== 'in_procurement') {
    throw new PoApprovalError('This RFQ is not awaiting vendor selection approval.', 409)
  }
  return quote
}