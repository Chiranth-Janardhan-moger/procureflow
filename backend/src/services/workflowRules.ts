import type { Row } from './workflowStore.js'

export class WorkflowError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 | 404 | 409) { super(message); this.name = 'WorkflowError' }
}
export function errorStatus(error: unknown): number {
  if (error && typeof error === 'object' && 'code' in error && error.code === '23505') return 409
  if (error && typeof error === 'object' && 'statusCode' in error && [400, 403, 404, 409].includes(Number(error.statusCode))) return Number(error.statusCode)
  return 500
}
export function ensure(condition: unknown, message: string, code: 400 | 403 | 404 | 409 = 400): asserts condition {
  if (!condition) throw new WorkflowError(message, code)
}
export function role(user: Row, roles: string[]): void { ensure(roles.includes(user.role), 'Your role cannot perform this action.', 403) }
export function entityId(value: unknown): number {
  const id = Number(value)
  ensure(Number.isSafeInteger(id) && id > 0, 'A valid record ID is required.')
  return id
}
export function whole(value: unknown, name: string, minimum = 0): number {
  const number = Number(value)
  ensure(value !== null && value !== '' && Number.isSafeInteger(number) && number >= minimum, `${name} must be a whole number of at least ${minimum}.`)
  return number
}
export function amount(value: unknown, name: string, positive = false): number {
  const number = Number(value)
  ensure(value !== null && value !== '' && Number.isFinite(number) && number >= (positive ? 0.01 : 0), `${name} must be a valid ${positive ? 'positive' : 'non-negative'} amount.`)
  ensure(Math.abs(number * 100 - Math.round(number * 100)) < 0.00001, `${name} must have at most two decimal places.`)
  return Math.round(number * 100) / 100
}
export function text(value: unknown, name: string): string {
  ensure(typeof value === 'string' && value.trim().length > 0, `${name} is required.`)
  return value.trim()
}
export function date(value: unknown, name: string): string {
  const normalized = value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
    : String(value ?? '').slice(0, 10)
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(normalized), `${name} must be a valid date.`)
  const parsed = new Date(`${normalized}T00:00:00Z`)
  ensure(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized, `${name} must be a valid date.`)
  return normalized
}
export function today(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')
}
export function managerOf(user: Row, request: Row): void {
  role(user, ['manager'])
  ensure(user.department_id !== null && user.department_id === request.department_id, 'Only this request department manager can approve it.', 403)
}
export function requestVisibleTo(user: Row, request: Row): void {
  if (['admin', 'procurement_officer'].includes(user.role)) return
  if (user.role === 'manager') return managerOf(user, request)
  ensure(user.role === 'employee' && request.user_id === user.id, 'You cannot access another user purchase request.', 403)
}

export function quoteTotals(items: Row[], input: Row): Row {
  ensure(items.length > 0, 'This RFQ has no requested items.', 409)
  let offered = input.line_items
  if (!offered && items.length === 1) offered = [{ pr_item_id: items[0].id, unit_price: input.unit_price }]
  ensure(Array.isArray(offered) && offered.length === items.length, 'Quote every requested line item exactly once.')
  const seen = new Set<number>()
  const lines = offered.map((bid: Row) => {
    const id = entityId(bid.pr_item_id)
    const item = items.find(candidate => candidate.id === id)
    ensure(item && !seen.has(id), 'Quotation line items must match this RFQ without duplicates.')
    seen.add(id)
    const price = amount(bid.unit_price, 'Quoted unit price', true)
    const quantity = whole(item.quantity, 'Requested quantity', 1)
    return { pr_item_id: id, item_name: item.item_name, quantity, unit_price: price, subtotal: Math.round(price * 100) * quantity / 100 }
  })
  const subtotalCents = lines.reduce((sum: number, line: Row) => sum + Math.round(line.subtotal * 100), 0)
  const rate = amount(input.tax_rate ?? 18, 'Tax rate')
  ensure(rate <= 100, 'Tax rate cannot exceed 100%.')
  const taxCents = Math.round(subtotalCents * rate / 100)
  const discountCents = Math.round(amount(input.discount_amount ?? 0, 'Discount') * 100)
  ensure(discountCents < subtotalCents + taxCents, 'Discount must be less than the quotation total.')
  const totals = { subtotal: subtotalCents / 100, tax_amount: taxCents / 100, discount_amount: discountCents / 100, final_amount: (subtotalCents + taxCents - discountCents) / 100 }
  for (const key of ['subtotal', 'tax_amount', 'final_amount'] as const) {
    if (input[key] !== undefined) ensure(Math.round(amount(input[key], key) * 100) === Math.round(totals[key] * 100), 'Submitted totals do not match the requested line items and tax rate.')
  }
  return { ...totals, unit_price: lines[0].unit_price, line_items: lines }
}

