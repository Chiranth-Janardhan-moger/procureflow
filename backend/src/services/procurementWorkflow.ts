import { randomUUID } from 'node:crypto'
import { calculateEstimatedTotal } from './purchaseCalculations.js'
import { atomicWorkflow, type Row, type WorkflowStore } from './workflowStore.js'
import { amount, date, ensure, entityId, managerOf, quoteTotals, receiptProgress, requestVisibleTo, role, text, today, validateReceipt, whole } from './workflowRules.js'

interface Hooks {
  logAction(user: any, action: string, type: string, id: string, details: string): Promise<void>
  createNotification(userId: number | null, role: string, title: string, message: string, link?: string): Promise<void>
}
const stamp = () => new Date().toISOString()
const reference = (prefix: string) => `${prefix}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`
async function required(store: WorkflowStore, table: Parameters<WorkflowStore['find']>[0], id: unknown, lock = false): Promise<Row> {
  const row = await store.find(table, entityId(id), lock)
  ensure(row, 'Requested record not found.', 404)
  return row
}
async function vendorFor(store: WorkflowStore, user: Row): Promise<Row> {
  role(user, ['vendor'])
  const vendor = (await store.list('vendors', { user_id: user.id }))[0]
  ensure(vendor && vendor.status === 'active', 'An active vendor account is required.', 403)
  return vendor
}
async function openTender(store: WorkflowStore, id: unknown): Promise<Row> {
  const rfq = await required(store, 'rfqs', id, true)
  ensure(['open', 'evaluation'].includes(rfq.status), 'This RFQ is closed for bidding or selection.', 409)
  return rfq
}

export async function createRequest(data: Row, user: Row, hooks: Hooks): Promise<Row> {
  role(user, ['employee', 'manager', 'admin'])
  const initial = data.status ?? 'pending'
  ensure(['draft', 'pending'].includes(initial), 'New requests can only be draft or pending; manager approval cannot be supplied by the client.')
  ensure(user.department_id, 'A department is required before creating a purchase request.')
  ensure(['low', 'medium', 'high', 'urgent'].includes(data.priority || 'medium'), 'Invalid request priority.')
  const purpose = text(data.purpose, 'Purpose')
  const requiredDate = date(data.required_date, 'Required date')
  ensure(Array.isArray(data.items) && data.items.length > 0, 'At least one requested item is required.')
  const items = data.items.map((item: Row) => ({
    item_name: text(item.item_name, 'Item name'), category: item.category || 'General',
    quantity: whole(item.quantity, 'Quantity', 1), estimated_unit_price: amount(item.estimated_unit_price, 'Estimated unit price'), specification: item.specification || '',
  }))
  const request = await atomicWorkflow(async store => {
    const now = stamp()
    const created = await store.insert('purchase_requests', {
      pr_number: reference('PR'), user_id: user.id, department_id: user.department_id, required_date: requiredDate,
      priority: data.priority || 'medium', purpose, status: initial, manager_remarks: null,
      total_estimated_cost: Math.round(calculateEstimatedTotal(items) * 100) / 100,
      created_at: now, updated_at: now,
    })
    const saved = []
    for (const item of items) saved.push(await store.insert('pr_items', { ...item, pr_id: created.id, estimated_total: Math.round(item.estimated_unit_price * 100) * item.quantity / 100 }))
    return { ...created, items: saved } as Row
  })
  await hooks.logAction(user, 'CREATE_PURCHASE_REQUEST', 'PURCHASE_REQUEST', request.pr_number, `Created ${request.pr_number} with ${items.length} requested line items`)
  return request
}

export async function decideRequest(id: number, status: string, remarks: string | undefined, user: Row, hooks: Hooks): Promise<Row> {
  const request = await atomicWorkflow(async store => {
    const current = await required(store, 'purchase_requests', id, true)
    if (status === 'pending') {
      ensure(current.user_id === user.id && current.status === 'draft', 'Only the owner can submit a draft request.', 403)
    } else {
      managerOf(user, current)
      ensure(['approved', 'rejected'].includes(status), 'Delivery and completion statuses are controlled by the workflow.')
      ensure(current.status === 'pending', 'Only a pending request can be approved or rejected.', 409)
      if (status === 'rejected') text(remarks, 'Rejection reason')
    }
    return store.update('purchase_requests', current.id, { status, manager_remarks: remarks?.trim() || current.manager_remarks, updated_at: stamp() })
  })
  await hooks.logAction(user, `${status.toUpperCase()}_PURCHASE_REQUEST`, 'PURCHASE_REQUEST', request.pr_number, `Status: ${status}. ${remarks || ''}`)
  await hooks.createNotification(request.user_id, 'employee', `Request ${request.pr_number} ${status}`, remarks || `Your request is now ${status}.`, '/purchase-requests')
  if (status === 'approved') await hooks.createNotification(null, 'procurement_officer', `${request.pr_number} approved`, 'Ready to publish an RFQ.', '/procurement/approved-requests')
  return request
}

