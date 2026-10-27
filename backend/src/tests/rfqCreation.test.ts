import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { app, ensureDatabase } from '../app.js'
import { Repository, type LoggedUser } from '../services/repository.js'
import { signToken } from '../middleware/auth.js'
import { memoryStore } from '../db/index.js'

describe('API: one RFQ per approved purchase request', () => {
  let server: Server
  let baseUrl: string
  let token: string
  let procurement: LoggedUser
  let employee: LoggedUser

  before(async () => {
    await ensureDatabase()
    procurement = await Repository.getUserByEmail('kiran@company.com')
    employee = await Repository.getUserByEmail('rahul@company.com')
    assert.ok(procurement)
    assert.ok(employee)
    token = signToken(procurement)
    await new Promise<void>(resolve => {
      server = app.listen(0, '127.0.0.1', () => resolve())
    })
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
  })

  after(async () => {
    if (server) await new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    })
  })

  async function createRequest(status = 'approved') {
    const request = await Repository.createPurchaseRequest({
      required_date: '2026-12-01',
      purpose: 'RFQ eligibility regression test',
      status: 'pending',
      items: [{ item_name: 'Keyboard', quantity: 2, estimated_unit_price: 500 }],
    }, employee)
    if (status === 'approved') await Repository.updatePurchaseRequestStatus(request.id, 'approved', undefined, await Repository.getUserByEmail('anita@company.com'))
    else if (status !== 'pending') memoryStore.purchase_requests.find(row => row.id === request.id)!.status = status
    return request
  }

  function publish(prId: number) {
    return fetch(`${baseUrl}/rfqs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pr_id: prId, title: 'Keyboard RFQ', deadline: '2026-11-20', vendor_ids: [1] }),
    })
  }

  test('creates the first RFQ and rejects repeated creation even if the request is reapproved', async () => {
    const request = await createRequest()
    assert.equal((await publish(request.id)).status, 201)
    assert.equal((await Repository.getPurchaseRequestById(request.id))?.status, 'in_procurement')
    const repeated = await publish(request.id)
    assert.equal(repeated.status, 409)
    assert.match((await repeated.json() as { error: string }).error, /already exists/)
    // Simulate a legacy corrupted status to verify the existing-RFQ guard independently.
    memoryStore.purchase_requests.find(row => row.id === request.id)!.status = 'approved'
    assert.equal((await publish(request.id)).status, 409)
    const matches = (await Repository.getRfqs()).filter(rfq => rfq.pr_id === request.id)
    assert.equal(matches.length, 1)
  })

  test('rejects pending, rejected, completed, and in-procurement requests without creating RFQs', async () => {
    for (const status of ['pending', 'rejected', 'completed', 'in_procurement']) {
      const request = await createRequest(status)
      assert.equal((await publish(request.id)).status, 409)
      assert.equal((await Repository.getRfqs()).filter(rfq => rfq.pr_id === request.id).length, 0)
    }
  })

  test('vendor RFQ details and quotation use the requested two keyboards rather than demo quantities', async () => {
    const request = await createRequest()
    const published = await publish(request.id)
    assert.equal(published.status, 201)
    const created = await published.json() as { rfq: { id: number } }
    const vendor = await Repository.getUserByEmail('sales@techworld.com')
    assert.ok(vendor)
    const vendorToken = signToken(vendor)
    const detailsResponse = await fetch(`${baseUrl}/rfqs/${created.rfq.id}`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    })
    assert.equal(detailsResponse.status, 200)
    const details = await detailsResponse.json() as { rfq: { pr_id: number; items: Array<{ item_name: string; quantity: number; estimated_unit_price: number }> } }
    assert.equal(details.rfq.pr_id, request.id)
    assert.equal(details.rfq.items[0].item_name, 'Keyboard')
    assert.equal(Number(details.rfq.items[0].quantity), 2)
    assert.equal(Number(details.rfq.items[0].estimated_unit_price), 500)
    const quoted = await fetch(`${baseUrl}/rfqs/${created.rfq.id}/quotes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${vendorToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_price: 500, delivery_days: 7 }),
    })
    assert.equal(quoted.status, 201)
    const result = await quoted.json() as { quotation: { subtotal: number; tax_amount: number; final_amount: number } }
    assert.equal(Number(result.quotation.subtotal), 1000)
    assert.equal(Number(result.quotation.tax_amount), 180)
    assert.equal(Number(result.quotation.final_amount), 1180)
  })

  test('returns 404 for a nonexistent purchase request', async () => {
    assert.equal((await publish(2147483647)).status, 404)
  })

  test('simultaneous submissions produce one RFQ and one conflict', async () => {
    const request = await createRequest()
    const responses = await Promise.all([publish(request.id), publish(request.id)])
    assert.deepEqual(responses.map(response => response.status).sort((a, b) => a - b), [201, 409])
    assert.equal((await Repository.getRfqs()).filter(rfq => rfq.pr_id === request.id).length, 1)
  })
})