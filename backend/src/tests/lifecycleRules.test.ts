import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { app, ensureDatabase } from '../app.js'
import { Repository } from '../services/repository.js'
import { memoryStore } from '../db/index.js'
import { quoteTotals, receiptProgress, validateReceipt } from '../services/workflowRules.js'
import { atomicWorkflow } from '../services/workflowStore.js'
import { signToken } from '../middleware/auth.js'

describe('Unit: authoritative quotation and receipt calculations', () => {
  const items = [{ id: 1, item_name: 'Keyboard', quantity: 2, estimated_unit_price: 500 }, { id: 2, item_name: 'Mouse', quantity: 1, estimated_unit_price: 200 }]
  test('prices every requested item and calculates tax and discount in cents', () => {
    const result = quoteTotals(items, { line_items: [{ pr_item_id: 1, unit_price: 450.25 }, { pr_item_id: 2, unit_price: 199.5 }], tax_rate: 18, discount_amount: 10 })
    assert.equal(result.subtotal, 1100)
    assert.equal(result.tax_amount, 198)
    assert.equal(result.final_amount, 1288)
    assert.equal(result.line_items.length, 2)
  })
  test('does not use browser-supplied totals or quantities as the source of truth', () => {
    assert.throws(() => quoteTotals(items, { line_items: [{ pr_item_id: 1, unit_price: 500, quantity: 1 }, { pr_item_id: 2, unit_price: 200 }], subtotal: 700 }), /totals/)
  })
  test('rejects missing, duplicate, foreign, or non-positive item prices', () => {
    for (const lines of [[], [{ pr_item_id: 1, unit_price: 1 }], [{ pr_item_id: 1, unit_price: 1 }, { pr_item_id: 1, unit_price: 1 }], [{ pr_item_id: 1, unit_price: -1 }, { pr_item_id: 2, unit_price: 1 }], [{ pr_item_id: 1, unit_price: 1 }, { pr_item_id: 99, unit_price: 1 }]]) {
      assert.throws(() => quoteTotals(items, { line_items: lines }))
    }
  })
  test('zero tax and zero warranty inputs do not become default values', () => {
    const result = quoteTotals([items[0]], { unit_price: 0.1, tax_rate: 0 })
    assert.equal(result.final_amount, 0.2)
    assert.equal(result.tax_amount, 0)
  })
  test('rejected units stay outstanding and replacement acceptance fulfills only its item', () => {
    const first = validateReceipt(items, [], { items: [{ pr_item_id: 1, received_qty: 2, accepted_qty: 1, rejected_qty: 1, rejection_reason: 'Damaged' }, { pr_item_id: 2, received_qty: 1, accepted_qty: 1, rejected_qty: 0 }] })
    const progress = receiptProgress(items, [first])
    assert.deepEqual(progress.map(item => item.remaining_qty), [1, 0])
    const replacement = validateReceipt(items, [first], { items: [{ pr_item_id: 1, received_qty: 1, accepted_qty: 1, rejected_qty: 0 }] })
    assert.ok(receiptProgress(items, [first, replacement]).every(item => item.remaining_qty === 0))
  })
  test('prevents receipts from substituting a different line item or exceeding outstanding units', () => {
    assert.throws(() => validateReceipt(items, [], { items: [{ pr_item_id: 99, received_qty: 1, accepted_qty: 1 }] }))
    assert.throws(() => validateReceipt(items, [], { items: [{ pr_item_id: 1, received_qty: 3, accepted_qty: 3 }] }), /exceeds/)
    assert.throws(() => validateReceipt(items, [], { items: [{ pr_item_id: 1, received_qty: 1, accepted_qty: 0, rejected_qty: 1 }] }), /reason/)
  })
})