export async function publishRfq(data: Row, user: Row, hooks: Hooks): Promise<Row> {
  role(user, ['procurement_officer', 'admin'])
  const title = text(data.title, 'RFQ title')
  const deadline = date(data.deadline, 'Bidding deadline')
  ensure(deadline >= today(), 'Bidding deadline cannot be in the past.')
  ensure(Array.isArray(data.vendor_ids) && data.vendor_ids.length > 0, 'Invite at least one vendor.')
  const vendorIds = [...new Set<number>(data.vendor_ids.map(entityId))]
  const rfq = await atomicWorkflow(async store => {
    const request = await required(store, 'purchase_requests', data.pr_id, true)
    ensure((await store.list('rfqs', { pr_id: request.id })).length === 0, 'An RFQ already exists for this purchase request.', 409)
    ensure(request.status === 'approved', 'Only approved requests awaiting procurement can start an RFQ.', 409)
    for (const id of vendorIds) ensure((await required(store, 'vendors', id)).status === 'active', 'Only active vendors may be invited.')
    const created = await store.insert('rfqs', {
      rfq_number: reference('RFQ'), pr_id: request.id, title, deadline,
      expected_delivery_date: data.expected_delivery_date ? date(data.expected_delivery_date, 'Expected delivery') : null,
      terms: data.terms || '', status: 'open', created_by: user.id, created_at: stamp(),
    })
    for (const id of vendorIds) await store.insert('rfq_vendors', { rfq_id: created.id, vendor_id: id, invited_at: stamp() })
    await store.update('purchase_requests', request.id, { status: 'in_procurement', updated_at: stamp() })
    return created
  })
  await hooks.logAction(user, 'CREATE_RFQ', 'RFQ', rfq.rfq_number, `Invited ${vendorIds.length} vendors`)
  for (const id of vendorIds) {
    const target = await atomicWorkflow(store => required(store, 'vendors', id))
    if (target.user_id) await hooks.createNotification(target.user_id, 'vendor', `Invitation: ${rfq.rfq_number}`, title, '/vendor/rfqs')
  }
  return rfq
}

export async function submitQuote(data: Row, user: Row, hooks: Hooks): Promise<Row> {
  const quote = await atomicWorkflow(async store => {
    const rfq = await openTender(store, data.rfq_id)
    const vendor = await vendorFor(store, user)
    ensure((await store.list('rfq_vendors', { rfq_id: rfq.id, vendor_id: vendor.id })).length > 0, 'Your vendor account is not invited to this RFQ.', 403)
    ensure(date(rfq.deadline, 'Bidding deadline') >= today(), 'The quotation deadline has passed.', 409)
    ensure((await store.list('quotations', { rfq_id: rfq.id, vendor_id: vendor.id })).length === 0, 'Your vendor account has already submitted a quotation for this RFQ.', 409)
    const totals = quoteTotals(await store.list('pr_items', { pr_id: rfq.pr_id }), data)
    const created = await store.insert('quotations', {
      quote_number: reference('QT'), rfq_id: rfq.id, vendor_id: vendor.id, ...totals,
      delivery_days: whole(data.delivery_days, 'Delivery lead time', 1), warranty_years: amount(data.warranty_years ?? 1, 'Warranty'),
      payment_terms: data.payment_terms || 'Net 30 Days', validity_date: data.validity_date ? date(data.validity_date, 'Quotation validity') : null,
      notes: data.notes || '', status: 'submitted', is_recommended: false, recommendation_reason: null, submitted_at: stamp(),
    })
    await store.update('rfqs', rfq.id, { status: 'evaluation' })
    return created
  })
  await hooks.logAction(user, 'SUBMIT_QUOTATION', 'QUOTATION', quote.quote_number, `Submitted ${quote.line_items.length} line prices; total ${quote.final_amount}`)
  await hooks.createNotification(null, 'procurement_officer', 'Vendor quotation received', quote.quote_number, '/rfqs')
  return quote
}

