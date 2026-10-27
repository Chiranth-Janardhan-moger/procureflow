import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { app, ensureDatabase } from '../app.js'
import { Repository, type LoggedUser } from '../services/repository.js'
import { WorkflowError } from '../services/workflowRules.js'
import { randomUUID } from 'node:crypto'
import { signToken } from '../middleware/auth.js'

describe('API: manager sign-off and duplicate purchase-order protection', () => {
  let server: Server
  let baseUrl: string
  let manager: LoggedUser
  let procurement: LoggedUser
  let employee: LoggedUser
  let vendor: LoggedUser
  let admin: LoggedUser

  before(async () => {
    await ensureDatabase()
    manager = await Repository.getUserByEmail('anita@company.com')
    procurement = await Repository.getUserByEmail('kiran@company.com')
    employee = await Repository.getUserByEmail('rahul@company.com')
    vendor = await Repository.getUserByEmail('sales@techworld.com')
    admin = await Repository.getUserByEmail('admin@company.com')
    await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', () => resolve()) })
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  })

  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    })
  })

  async function prepareQuote(recommend = true) {
    const request = await Repository.createPurchaseRequest({
      required_date: '2026-12-01', purpose: 'Manager PO sign-off test', status: 'pending',
      items: [{ item_name: 'Keyboard', quantity: 2, estimated_unit_price: 500 }],
    }, employee)
    await Repository.updatePurchaseRequestStatus(request.id, 'approved', undefined, await Repository.getUserByEmail('anita@company.com'))
    const rfq = await Repository.createRfq({ pr_id: request.id, title: 'Keyboard RFQ', deadline: '2026-11-20', vendor_ids: [1, 2] }, procurement)
    const quote = await Repository.submitQuotation({ rfq_id: rfq.id, unit_price: 500, delivery_days: 7 }, vendor)
    if (recommend) await Repository.recommendQuotation(quote.id, 'Matches specifications and delivery requirements.', procurement)
    return { request, rfq, quote }
  }

  function approve(quoteId: number, user = manager) {
    return fetch(`${baseUrl}/purchase-orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken(user)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ quote_id: quoteId, expected_delivery: '2026-12-01' }),
    })
  }

  test('Procurement and Admin cannot bypass manager sign-off, including direct repository calls', async () => {
    const { quote, rfq } = await prepareQuote()
    for (const user of [procurement, admin]) {
      assert.equal((await approve(quote.id, user)).status, 403)
      await assert.rejects(
        Repository.createPurchaseOrderFromQuotation({ quote_id: quote.id, expected_delivery: '2026-12-01' }, user),
        error => error instanceof WorkflowError && error.statusCode === 403
      )
    }
    assert.equal((await Repository.getPurchaseOrders()).filter(po => po.rfq_id === rfq.id).length, 0)
  })

  test('manager cannot issue a PO before Procurement submits a recommendation', async () => {
    const { quote } = await prepareQuote(false)
    assert.equal((await approve(quote.id)).status, 409)
  })

  test('manager cannot approve another department purchase request', async () => {
    const { quote } = await prepareQuote()
    const otherManager = await Repository.createUser({ employee_id: randomUUID(), name: 'Other Department Manager', email: `${randomUUID()}@example.com`, password: randomUUID(), role: 'manager', department_id: 2 }, admin)
    assert.equal((await approve(quote.id, otherManager)).status, 403)
  })

  test('manager approval creates one PO, records sign-off, and rejects repeated submission', async () => {
    const { quote, rfq } = await prepareQuote()
    const response = await approve(quote.id)
    assert.equal(response.status, 201)
    const data = await response.json() as { order: { po_number: string; status: string; total_amount: number } }
    assert.equal(data.order.status, 'issued')
    assert.equal(Number(data.order.total_amount), 1180)
    assert.equal((await approve(quote.id)).status, 409)
    assert.equal((await Repository.getPurchaseOrders()).filter(po => po.rfq_id === rfq.id).length, 1)
    const logs = await Repository.getAuditLogs()
    assert.ok(logs.some(log => log.action === 'APPROVE_VENDOR_SELECTION' && log.user_id === manager.id && log.details?.includes(data.order.po_number)))
  })

  test('simultaneous manager approvals create one order and return one conflict', async () => {
    const { quote, rfq } = await prepareQuote()
    const responses = await Promise.all([approve(quote.id), approve(quote.id)])
    assert.deepEqual(responses.map(response => response.status).sort((a, b) => a - b), [201, 409])
    assert.equal((await Repository.getPurchaseOrders()).filter(po => po.rfq_id === rfq.id).length, 1)
  })

  test('a different quotation cannot create a second order for the same RFQ', async () => {
    const { quote, rfq } = await prepareQuote()
    const secondVendor = await Repository.getUserByEmail('contact@digitalsys.com')
    assert.ok(secondVendor)
    const alternative = await Repository.submitQuotation({ rfq_id: rfq.id, unit_price: 450, delivery_days: 8 }, secondVendor)
    assert.equal((await approve(quote.id)).status, 201)
    assert.equal((await approve(alternative.id)).status, 409)
    assert.equal((await Repository.getPurchaseOrders()).filter(po => po.rfq_id === rfq.id).length, 1)
  })
})