describe('API: lifecycle roles, delivery, invoicing and settlement', () => {
  let server: Server
  let base: string
  let employee: any, manager: any, procurement: any, vendor: any, vendor2: any, vendor3: any, admin: any, otherEmployee: any, otherManager: any
  const receiptDate = '2026-11-16'
  before(async () => {
    await ensureDatabase()
    employee = await Repository.getUserByEmail('rahul@company.com')
    manager = await Repository.getUserByEmail('anita@company.com')
    procurement = await Repository.getUserByEmail('kiran@company.com')
    vendor = await Repository.getUserByEmail('sales@techworld.com')
    vendor2 = await Repository.getUserByEmail('contact@digitalsys.com')
    vendor3 = await Repository.getUserByEmail('bids@compzone.com')
    admin = await Repository.getUserByEmail('admin@company.com')
    otherEmployee = await Repository.createUser({ employee_id: randomUUID(), name: 'Other Employee', email: `${randomUUID()}@example.com`, password: randomUUID(), role: 'employee', department_id: 1 }, admin)
    otherManager = await Repository.createUser({ employee_id: randomUUID(), name: 'Other Manager', email: `${randomUUID()}@example.com`, password: randomUUID(), role: 'manager', department_id: 2 }, admin)
    await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', () => resolve()) })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  })
  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  })
  function call(path: string, method = 'GET', body?: unknown, actor = procurement) {
    return fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${signToken(actor)}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  }
  const requestPayload = (extra = {}) => ({ required_date: '2026-12-01', purpose: 'Lifecycle regression', items: [{ item_name: 'Keyboard', quantity: 2, estimated_unit_price: 500 }], ...extra })
  async function draft(multi = false) {
    const result = await call('/purchase-requests', 'POST', requestPayload(multi ? { items: [{ item_name: 'Keyboard', quantity: 2, estimated_unit_price: 500 }, { item_name: 'Mouse', quantity: 1, estimated_unit_price: 200 }] } : {}), employee)
    assert.equal(result.status, 201)
    return (await result.json() as any).request
  }
  async function setup(options: { multi?: boolean; dispatch?: boolean; deliver?: boolean; recommend?: boolean } = {}) {
    const request = await draft(options.multi)
    assert.equal((await call(`/purchase-requests/${request.id}/status`, 'PATCH', { status: 'approved' }, manager)).status, 200)
    const rfq = await Repository.createRfq({ pr_id: request.id, title: 'Keyboard and peripherals', deadline: '2026-11-20', vendor_ids: [1, 2] }, procurement)
    const quote = await Repository.submitQuotation({ rfq_id: rfq.id, line_items: request.items.map((item: any) => ({ pr_item_id: item.id, unit_price: item.estimated_unit_price })), delivery_days: 7 }, vendor)
    if (options.recommend === false) return { request, rfq, quote, po: null }
    await Repository.recommendQuotation(quote.id, 'Meets the requested specification.', procurement)
    const po = await Repository.createPurchaseOrderFromQuotation({ quote_id: quote.id, expected_delivery: '2026-12-01' }, manager)
    if (options.dispatch || options.deliver) {
      await Repository.updatePurchaseOrderStatus(po.id, { status: 'accepted' }, vendor)
      await Repository.updatePurchaseOrderStatus(po.id, { status: 'dispatched', dispatch_date: '2026-11-15', courier_name: 'Test Carrier', tracking_ref: randomUUID() }, vendor)
    }
    if (options.deliver) await Repository.createGoodsReceipt({ po_id: po.id, received_date: receiptDate, items: request.items.map((item: any) => ({ pr_item_id: item.id, received_qty: item.quantity, accepted_qty: item.quantity, rejected_qty: 0 })) }, procurement)
    return { request, rfq, quote, po }
  }
  function invoiceBody(po: any) { return { po_id: po.id, invoice_number: `INV-${randomUUID()}`, invoice_date: receiptDate, due_date: '2026-12-16', amount: po.total_amount } }
  async function invoiced() {
    const fixture = await setup({ deliver: true })
    const invoice = await Repository.submitInvoice(invoiceBody(fixture.po), vendor)
    return { ...fixture, invoice }
  }
  const payBody = (invoice: any, extra = {}) => ({ amount: invoice.amount, payment_date: '2026-11-17', payment_ref: randomUUID(), ...extra })

  test('employee cannot self-approve a request on creation', async () => {
    const before = memoryStore.purchase_requests.length
    assert.equal((await call('/purchase-requests', 'POST', requestPayload({ status: 'approved' }), employee)).status, 400)
    assert.equal(memoryStore.purchase_requests.length, before)
  })
  test('request items reject negative, fractional, missing, or invalid numeric values', async () => {
    for (const item of [{ quantity: -1, estimated_unit_price: 500 }, { quantity: 0.5, estimated_unit_price: 500 }, { quantity: 1, estimated_unit_price: -1 }, { quantity: 1, estimated_unit_price: 'oops' }]) {
      assert.equal((await call('/purchase-requests', 'POST', requestPayload({ items: [{ item_name: 'Keyboard', ...item }] }), employee)).status, 400)
    }
  })
  test('Procurement and Admin cannot approve requests through the status API', async () => {
    const request = await draft()
    for (const actor of [procurement, admin]) assert.equal((await call(`/purchase-requests/${request.id}/status`, 'PATCH', { status: 'approved' }, actor)).status, 403)
  })
  test('only the correct manager can decide a pending request, once', async () => {
    const request = await draft()
    assert.equal((await call(`/purchase-requests/${request.id}/status`, 'PATCH', { status: 'approved' }, otherManager)).status, 403)
    assert.equal((await call(`/purchase-requests/${request.id}/status`, 'PATCH', { status: 'approved' }, manager)).status, 200)
    assert.equal((await call(`/purchase-requests/${request.id}/status`, 'PATCH', { status: 'rejected', remarks: 'Changed mind' }, manager)).status, 409)
  })
  test('rejecting a request requires a reason', async () => {
    const request = await draft()
    assert.equal((await call(`/purchase-requests/${request.id}/status`, 'PATCH', { status: 'rejected' }, manager)).status, 400)
  })
  test('draft submission is restricted to its owner', async () => {
    const response = await call('/purchase-requests', 'POST', requestPayload({ status: 'draft' }), employee)
    const request = (await response.json() as any).request
    assert.equal((await call(`/purchase-requests/${request.id}/status`, 'PATCH', { status: 'pending' }, otherEmployee)).status, 403)
    assert.equal((await call(`/purchase-requests/${request.id}/status`, 'PATCH', { status: 'pending' }, employee)).status, 200)
  })
  test('request details are protected by ownership and department', async () => {
    const request = await draft()
    assert.equal((await call(`/purchase-requests/${request.id}`, 'GET', undefined, otherEmployee)).status, 403)
    assert.equal((await call(`/purchase-requests/${request.id}`, 'GET', undefined, otherManager)).status, 403)
    assert.equal((await call('/purchase-requests', 'GET', undefined, vendor)).status, 403)
  })
  test('order updates require the owning vendor and cannot skip acceptance', async () => {
    const { po } = await setup()
    assert.equal((await call(`/purchase-orders/${po!.id}/status`, 'PATCH', { status: 'accepted' }, vendor2)).status, 403)
    assert.equal((await call(`/purchase-orders/${po!.id}/status`, 'PATCH', { status: 'accepted' }, employee)).status, 403)
    assert.equal((await call(`/purchase-orders/${po!.id}/status`, 'PATCH', { status: 'dispatched', dispatch_date: '2026-11-15', courier_name: 'Test', tracking_ref: 'T' }, vendor)).status, 409)
  })
  test('vendors cannot manually mark orders delivered or completed', async () => {
    const { po } = await setup({ dispatch: true })
    for (const status of ['delivered', 'completed', 'issued']) assert.equal((await call(`/purchase-orders/${po!.id}/status`, 'PATCH', { status }, vendor)).status, 409)
  })
  test('order details and RFQ details reject unowned and uninvited access', async () => {
    const { po, rfq } = await setup()
    assert.equal((await call(`/purchase-orders/${po!.id}`, 'GET', undefined, vendor2)).status, 403)
    assert.equal((await call(`/rfqs/${rfq.id}`, 'GET', undefined, vendor3)).status, 403)
    const view = await call(`/rfqs/${rfq.id}`, 'GET', undefined, vendor2).then(response => response.json()) as any
    assert.equal(view.rfq.quotations.length, 0)
  })
  test('GRN is unavailable before dispatch', async () => {
    const { po, request } = await setup()
    assert.equal((await call('/goods-receipts', 'POST', { po_id: po!.id, received_date: receiptDate, received_qty: 2, accepted_qty: 2, rejected_qty: 0 })).status, 409)
    assert.equal((await Repository.getPurchaseRequestById(request.id))?.status, 'in_procurement')
  })
  test('partial and rejected goods remain outstanding; replacement completes the employee request before payment', async () => {
    const { po, request } = await setup({ dispatch: true, multi: true })
    const first = await call('/goods-receipts', 'POST', { po_id: po!.id, received_date: receiptDate, items: [{ pr_item_id: request.items[0].id, received_qty: 2, accepted_qty: 1, rejected_qty: 1, rejection_reason: 'Transit damage' }, { pr_item_id: request.items[1].id, received_qty: 1, accepted_qty: 1, rejected_qty: 0 }] })
    assert.equal(first.status, 201)
    assert.equal((await Repository.getPurchaseOrderById(po!.id))?.status, 'dispatched')
    assert.equal((await Repository.getPurchaseRequestById(request.id))?.status, 'in_procurement')
    assert.equal((await call('/invoices', 'POST', invoiceBody(po), vendor)).status, 409)
    const replacement = await call('/goods-receipts', 'POST', { po_id: po!.id, received_date: receiptDate, items: [{ pr_item_id: request.items[0].id, received_qty: 1, accepted_qty: 1, rejected_qty: 0 }] })
    assert.equal(replacement.status, 201)
    const delivered = await Repository.getPurchaseOrderById(po!.id)
    assert.equal(delivered?.status, 'delivered')
    assert.equal(delivered?.remaining_qty, 0)
    const employeeView = await call(`/purchase-requests/${request.id}`, 'GET', undefined, employee).then(response => response.json()) as any
    assert.equal(employeeView.request.status, 'completed')
  })
  test('GRN validates balances, integer quantities, outstanding limits and rejection reasons', async () => {
    const { po } = await setup({ dispatch: true })
    for (const values of [{ received_qty: 1, accepted_qty: 2, rejected_qty: 0 }, { received_qty: -1, accepted_qty: -1 }, { received_qty: 0.5, accepted_qty: 0.5 }, { received_qty: 1, accepted_qty: 0, rejected_qty: 1 }]) {
      assert.equal((await call('/goods-receipts', 'POST', { po_id: po!.id, received_date: receiptDate, ...values })).status, 400)
    }
    assert.equal((await call('/goods-receipts', 'POST', { po_id: po!.id, received_date: receiptDate, received_qty: 3, accepted_qty: 3 })).status, 409)
  })
  test('simultaneous full receipts cannot over-accept goods', async () => {
    const { po } = await setup({ dispatch: true })
    const body = { po_id: po!.id, received_date: receiptDate, received_qty: 2, accepted_qty: 2, rejected_qty: 0 }
    const responses = await Promise.all([call('/goods-receipts', 'POST', body), call('/goods-receipts', 'POST', body)])
    assert.deepEqual(responses.map(response => response.status).sort((a, b) => a - b), [201, 409])
  })
  test('vendors cannot invoice orders belonging to other suppliers', async () => {
    const { po } = await setup({ deliver: true })
    assert.equal((await call('/invoices', 'POST', invoiceBody(po), vendor2)).status, 403)
  })
  test('invoice amount, due date, and duplicate order invoices are checked', async () => {
    const { po } = await setup({ deliver: true })
    assert.equal((await call('/invoices', 'POST', { ...invoiceBody(po), amount: 1 }, vendor)).status, 400)
    assert.equal((await call('/invoices', 'POST', { ...invoiceBody(po), due_date: '2026-01-01' }, vendor)).status, 400)
    assert.equal((await call('/invoices', 'POST', invoiceBody(po), vendor)).status, 201)
    assert.equal((await call('/invoices', 'POST', invoiceBody(po), vendor)).status, 409)
  })
  test('simultaneous invoice submissions create only one invoice for an order', async () => {
    const { po } = await setup({ deliver: true })
    const results = await Promise.all([call('/invoices', 'POST', invoiceBody(po), vendor), call('/invoices', 'POST', invoiceBody(po), vendor)])
    assert.deepEqual(results.map(response => response.status).sort((a, b) => a - b), [201, 409])
  })
  test('partial, excess, invalid, and vendor-issued payments are rejected', async () => {
    const { invoice } = await invoiced()
    for (const amount of [1, invoice.amount + 1, -1, 'oops']) assert.equal((await call(`/invoices/${invoice.id}/pay`, 'POST', payBody(invoice, { amount }))).status, 400)
    assert.equal((await call(`/invoices/${invoice.id}/pay`, 'POST', payBody(invoice), vendor)).status, 403)
  })
  test('full payment completes the PO and duplicate payment is rejected', async () => {
    const { po, request, invoice } = await invoiced()
    assert.equal((await call(`/invoices/${invoice.id}/pay`, 'POST', payBody(invoice))).status, 201)
    assert.equal((await Repository.getPurchaseOrderById(po!.id))?.status, 'completed')
    assert.equal((await Repository.getPurchaseRequestById(request.id))?.status, 'completed')
    assert.equal((await call(`/invoices/${invoice.id}/pay`, 'POST', payBody(invoice))).status, 409)
  })
  test('order details expose paid invoice settlement data and cannot invite another settlement', async () => {
    const { po, invoice } = await invoiced()
    const result = await call(`/invoices/${invoice.id}/pay`, 'POST', payBody(invoice))
    assert.equal(result.status, 201)
    const details = await call(`/purchase-orders/${po!.id}`).then(response => response.json()) as any
    assert.equal(details.order.invoice_submitted, true)
    assert.equal(details.order.invoices[0].status, 'paid')
    assert.equal(details.order.invoices[0].payment.status, 'paid')
  })
  test('payment date cannot precede accepted delivery', async () => {
    const { invoice } = await invoiced()
    assert.equal((await call(`/invoices/${invoice.id}/pay`, 'POST', payBody(invoice, { payment_date: '2026-11-15' }))).status, 400)
  })

  test('simultaneous settlements cannot pay the same invoice twice', async () => {
    const { invoice } = await invoiced()
    const results = await Promise.all([call(`/invoices/${invoice.id}/pay`, 'POST', payBody(invoice)), call(`/invoices/${invoice.id}/pay`, 'POST', payBody(invoice))])
    assert.deepEqual(results.map(response => response.status).sort((a, b) => a - b), [201, 409])
  })
  test('payment refuses a legacy invoice when the order is not fully delivered', async () => {
    const { po, invoice } = await invoiced()
    // Deliberately corrupt fixture state to exercise the independent settlement guard.
    memoryStore.purchase_orders.find(row => row.id === po!.id)!.status = 'dispatched'
    assert.equal((await call(`/invoices/${invoice.id}/pay`, 'POST', payBody(invoice))).status, 409)
  })
  test('manager can send a recommendation back with a reason; a fresh recommendation is required', async () => {
    const { rfq, quote } = await setup({ recommend: false })
    await Repository.recommendQuotation(quote.id, 'Initial recommendation', procurement)
    assert.equal((await call(`/rfqs/${rfq.id}/return-recommendation`, 'POST', { reason: '' }, manager)).status, 400)
    assert.equal((await call(`/rfqs/${rfq.id}/return-recommendation`, 'POST', { reason: 'Please compare the delivery SLA.' }, otherManager)).status, 403)
    assert.equal((await call(`/rfqs/${rfq.id}/return-recommendation`, 'POST', { reason: 'Please compare the delivery SLA.' }, manager)).status, 200)
    const details = await Repository.getRfqById(rfq.id)
    assert.ok(details?.quotations.every((row: any) => !row.is_recommended && row.status === 'submitted'))
    assert.equal((await call('/purchase-orders', 'POST', { quote_id: quote.id, expected_delivery: '2026-12-01' }, manager)).status, 409)
    await Repository.recommendQuotation(quote.id, 'Rechecked SLA and cost.', procurement)
    assert.equal((await call('/purchase-orders', 'POST', { quote_id: quote.id, expected_delivery: '2026-12-01' }, manager)).status, 201)
  })
  test('manager can select another submitted vendor with a reason and preserve the original recommendation', async () => {
    const { request, rfq, quote } = await setup({ recommend: false })
    const alternative = await Repository.submitQuotation({ rfq_id: rfq.id, unit_price: 450, delivery_days: 5 }, vendor2)
    await Repository.recommendQuotation(quote.id, 'Original Procurement assessment.', procurement)
    const body = { quote_id: alternative.id, expected_delivery: '2026-12-01' }
    assert.equal((await call('/purchase-orders', 'POST', body, manager)).status, 400)
    assert.equal((await call('/purchase-orders', 'POST', { ...body, selection_reason: '  ' }, manager)).status, 400)
    assert.equal((await call('/purchase-orders', 'POST', { ...body, selection_reason: { reason: 'invalid type' } }, manager)).status, 400)
    assert.equal((await call('/purchase-orders', 'POST', { ...body, selection_reason: 'Faster delivery is essential.' }, procurement)).status, 403)
    const response = await call('/purchase-orders', 'POST', { ...body, selection_reason: 'Faster delivery is essential.' }, manager)
    assert.equal(response.status, 201)
    const awarded = (await response.json() as any).order
    assert.equal(awarded.vendor_id, 2)
    assert.equal(awarded.quote_id, alternative.id)
    assert.equal(Number(awarded.total_amount), 1062)
    const detail = await Repository.getRfqById(rfq.id)
    const original = detail!.quotations.find((row: any) => row.id === quote.id)!
    assert.equal(original.is_recommended, true)
    assert.equal(original.recommendation_reason, 'Original Procurement assessment.')
    assert.equal(original.status, 'rejected')
    assert.equal(detail!.quotations.find((row: any) => row.id === alternative.id)!.status, 'selected')
    const logs = await Repository.getAuditLogs()
    assert.ok(logs.some(row => row.action === 'OVERRIDE_VENDOR_RECOMMENDATION' && row.user_id === manager.id && row.details?.includes('Faster delivery is essential.') && row.details?.includes(quote.quote_number) && row.details?.includes(alternative.quote_number)))
    assert.equal((await call(`/purchase-orders/${awarded.id}`, 'GET', undefined, vendor)).status, 403)
    assert.equal((await call(`/purchase-orders/${awarded.id}`, 'GET', undefined, vendor2)).status, 200)
    assert.equal((await Repository.getPurchaseRequestById(request.id))!.status, 'in_procurement')
  })
  test('choosing an alternative still requires Procurement recommendation and the correct department manager', async () => {
    const { rfq, quote } = await setup({ recommend: false })
    const alternative = await Repository.submitQuotation({ rfq_id: rfq.id, unit_price: 450, delivery_days: 5 }, vendor2)
    const body = { quote_id: alternative.id, expected_delivery: '2026-12-01', selection_reason: 'Better delivery time.' }
    assert.equal((await call('/purchase-orders', 'POST', body, manager)).status, 409)
    await Repository.recommendQuotation(quote.id, 'Original assessment.', procurement)
    assert.equal((await call('/purchase-orders', 'POST', body, otherManager)).status, 403)
  })
  test('concurrent choices of recommended and alternative vendors still create only one PO', async () => {
    const { rfq, quote } = await setup({ recommend: false })
    const alternative = await Repository.submitQuotation({ rfq_id: rfq.id, unit_price: 450, delivery_days: 5 }, vendor2)
    await Repository.recommendQuotation(quote.id, 'Original assessment.', procurement)
    const outcomes = await Promise.all([
      call('/purchase-orders', 'POST', { quote_id: quote.id, expected_delivery: '2026-12-01' }, manager),
      call('/purchase-orders', 'POST', { quote_id: alternative.id, expected_delivery: '2026-12-01', selection_reason: 'Delivery deadline.' }, manager),
    ])
    assert.deepEqual(outcomes.map(row => row.status).sort((a, b) => a - b), [201, 409])
    assert.equal((await Repository.getPurchaseOrders()).filter(row => row.rfq_id === rfq.id).length, 1)
  })
  test('vendor order details include actual items and awarded prices before acceptance', async () => {
    const { po, request } = await setup({ multi: true })
    const response = await call(`/purchase-orders/${po!.id}`, 'GET', undefined, vendor)
    assert.equal(response.status, 200)
    const actual = (await response.json() as any).order
    assert.equal(actual.status, 'issued')
    assert.equal(actual.items.length, 2)
    assert.equal(actual.items[0].item_name, 'Keyboard')
    assert.equal(actual.items[0].quantity, 2)
    assert.equal(actual.items[0].quoted_unit_price, 500)
    assert.equal(actual.items[0].quoted_subtotal, 1000)
    assert.equal(actual.items[1].item_name, 'Mouse')
    assert.equal(actual.items[1].quoted_unit_price, 200)
    assert.equal(actual.quotation.subtotal, 1200)
    assert.equal(actual.quotation.tax_amount, 216)
    assert.equal(actual.quotation.final_amount, 1416)
    assert.equal(actual.quotation.delivery_days, 7)
    assert.ok(actual.delivery_address)
    assert.ok(actual.payment_terms)
    assert.equal(actual.pr_id, request.id)
    assert.equal((await Repository.getPurchaseOrderById(po!.id))!.status, 'issued')
    assert.equal((await call(`/purchase-orders/${po!.id}/status`, 'PATCH', { status: 'accepted' }, vendor)).status, 200)
    const accepted = await call(`/purchase-orders/${po!.id}`, 'GET', undefined, vendor).then(row => row.json()) as any
    assert.equal(accepted.order.status, 'accepted')
    assert.equal(accepted.order.items[0].quoted_subtotal, 1000)
  })

  test('closed RFQs cannot be recommended again after manager sign-off', async () => {
    const { quote } = await setup()
    assert.equal((await call(`/rfqs/quotes/${quote.id}/recommend`, 'POST', { reason: 'Try to reopen' })).status, 409)
  })
  test('targeted notifications are not broadcast to all users sharing a role', async () => {
    await Repository.createNotification(vendor2.id, 'vendor', 'Private vendor notice', 'Only vendor two should read this.')
    const own = await Repository.getNotifications(vendor2.id, 'vendor')
    const others = await Repository.getNotifications(vendor.id, 'vendor')
    const notice = own.find((row: any) => row.title === 'Private vendor notice')
    assert.ok(notice)
    assert.ok(!others.some((row: any) => row.id === notice.id))
    assert.equal((await call(`/notifications/${notice.id}/read`, 'PATCH', {}, vendor)).status, 403)
  })
  test('an exception rolls back memory changes instead of leaving half a transaction', async () => {
    const before = memoryStore.notifications.length
    await assert.rejects(atomicWorkflow(async store => {
      await store.insert('notifications', { user_id: employee.id, role: 'employee', title: 'Rollback fixture', message: '', is_read: false, created_at: new Date().toISOString() })
      throw new Error('Abort transaction')
    }), /Abort/)
    assert.equal(memoryStore.notifications.length, before)
  })
})
