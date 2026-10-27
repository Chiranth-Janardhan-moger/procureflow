export class RfqCreationError extends Error {
  constructor(message: string, public readonly statusCode: 404 | 409) {
    super(message)
    this.name = 'RfqCreationError'
  }
}

export function requireRfqEligibleRequest<T extends { status: string }>(request: T | undefined, hasRfq: boolean): T {
  if (!request) throw new RfqCreationError('Purchase request not found.', 404)
  if (hasRfq) throw new RfqCreationError('An RFQ already exists for this purchase request.', 409)
  if (request.status !== 'approved') {
    throw new RfqCreationError('Only approved purchase requests awaiting procurement can start an RFQ.', 409)
  }
  return request
}