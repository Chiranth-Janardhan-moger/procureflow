export class QuotationSubmissionError extends Error {
  constructor(message: string, public readonly statusCode: 403 | 404 | 409) {
    super(message)
    this.name = 'QuotationSubmissionError'
  }
}

export function requireOpenInvitedTender(
  rfq: { status: string } | undefined,
  isInvited: boolean,
  alreadySubmitted: boolean
): void {
  if (!rfq) throw new QuotationSubmissionError('RFQ not found.', 404)
  if (!isInvited) throw new QuotationSubmissionError('Your vendor account is not invited to this RFQ.', 403)
  if (!['open', 'evaluation'].includes(rfq.status)) {
    throw new QuotationSubmissionError('This RFQ is closed for bidding.', 409)
  }
  if (alreadySubmitted) throw new QuotationSubmissionError('Your vendor account has already submitted a quotation for this RFQ.', 409)
}