/** Count previously accepted items; rejected units remain outstanding for replacement. */
export function receiptProgress(items: Row[], receipts: Row[]): Row[] {
  return items.map(item => {
    const accepted = receipts.reduce((sum, receipt) => {
      if (Array.isArray(receipt.items)) return sum + receipt.items.filter((line: Row) => line.pr_item_id === item.id).reduce((n: number, line: Row) => n + Number(line.accepted_qty), 0)
      return sum + (items.length === 1 ? Number(receipt.accepted_qty) : 0)
    }, 0)
    return { ...item, accepted_qty: accepted, remaining_qty: Math.max(0, Number(item.quantity) - accepted) }
  })
}

export function validateReceipt(items: Row[], prior: Row[], input: Row): Row {
  const progress = receiptProgress(items, prior)
  ensure(items.length > 0, 'The purchase order has no requested items.', 409)
  let supplied = input.items
  if (!supplied && items.length === 1) supplied = [{ pr_item_id: items[0].id, received_qty: input.received_qty, accepted_qty: input.accepted_qty, rejected_qty: input.rejected_qty ?? 0, rejection_reason: input.rejection_reason }]
  ensure(Array.isArray(supplied) && supplied.length > 0, 'Record receipt quantities for each delivered line item.')
  const seen = new Set<number>()
  const lines = supplied.map((entry: Row) => {
    const id = entityId(entry.pr_item_id)
    const item = progress.find(row => row.id === id)
    ensure(item && !seen.has(id), 'Receipt items must belong to this order without duplicates.')
    seen.add(id)
    const received = whole(entry.received_qty, 'Received quantity')
    const accepted = whole(entry.accepted_qty, 'Accepted quantity')
    const rejected = whole(entry.rejected_qty ?? 0, 'Rejected quantity')
    ensure(received === accepted + rejected, 'Accepted plus rejected quantity must equal received quantity.')
    ensure(received <= item.remaining_qty, 'Received quantity exceeds the outstanding quantity for an item.', 409)
    const reason = rejected > 0 ? text(entry.rejection_reason ?? input.rejection_reason, 'Rejection reason') : null
    return { pr_item_id: id, item_name: item.item_name, received_qty: received, accepted_qty: accepted, rejected_qty: rejected, rejection_reason: reason }
  })
  const received = lines.reduce((sum: number, line: Row) => sum + line.received_qty, 0)
  ensure(received > 0, 'At least one item must be received.')
  const ordered = items.reduce((sum, item) => sum + Number(item.quantity), 0)
  if (input.ordered_qty !== undefined) ensure(Number(input.ordered_qty) === ordered, 'Ordered quantity must match the purchase order.')
  const accepted = lines.reduce((sum: number, line: Row) => sum + line.accepted_qty, 0)
  const rejected = lines.reduce((sum: number, line: Row) => sum + line.rejected_qty, 0)
  return { items: lines, ordered_qty: ordered, received_qty: received, accepted_qty: accepted, rejected_qty: rejected, rejection_reason: lines.filter((line: Row) => line.rejection_reason).map((line: Row) => `${line.item_name}: ${line.rejection_reason}`).join('; ') || null }
}