export async function recommendQuote(id: number, reason: string, user: Row, hooks: Hooks): Promise<boolean> {
  role(user, ['procurement_officer', 'admin'])
  text(reason, 'Recommendation reason')
  const result = await atomicWorkflow(async store => {
    const selected = await required(store, 'quotations', id)
    const rfq = await openTender(store, selected.rfq_id)
    ensure((await store.list('purchase_orders', { rfq_id: rfq.id })).length === 0, 'A PO has already been issued for this RFQ.', 409)
    for (const quote of await store.list('quotations', { rfq_id: rfq.id })) {
      await store.update('quotations', quote.id, { is_recommended: quote.id === id, recommendation_reason: quote.id === id ? reason.trim() : null, status: quote.id === id ? 'recommended' : 'submitted' })
    }
    return { quote: selected, rfq }
  })
  await hooks.logAction(user, 'RECOMMEND_VENDOR', 'QUOTATION', result.quote.quote_number, reason)
  await hooks.createNotification(null, 'manager', 'Vendor recommendation awaiting approval', reason, '/manager/vendor-approvals')
  return true
}

export async function sendBackRecommendation(id: number, reason: string, user: Row, hooks: Hooks): Promise<Row> {
  const comment = text(reason, 'Reason for sending back')
  const rfq = await atomicWorkflow(async store => {
    const current = await openTender(store, id)
    managerOf(user, await required(store, 'purchase_requests', current.pr_id))
    ensure((await store.list('purchase_orders', { rfq_id: current.id })).length === 0, 'This RFQ already has a purchase order.', 409)
    const quotes = await store.list('quotations', { rfq_id: current.id })
    ensure(quotes.some(q => q.is_recommended), 'There is no recommendation awaiting approval.', 409)
    for (const quote of quotes) if (quote.is_recommended) await store.update('quotations', quote.id, { is_recommended: false, status: 'submitted', recommendation_reason: null })
    return current
  })
  await hooks.logAction(user, 'RETURN_VENDOR_RECOMMENDATION', 'RFQ', rfq.rfq_number, comment)
  await hooks.createNotification(null, 'procurement_officer', `${rfq.rfq_number}: recommendation returned`, comment, '/rfqs')
  return rfq
}

export async function approvePo(data: Row, user: Row, hooks: Hooks): Promise<Row> {
  role(user, ['manager'])
  const delivery = date(data.expected_delivery, 'Expected delivery')
  const result = await atomicWorkflow(async store => {
    const candidate = await required(store, 'quotations', data.quote_id)
    const rfq = await required(store, 'rfqs', candidate.rfq_id, true)
    const request = await required(store, 'purchase_requests', rfq.pr_id)
    managerOf(user, request)
    ensure((await store.list('purchase_orders', { rfq_id: rfq.id })).length === 0, 'A purchase order already exists for this RFQ.', 409)
    // Re-read after obtaining the RFQ lock so a returned recommendation cannot be approved from stale data.
    const quote = await required(store, 'quotations', data.quote_id)
    const quotes = await store.list('quotations', { rfq_id: rfq.id })
    const recommended = quotes.find(row => row.is_recommended && row.status === 'recommended')
    ensure(recommended, 'Procurement must submit a recommendation before manager vendor selection.', 409)
    ensure(['submitted', 'recommended'].includes(quote.status), 'This quotation is not eligible for selection.', 409)
    const alternative = quote.id !== recommended.id
    ensure(data.selection_reason == null || typeof data.selection_reason === 'string', 'Vendor selection reason must be text.')
    const explanation = typeof data.selection_reason === 'string' ? data.selection_reason.trim() : ''
    ensure(explanation.length <= 2000, 'Vendor selection reason cannot exceed 2000 characters.')
    const selectionReason = alternative ? text(explanation, 'Reason for choosing an alternative vendor') : (explanation || 'Approved Procurement recommendation.')
    const selectedVendor = await required(store, 'vendors', quote.vendor_id)
    ensure(selectedVendor.status === 'active', 'The selected vendor is not active.', 409)
    ensure(['open', 'evaluation'].includes(rfq.status) && request.status === 'in_procurement', 'This RFQ is not awaiting vendor approval.', 409)
    const po = await store.insert('purchase_orders', {
      po_number: reference('PO'), rfq_id: rfq.id, quote_id: quote.id, vendor_id: quote.vendor_id, pr_id: request.id,
      total_amount: Number(quote.final_amount), expected_delivery: delivery, delivery_address: data.delivery_address || 'ProcureFlow, Bengaluru',
      payment_terms: data.payment_terms || quote.payment_terms, status: 'issued', dispatch_date: null, courier_name: null, tracking_ref: null, created_at: stamp(),
    })
    await store.update('rfqs', rfq.id, { status: 'closed' })
    for (const bid of quotes) await store.update('quotations', bid.id, { status: bid.id === quote.id ? 'selected' : 'rejected' })
    return { po, rfq, quote, vendor: selectedVendor, recommended, alternative, selectionReason }
  })
  await hooks.logAction(user, 'APPROVE_VENDOR_SELECTION', 'RFQ', result.rfq.rfq_number, `Manager selected ${result.quote.quote_number} (${result.vendor.name}); original Procurement recommendation ${result.recommended.quote_number}; issued ${result.po.po_number}. Reason: ${result.selectionReason}`)
  if (result.alternative) await hooks.logAction(user, 'OVERRIDE_VENDOR_RECOMMENDATION', 'RFQ', result.rfq.rfq_number, `Selected ${result.quote.quote_number} instead of ${result.recommended.quote_number}. Reason: ${result.selectionReason}`)
  await hooks.logAction(user, 'GENERATE_PURCHASE_ORDER', 'PURCHASE_ORDER', result.po.po_number, 'Manager-approved order issued')
  await hooks.createNotification(result.vendor.user_id, 'vendor', 'Purchase order issued', result.po.po_number, '/vendor/orders')
  return result.po
}

