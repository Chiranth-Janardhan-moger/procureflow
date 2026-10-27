import { test, describe, before, after } from 'node:test'
import assert from 'node:assert'
import http from 'node:http'
import { app, ensureDatabase } from '../app.js'

let BASE_URL = ''

describe('ProcureFlow End-to-End Enterprise Procurement Lifecycle Test Suite', () => {
  let serverInstance: http.Server | null = null

  before(async () => {
    await ensureDatabase()
    await new Promise<void>(resolve => {
      serverInstance = app.listen(0, '127.0.0.1', () => resolve())
    })
    const address = serverInstance!.address() as { port: number }
    BASE_URL = `http://127.0.0.1:${address.port}/api`
  })

  after(async () => {
    if (serverInstance) {
      await new Promise<void>((resolve) => serverInstance!.close(() => resolve()))
    }
  })

  let employeeToken = ''
  let managerToken = ''
  let procurementToken = ''
  let vendorToken = ''
  let adminToken = ''

  let createdPrId: number = 0
  let createdPrItemIds: number[] = []
  let createdPrNumber: string = ''
  let createdRfqId: number = 0
  let submittedQuoteId: number = 0
  let createdPoId: number = 0
  let submittedInvoiceId: number = 0

  // 1. HEALTHCHECK & DATABASE MODE
  test('1. Healthcheck API returns OK and database status', async () => {
    const res = await fetch(`${BASE_URL}/health`)
    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as any
    assert.strictEqual(data.status, 'ok')
    assert.ok(data.service.includes('ProcureFlow'))
    assert.ok(data.database)
  })

  // 2. AUTHENTICATION & LOGIN FOR ALL 5 ROLES
  test('2. Authentication for all 5 enterprise roles', async () => {
    // Employee
    const empRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@company.com', password: 'password123' }),
    })
    assert.strictEqual(empRes.status, 200)
    const empData = (await empRes.json()) as any
    assert.strictEqual(empData.user.role, 'employee')
    employeeToken = empData.token

    // Manager
    const mgrRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'anita@company.com', password: 'password123' }),
    })
    assert.strictEqual(mgrRes.status, 200)
    const mgrData = (await mgrRes.json()) as any
    assert.strictEqual(mgrData.user.role, 'manager')
    managerToken = mgrData.token

    // Procurement Officer
    const procRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'kiran@company.com', password: 'password123' }),
    })
    assert.strictEqual(procRes.status, 200)
    const procData = (await procRes.json()) as any
    assert.strictEqual(procData.user.role, 'procurement_officer')
    procurementToken = procData.token

    // Vendor
    const venRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sales@techworld.com', password: 'vendor123' }),
    })
    assert.strictEqual(venRes.status, 200)
    const venData = (await venRes.json()) as any
    assert.strictEqual(venData.user.role, 'vendor')
    vendorToken = venData.token

    // Admin
    const admRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@company.com', password: 'admin123' }),
    })
    assert.strictEqual(admRes.status, 200)
    const admData = (await admRes.json()) as any
    assert.strictEqual(admData.user.role, 'admin')
    adminToken = admData.token
  })

  // 3. REJECT INVALID CREDENTIALS & UNAUTHORIZED ROLE ACCESS
  test('3. Rejects invalid credentials and unauthorized RBAC requests', async () => {
    // Bad password
    const failRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul@company.com', password: 'wrongpassword' }),
    })
    assert.strictEqual(failRes.status, 401)

    // Employee attempting to access Admin user management
    const forbiddenRes = await fetch(`${BASE_URL}/users`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    })
    assert.strictEqual(forbiddenRes.status, 403)
  })

  // 4. EMPLOYEE CREATES PURCHASE REQUEST
  test('4. Employee creates Purchase Request with multi-item line details', async () => {
    const prPayload = {
      required_date: '2026-11-20',
      priority: 'high',
      purpose: 'High performance GPU workstations for AI engineering team onboarding.',
      items: [
        {
          item_name: 'Custom NVIDIA RTX 4090 Workstation',
          category: 'IT Equipment',
          quantity: 2,
          estimated_unit_price: 250000,
          specification: '64GB DDR5, AMD Ryzen 9, 2TB Gen4 NVMe, 1000W Gold PSU',
        },
        {
          item_name: 'Dell 32-inch 4K USB-C Hub Monitor',
          category: 'IT Equipment',
          quantity: 4,
          estimated_unit_price: 45000,
          specification: 'IPS panel, 90W Power Delivery, height adjustable',
        },
      ],
    }

    const res = await fetch(`${BASE_URL}/purchase-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeToken}`,
      },
      body: JSON.stringify(prPayload),
    })

    assert.strictEqual(res.status, 201)
    const data = (await res.json()) as any
    assert.ok(data.request.id)
    assert.ok(data.request.pr_number.startsWith('PR-'))
    assert.strictEqual(data.request.status, 'pending')
    assert.strictEqual(Number(data.request.total_estimated_cost), 680000)
    assert.strictEqual(data.request.items.length, 2)

    createdPrId = data.request.id
    createdPrItemIds = data.request.items.map((item: any) => item.id)
    createdPrNumber = data.request.pr_number
  })

  // 5. MANAGER APPROVES PURCHASE REQUEST
  test('5. Department Manager approves the Purchase Request with remarks', async () => {
    const res = await fetch(`${BASE_URL}/purchase-requests/${createdPrId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify({
        status: 'approved',
        remarks: 'Approved. Hardware budget allocated under AI engineering R&D.',
      }),
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as any
    assert.strictEqual(data.request.status, 'approved')
    assert.ok(data.request.manager_remarks.includes('AI engineering'))
  })

  // 6. PROCUREMENT OFFICER CREATES RFQ FROM APPROVED PR
  test('6. Procurement Officer publishes RFQ tender inviting suppliers', async () => {
    const rfqPayload = {
      pr_id: createdPrId,
      title: 'Tender: GPU Workstations and 4K Displays for AI Team',
      deadline: '2026-11-10',
      expected_delivery_date: '2026-11-18',
      terms: 'Delivery within 8 days of PO issuance. Standard Net 30 payment terms post GRN verification.',
      vendor_ids: [1, 2, 3], // TechWorld, Digital Systems, CompZone
    }

    const res = await fetch(`${BASE_URL}/rfqs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${procurementToken}`,
      },
      body: JSON.stringify(rfqPayload),
    })

    assert.strictEqual(res.status, 201)
    const data = (await res.json()) as any
    assert.ok(data.rfq.id)
    assert.ok(data.rfq.rfq_number.startsWith('RFQ-'))
    assert.strictEqual(data.rfq.status, 'open')

    createdRfqId = data.rfq.id
  })

  // 7. VENDOR SUBMITS COMPETITIVE QUOTATION
  test('7. Vendor logs in and submits commercial quotation bid', async () => {
    const quotePayload = {
      line_items: [
        { pr_item_id: createdPrItemIds[0], unit_price: 240000 },
        { pr_item_id: createdPrItemIds[1], unit_price: 40000 },
      ],
      subtotal: 640000,
      tax_amount: 115200,
      discount_amount: 10000,
      final_amount: 745200,
      delivery_days: 6,
      warranty_years: 3,
      payment_terms: 'Net 30 Days after GRN',
      validity_date: '2026-12-01',
      notes: 'Authorized Platinum Partner. 3-Year Next Business Day onsite service included.',
    }

    const res = await fetch(`${BASE_URL}/rfqs/${createdRfqId}/quotes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendorToken}`,
      },
      body: JSON.stringify(quotePayload),
    })

    assert.strictEqual(res.status, 201)
    const data = (await res.json()) as any
    assert.ok(data.quotation.id)
    assert.ok(data.quotation.quote_number.startsWith('QT-'))
    assert.strictEqual(data.quotation.status, 'submitted')
    assert.strictEqual(Number(data.quotation.final_amount), 745200)

    submittedQuoteId = data.quotation.id
  })

  // 8. PROCUREMENT OFFICER RECOMMENDS VENDOR BID
  test('8. Procurement Officer recommends quotation with commercial justification', async () => {
    const res = await fetch(`${BASE_URL}/rfqs/quotes/${submittedQuoteId}/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${procurementToken}`,
      },
      body: JSON.stringify({
        reason: 'Optimal commercial terms, 3-year full warranty, and verified 6-day lead time.',
      }),
    })

    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as any
    assert.strictEqual(data.success, true)

    // Verify RFQ details show recommended quote
    const rfqRes = await fetch(`${BASE_URL}/rfqs/${createdRfqId}`, {
      headers: { Authorization: `Bearer ${procurementToken}` },
    })
    const rfqData = (await rfqRes.json()) as any
    const recQuote = rfqData.rfq.quotations.find((q: any) => q.id === submittedQuoteId)
    assert.ok(recQuote.is_recommended)
  })

  // 9. PURCHASE ORDER GENERATION
  test('9. Manager approves vendor selection and generates the binding Purchase Order', async () => {
    const poPayload = {
      quote_id: submittedQuoteId,
      expected_delivery: '2026-11-18',
      delivery_address: 'ProcureFlow Tech Park, Wing B, Level 4 IT Ops, Bengaluru 560100',
    }

    const res = await fetch(`${BASE_URL}/purchase-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${managerToken}`,
      },
      body: JSON.stringify(poPayload),
    })

    assert.strictEqual(res.status, 201)
    const data = (await res.json()) as any
    assert.ok(data.order.id)
    assert.ok(data.order.po_number.startsWith('PO-'))
    assert.strictEqual(data.order.status, 'issued')
    assert.strictEqual(Number(data.order.total_amount), 745200)

    createdPoId = data.order.id
  })

  // 10. VENDOR ACCEPTS PO AND DISPATCHES ORDER
  test('10. Vendor accepts PO and marks consignment dispatched with tracking code', async () => {
    // Accept
    const acceptRes = await fetch(`${BASE_URL}/purchase-orders/${createdPoId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendorToken}`,
      },
      body: JSON.stringify({ status: 'accepted' }),
    })
    assert.strictEqual(acceptRes.status, 200)

    // Dispatch
    const dispatchRes = await fetch(`${BASE_URL}/purchase-orders/${createdPoId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendorToken}`,
      },
      body: JSON.stringify({
        status: 'dispatched',
        dispatch_date: '2026-11-12',
        courier_name: 'BlueDart Express',
        tracking_ref: 'BDX-99887766BLR',
      }),
    })
    assert.strictEqual(dispatchRes.status, 200)
    const dispatchData = (await dispatchRes.json()) as any
    assert.strictEqual(dispatchData.order.status, 'dispatched')
    assert.strictEqual(dispatchData.order.tracking_ref, 'BDX-99887766BLR')
  })

  // 11. PROCUREMENT RECORDS GOODS RECEIPT NOTE (GRN)
  test('11. Procurement inspects physical shipment and records GRN', async () => {
    const grnPayload = {
      po_id: createdPoId,
      received_date: '2026-11-15',
      ordered_qty: 6,
      items: [
        { pr_item_id: createdPrItemIds[0], received_qty: 2, accepted_qty: 2, rejected_qty: 0 },
        { pr_item_id: createdPrItemIds[1], received_qty: 4, accepted_qty: 3, rejected_qty: 1, rejection_reason: 'Cable damage; replacement required.' },
      ],
    }

    const res = await fetch(`${BASE_URL}/goods-receipts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${procurementToken}`,
      },
      body: JSON.stringify(grnPayload),
    })

    assert.strictEqual(res.status, 201)
    const data = (await res.json()) as any
    assert.ok(data.goods_receipt.id)
    assert.ok(data.goods_receipt.grn_number.startsWith('GRN-'))
    assert.strictEqual(data.goods_receipt.accepted_qty, 5)
    assert.strictEqual(data.goods_receipt.rejected_qty, 1)

    // A rejected item keeps the order outstanding until its replacement is accepted.
    const poRes = await fetch(`${BASE_URL}/purchase-orders/${createdPoId}`, {
      headers: { Authorization: `Bearer ${procurementToken}` },
    })
    const poData = (await poRes.json()) as any
    assert.strictEqual(poData.order.status, 'dispatched')
    const replacement = await fetch(`${BASE_URL}/goods-receipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${procurementToken}` },
      body: JSON.stringify({ po_id: createdPoId, received_date: '2026-11-16', items: [{ pr_item_id: createdPrItemIds[1], received_qty: 1, accepted_qty: 1, rejected_qty: 0 }] }),
    })
    assert.strictEqual(replacement.status, 201)
    const delivered = await fetch(`${BASE_URL}/purchase-orders/${createdPoId}`, { headers: { Authorization: `Bearer ${procurementToken}` } }).then(response => response.json()) as any
    assert.strictEqual(delivered.order.status, 'delivered')
    const fulfilled = await fetch(`${BASE_URL}/purchase-requests/${createdPrId}`, { headers: { Authorization: `Bearer ${employeeToken}` } }).then(response => response.json()) as any
    assert.strictEqual(fulfilled.request.status, 'completed')
  })

  // 12. VENDOR SUBMITS INVOICE & CORPORATE TREASURY SETTLES PAYMENT
  test('12. Vendor submits tax invoice and corporate treasury records electronic settlement', async () => {
    // Submit invoice
    const invPayload = {
      po_id: createdPoId,
      invoice_number: `INV-${Date.now().toString().slice(-5)}`,
      invoice_date: '2026-11-15',
      due_date: '2026-12-15',
      amount: 745200,
      notes: 'GST Tax Invoice for GPU workstations and displays under PO fulfillment',
    }

    const invRes = await fetch(`${BASE_URL}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${vendorToken}`,
      },
      body: JSON.stringify(invPayload),
    })
    assert.strictEqual(invRes.status, 201)
    const invData = (await invRes.json()) as any
    assert.ok(invData.invoice.id)
    submittedInvoiceId = invData.invoice.id

    // Treasury settlement
    const payPayload = {
      amount: 745200,
      payment_date: '2026-11-16',
      payment_ref: 'PAY-882910',
      notes: 'NEFT corporate treasury clearing to TechWorld Solutions',
    }

    const payRes = await fetch(`${BASE_URL}/invoices/${submittedInvoiceId}/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${procurementToken}`,
      },
      body: JSON.stringify(payPayload),
    })
    assert.strictEqual(payRes.status, 201)
    const payData = (await payRes.json()) as any
    assert.strictEqual(payData.payment.payment_ref, 'PAY-882910')
    assert.strictEqual(payData.payment.status, 'paid')

    // Verify PO is now fully completed
    const finalPoRes = await fetch(`${BASE_URL}/purchase-orders/${createdPoId}`, {
      headers: { Authorization: `Bearer ${procurementToken}` },
    })
    const finalPoData = (await finalPoRes.json()) as any
    assert.strictEqual(finalPoData.order.status, 'completed')
  })

  // 13. AUDIT LOGS TRACEABILITY
  test('13. Immutable audit log contains comprehensive transaction history', async () => {
    const res = await fetch(`${BASE_URL}/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert.strictEqual(res.status, 200)
    const data = (await res.json()) as any
    assert.ok(data.logs.length >= 10)

    // Verify presence of our created actions
    const hasCreatePr = data.logs.some((l: any) => l.action === 'CREATE_PURCHASE_REQUEST')
    const hasApprovePr = data.logs.some((l: any) => l.action === 'APPROVE_PURCHASE_REQUEST')
    const hasCreateRfq = data.logs.some((l: any) => l.action === 'CREATE_RFQ')
    const hasSubmitQuote = data.logs.some((l: any) => l.action === 'SUBMIT_QUOTATION')
    const hasGeneratePo = data.logs.some((l: any) => l.action === 'GENERATE_PURCHASE_ORDER')
    const hasGrn = data.logs.some((l: any) => l.action === 'RECORD_GOODS_RECEIPT')
    const hasPayment = data.logs.some((l: any) => l.action === 'RECORD_PAYMENT')

    assert.ok(hasCreatePr, 'CREATE_PURCHASE_REQUEST audit event present')
    assert.ok(hasApprovePr, 'APPROVE_PURCHASE_REQUEST audit event present')
    assert.ok(hasCreateRfq, 'CREATE_RFQ audit event present')
    assert.ok(hasSubmitQuote, 'SUBMIT_QUOTATION audit event present')
    assert.ok(hasGeneratePo, 'GENERATE_PURCHASE_ORDER audit event present')
    assert.ok(hasGrn, 'RECORD_GOODS_RECEIPT audit event present')
    assert.ok(hasPayment, 'RECORD_PAYMENT audit event present')
  })

  // 14. ANALYTICS & DASHBOARD AGGREGATION
  test('14. Dashboard analytics calculates metrics accurately for all roles', async () => {
    // Employee Analytics
    const empAnalytics = (await fetch(`${BASE_URL}/analytics/dashboard`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    }).then(r => r.json())) as any
    assert.strictEqual(empAnalytics.analytics.role, 'employee')
    assert.ok(empAnalytics.analytics.totalRequests >= 1)

    // Procurement Analytics
    const procAnalytics = (await fetch(`${BASE_URL}/analytics/dashboard`, {
      headers: { Authorization: `Bearer ${procurementToken}` },
    }).then(r => r.json())) as any
    assert.strictEqual(procAnalytics.analytics.role, 'procurement_officer')
    assert.ok(procAnalytics.analytics.totalSpend > 0)
  })
})
