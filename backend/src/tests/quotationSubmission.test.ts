import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { app, ensureDatabase } from '../app.js'
import { memoryStore } from '../db/index.js'
import { Repository, type LoggedUser } from '../services/repository.js'
import { signToken } from '../middleware/auth.js'
import { canSubmitQuotation } from '../../../frontend/src/services/quotationEligibility.js'

describe('Unit: vendor bid button eligibility', () => {
  test('allows a first bid on open and evaluation tenders', () => {
    assert.equal(canSubmitQuotation({ status: 'open', has_submitted_quotation: false }), true)
    assert.equal(canSubmitQuotation({ status: 'evaluation', has_submitted_quotation: false }), true)
  })
  test('hides bidding after the deadline even if the tender status has not yet changed', () => {
    assert.equal(canSubmitQuotation({ status: 'open', has_submitted_quotation: false, deadline: '2000-01-01' }), false)
  })

  test('hides the submit action once this vendor has bid', () => {
    assert.equal(canSubmitQuotation({ status: 'evaluation', has_submitted_quotation: true }), false)
  })
  test('hides the submit action for closed, cancelled, and draft tenders', () => {
    for (const status of ['closed', 'cancelled', 'draft'] as const) {
      assert.equal(canSubmitQuotation({ status, has_submitted_quotation: false }), false)
    }
  })
})

describe('API: one quotation per invited vendor per RFQ', () => {
  let server: Server
  let baseUrl: string
  let procurement: LoggedUser
  let employee: LoggedUser
  let vendor: LoggedUser
  let otherVendor: LoggedUser

  before(async () => {
    await ensureDatabase()
    procurement = await Repository.getUserByEmail('kiran@company.com')
    employee = await Repository.getUserByEmail('rahul@company.com')
    vendor = await Repository.getUserByEmail('sales@techworld.com')
    otherVendor = await Repository.getUserByEmail('contact@digitalsys.com')
    await new Promise<void>(resolve => { server = app.listen(0, '127.0.0.1', () => resolve()) })
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  })
  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    })
  })

  async function tender(inviteBoth = true) {
    const request = await Repository.createPurchaseRequest({
      required_date: '2026-12-01', purpose: 'Vendor bidding regression', status: 'pending',
      items: [{ item_name: 'Keyboard', quantity: 2, estimated_unit_price: 500 }],
    }, employee)
    await Repository.updatePurchaseRequestStatus(request.id, 'approved', undefined, await Repository.getUserByEmail('anita@company.com'))
    return Repository.createRfq({ pr_id: request.id, title: 'Keyboard RFQ', deadline: '2026-11-20', vendor_ids: inviteBoth ? [1, 2] : [1] }, procurement)
  }
  function bid(rfqId: number, user = vendor) {
    return fetch(`${baseUrl}/rfqs/${rfqId}/quotes`, {
      method: 'POST', headers: { Authorization: `Bearer ${signToken(user)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_price: 500, delivery_days: 7 }),
    })
  }
  function count(rfqId: number) { return memoryStore.quotations.filter(q => q.rfq_id === rfqId).length }

  test('accepts the first quotation and rejects repeated bids without inserting duplicates', async () => {
    const rfq = await tender()
    assert.equal((await bid(rfq.id)).status, 201)
    const repeat = await bid(rfq.id)
    assert.equal(repeat.status, 409)
    assert.match((await repeat.json() as { error: string }).error, /already submitted/)
    assert.equal(count(rfq.id), 1)
  })
  test('simultaneous submissions by the same vendor create exactly one bid', async () => {
    const rfq = await tender()
    const results = await Promise.all([bid(rfq.id), bid(rfq.id)])
    assert.deepEqual(results.map(result => result.status).sort((a, b) => a - b), [201, 409])
    assert.equal(count(rfq.id), 1)
  })
  test('other invited vendors can still bid, and portal bid flags belong to the current vendor', async () => {
    const rfq = await tender()
    assert.equal((await bid(rfq.id)).status, 201)
    const own = await fetch(`${baseUrl}/rfqs`, { headers: { Authorization: `Bearer ${signToken(vendor)}` } })
    const other = await fetch(`${baseUrl}/rfqs`, { headers: { Authorization: `Bearer ${signToken(otherVendor)}` } })
    const ownList = await own.json() as { rfqs: Array<{ id: number; has_submitted_quotation: boolean }> }
    const otherList = await other.json() as { rfqs: Array<{ id: number; has_submitted_quotation: boolean }> }
    assert.equal(ownList.rfqs.find(r => r.id === rfq.id)?.has_submitted_quotation, true)
    assert.equal(otherList.rfqs.find(r => r.id === rfq.id)?.has_submitted_quotation, false)
    assert.equal((await bid(rfq.id, otherVendor)).status, 201)
    assert.equal(count(rfq.id), 2)
  })
  test('uninvited vendors cannot submit quotations', async () => {
    const rfq = await tender(false)
    assert.equal((await bid(rfq.id, otherVendor)).status, 403)
    assert.equal(count(rfq.id), 0)
  })
  test('closed, cancelled, and draft RFQs reject bids without reopening the tender', async () => {
    for (const status of ['closed', 'cancelled', 'draft']) {
      const rfq = await tender()
      const stored = memoryStore.rfqs.find(r => r.id === rfq.id)
      assert.ok(stored)
      stored.status = status
      assert.equal((await bid(rfq.id)).status, 409)
      assert.equal(stored.status, status)
      assert.equal(count(rfq.id), 0)
    }
  })
  test('a nonexistent RFQ returns 404', async () => {
    assert.equal((await bid(2147483647)).status, 404)
  })
})