export async function updatePo(id: number, data: Row, user: Row, hooks: Hooks): Promise<Row> {
  const po = await atomicWorkflow(async store => {
    const current = await required(store, 'purchase_orders', id, true)
    const vendor = await vendorFor(store, user)
    ensure(current.vendor_id === vendor.id, 'This order belongs to another vendor.', 403)
    const transitions: Record<string, string[]> = { issued: ['accepted'], accepted: ['processing', 'dispatched'], processing: ['dispatched'], dispatched: ['dispatched'] }
    ensure((transitions[current.status] || []).includes(data.status), 'Invalid order transition. Delivery is recorded by Procurement through goods receipt; completion follows payment.', 409)
    const changes: Row = { status: data.status }
    if (data.status === 'dispatched') {
      changes.dispatch_date = date(data.dispatch_date, 'Dispatch date')
      changes.courier_name = text(data.courier_name, 'Carrier name')
      changes.tracking_ref = text(data.tracking_ref, 'Tracking reference')
    }
    return store.update('purchase_orders', id, changes)
  })
  await hooks.logAction(user, 'UPDATE_PO_STATUS', 'PURCHASE_ORDER', po.po_number, `Vendor updated order to ${po.status}`)
  await hooks.createNotification(null, 'procurement_officer', `${po.po_number}: ${po.status}`, po.tracking_ref || '', '/purchase-orders')
  return po
}

export async function recordReceipt(data: Row, user: Row, hooks: Hooks): Promise<Row> {
  role(user, ['procurement_officer', 'admin'])
  const receivedDate = date(data.received_date, 'Receipt date')
  const result = await atomicWorkflow(async store => {
    const po = await required(store, 'purchase_orders', data.po_id, true)
    ensure(po.status === 'dispatched', 'Goods can only be received against a dispatched order with outstanding items.', 409)
    ensure(!po.dispatch_date || receivedDate >= date(po.dispatch_date, 'Dispatch date'), 'Receipt date cannot precede dispatch.')
    const items = await store.list('pr_items', { pr_id: po.pr_id })
    const prior = await store.list('goods_receipts', { po_id: po.id })
    const quantities = validateReceipt(items, prior, data)
    const receipt = await store.insert('goods_receipts', { grn_number: reference('GRN'), po_id: po.id, received_date: receivedDate, ...quantities, received_by: user.id, created_at: stamp() })
    const fullyAccepted = receiptProgress(items, [...prior, receipt]).every(item => item.remaining_qty === 0)
    let request: Row | undefined
    if (fullyAccepted) {
      await store.update('purchase_orders', po.id, { status: 'delivered' })
      request = await store.update('purchase_requests', po.pr_id, { status: 'completed', updated_at: stamp() })
    }
    return { receipt, request, po, fullyAccepted }
  })
  await hooks.logAction(user, 'RECORD_GOODS_RECEIPT', 'GOODS_RECEIPT', result.receipt.grn_number, `${result.receipt.accepted_qty} accepted, ${result.receipt.rejected_qty} rejected. ${result.fullyAccepted ? 'All requested items accepted; request completed.' : 'Outstanding items remain.'}`)
  if (result.request) await hooks.createNotification(result.request.user_id, 'employee', `${result.request.pr_number} completed`, 'All requested items have been received and accepted.', '/purchase-requests')
  return result.receipt
}

export async function invoicePo(data: Row, user: Row, hooks: Hooks): Promise<Row> {
  const invoiceDate = date(data.invoice_date, 'Invoice date')
  const due = date(data.due_date, 'Invoice due date')
  ensure(due >= invoiceDate, 'Invoice due date must not precede invoice date.')
  const value = amount(data.amount, 'Invoice amount', true)
  const invoice = await atomicWorkflow(async store => {
    const po = await required(store, 'purchase_orders', data.po_id, true)
    const vendor = await vendorFor(store, user)
    ensure(po.vendor_id === vendor.id, 'You cannot invoice another vendor order.', 403)
    ensure(po.status === 'delivered', 'Invoice submission requires complete, accepted delivery.', 409)
    ensure((await store.list('invoices', { po_id: po.id })).length === 0, 'An invoice already exists for this order.', 409)
    ensure(Math.round(value * 100) === Math.round(Number(po.total_amount) * 100), 'Invoice amount must match the approved order total.')
    const number = data.invoice_number ? text(data.invoice_number, 'Invoice number') : reference('INV')
    ensure((await store.list('invoices', { invoice_number: number })).length === 0, 'Invoice number is already in use.', 409)
    return store.insert('invoices', { invoice_number: number, po_id: po.id, vendor_id: vendor.id, invoice_date: invoiceDate, due_date: due, amount: value, status: 'submitted', notes: data.notes || null, created_at: stamp() })
  })
  await hooks.logAction(user, 'SUBMIT_INVOICE', 'INVOICE', invoice.invoice_number, `Invoice amount ${value}`)
  await hooks.createNotification(null, 'procurement_officer', 'Invoice submitted', invoice.invoice_number, '/invoices')
  return invoice
}

export async function payInvoice(data: Row, user: Row, hooks: Hooks): Promise<Row> {
  role(user, ['procurement_officer', 'admin'])
  const value = amount(data.amount, 'Payment amount', true)
  const paymentDate = date(data.payment_date, 'Payment date')
  const payment = await atomicWorkflow(async store => {
    const candidate = await required(store, 'invoices', data.invoice_id)
    const po = await required(store, 'purchase_orders', candidate.po_id, true)
    const invoice = await required(store, 'invoices', candidate.id, true)
    ensure(invoice.status !== 'paid' && (await store.list('payments', { invoice_id: invoice.id })).length === 0, 'This invoice has already been paid.', 409)
    ensure(po.status === 'delivered', 'Payment requires a fully delivered and accepted order.', 409)
    ensure(['submitted', 'verified', 'pending_payment'].includes(invoice.status), 'This invoice is not payable.', 409)
    ensure(Math.round(value * 100) === Math.round(Number(invoice.amount) * 100), 'Record the full invoice amount; partial and excess settlements are not supported.')
    ensure(Math.round(Number(invoice.amount) * 100) === Math.round(Number(po.total_amount) * 100), 'Invoice and approved order totals differ.', 409)
    const receipts = await store.list('goods_receipts', { po_id: po.id })
    const progress = receiptProgress(await store.list('pr_items', { pr_id: po.pr_id }), receipts)
    ensure(progress.length > 0 && progress.every(item => item.remaining_qty === 0), 'Accepted quantities do not fulfill this order.', 409)
    ensure(receipts.every(receipt => paymentDate >= date(receipt.received_date, 'Receipt date')), 'Payment date cannot precede accepted delivery.')
    ensure(paymentDate >= date(invoice.invoice_date, 'Invoice date'), 'Payment date cannot precede invoice date.')
    const ref = data.payment_ref ? text(data.payment_ref, 'Payment reference') : reference('PAY')
    ensure((await store.list('payments', { payment_ref: ref })).length === 0, 'Payment reference is already in use.', 409)
    const saved = await store.insert('payments', { payment_ref: ref, invoice_id: invoice.id, amount: value, payment_date: paymentDate, status: 'paid', notes: data.notes || null, created_at: stamp() })
    await store.update('invoices', invoice.id, { status: 'paid' })
    await store.update('purchase_orders', po.id, { status: 'completed' })
    return saved
  })
  await hooks.logAction(user, 'RECORD_PAYMENT', 'PAYMENT', payment.payment_ref, `Full invoice settlement: ${value}`)
  return payment
}

export async function checkRequestRead(request: Row, user: Row): Promise<void> { requestVisibleTo(user, request) }
export async function checkPoRead(po: Row, user: Row): Promise<void> {
  if (['admin', 'procurement_officer'].includes(user.role)) return
  await atomicWorkflow(async store => {
    if (user.role === 'vendor') ensure((await vendorFor(store, user)).id === po.vendor_id, 'This order belongs to another vendor.', 403)
    else requestVisibleTo(user, await required(store, 'purchase_requests', po.pr_id))
  })
}
