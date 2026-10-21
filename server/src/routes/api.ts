import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { Repository } from '../services/repository.js'
import { authenticateToken, authorizeRoles, signToken, AuthRequest } from '../middleware/auth.js'

export const apiRouter = Router()

// -------------------------------------------------------------
// AUTHENTICATION
// -------------------------------------------------------------
apiRouter.post('/auth/login', async (req, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }

    const user = await Repository.getUserByEmail(email)
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' })
    }

    if (user.status === 'disabled') {
      return res.status(403).json({ error: 'Your account is disabled. Contact your administrator.' })
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials. Incorrect password.' })
    }

    const token = signToken(user)
    const { password_hash, ...safeUser } = user

    await Repository.logAction(user, 'LOGIN', 'USER', user.employee_id, `User ${user.name} logged in`)

    res.json({ token, user: safeUser })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.get('/auth/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const user = await Repository.getUserById(req.user!.id)
    res.json({ user })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Demo switcher for easy role previewing
apiRouter.post('/auth/demo-switch', async (req, res: Response) => {
  try {
    const { role, email } = req.body
    let user = null

    if (email) {
      user = await Repository.getUserByEmail(email)
    } else if (role) {
      const all = await Repository.getAllUsers()
      user = all.find((u: any) => u.role === role)
    }

    if (!user) {
      return res.status(404).json({ error: 'Demo user not found for requested role.' })
    }

    const token = signToken(user)
    res.json({ token, user })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// -------------------------------------------------------------
// USERS (Admin only)
// -------------------------------------------------------------
apiRouter.get('/users', authenticateToken, authorizeRoles('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const users = await Repository.getAllUsers()
    res.json({ users })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/users', authenticateToken, authorizeRoles('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { employee_id, name, email, password, role, department_id, phone } = req.body
    if (!employee_id || !name || !email || !role) {
      return res.status(400).json({ error: 'Employee ID, Name, Email and Role are required.' })
    }

    const existing = await Repository.getUserByEmail(email)
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists.' })
    }

    const newUser = await Repository.createUser(
      { employee_id, name, email, password, role, department_id, phone },
      req.user!
    )
    res.status(201).json({ user: newUser })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.put('/users/:id', authenticateToken, authorizeRoles('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const updated = await Repository.updateUser(parseInt(req.params.id, 10), req.body, req.user!)
    if (!updated) return res.status(404).json({ error: 'User not found.' })
    res.json({ user: updated })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// -------------------------------------------------------------
// DEPARTMENTS & CATEGORIES
// -------------------------------------------------------------
apiRouter.get('/departments', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const departments = await Repository.getDepartments()
    res.json({ departments })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/departments', authenticateToken, authorizeRoles('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { code, name, manager_id } = req.body
    if (!code || !name) return res.status(400).json({ error: 'Department code and name are required.' })
    const dept = await Repository.createDepartment({ code, name, manager_id }, req.user!)
    res.status(201).json({ department: dept })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.get('/categories', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const categories = await Repository.getCategories()
    res.json({ categories })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/categories', authenticateToken, authorizeRoles('admin', 'procurement_officer'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, description } = req.body
    if (!name) return res.status(400).json({ error: 'Category name is required.' })
    const cat = await Repository.createCategory({ name, description }, req.user!)
    res.status(201).json({ category: cat })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// -------------------------------------------------------------
// VENDORS
// -------------------------------------------------------------
apiRouter.get('/vendors', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const vendors = await Repository.getVendors()
    res.json({ vendors })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.get('/vendors/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const vendor = await Repository.getVendorById(parseInt(req.params.id, 10))
    if (!vendor) return res.status(404).json({ error: 'Vendor not found.' })
    res.json({ vendor })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/vendors', authenticateToken, authorizeRoles('admin', 'procurement_officer'), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, contact_person, address, gst_number, category_id, rating } = req.body
    if (!name || !email) return res.status(400).json({ error: 'Vendor name and email are required.' })
    const vendor = await Repository.createVendor({ name, email, phone, contact_person, address, gst_number, category_id, rating }, req.user!)
    res.status(201).json({ vendor })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// -------------------------------------------------------------
// PURCHASE REQUESTS
// -------------------------------------------------------------
apiRouter.get('/purchase-requests', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string }
    let filters: any = { status }

    // Role-based visibility
    if (req.user!.role === 'employee') {
      filters.userId = req.user!.id
    } else if (req.user!.role === 'manager') {
      filters.departmentId = req.user!.department_id || undefined
    }

    const requests = await Repository.getPurchaseRequests(filters)
    res.json({ requests })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.get('/purchase-requests/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const pr = await Repository.getPurchaseRequestById(parseInt(req.params.id, 10))
    if (!pr) return res.status(404).json({ error: 'Purchase request not found.' })
    res.json({ request: pr })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/purchase-requests', authenticateToken, authorizeRoles('employee', 'manager', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { required_date, priority, purpose, items, status } = req.body
    if (!required_date || !purpose || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Required date, purpose, and at least one item are required.' })
    }

    const newPr = await Repository.createPurchaseRequest({ required_date, priority, purpose, items, status }, req.user!)
    res.status(201).json({ request: newPr })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.patch('/purchase-requests/:id/status', authenticateToken, authorizeRoles('manager', 'admin', 'procurement_officer'), async (req: AuthRequest, res: Response) => {
  try {
    const { status, remarks } = req.body
    if (!['approved', 'rejected', 'in_procurement', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' })
    }

    const updated = await Repository.updatePurchaseRequestStatus(parseInt(req.params.id, 10), status, remarks, req.user!)
    if (!updated) return res.status(404).json({ error: 'Purchase request not found.' })
    res.json({ request: updated })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// -------------------------------------------------------------
// RFQS & QUOTATIONS
// -------------------------------------------------------------
apiRouter.get('/rfqs', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string }
    let filters: any = { status }

    if (req.user!.role === 'vendor') {
      const vendor = await Repository.getVendorByUserId(req.user!.id)
      if (vendor) filters.vendorId = vendor.id
    }

    const rfqs = await Repository.getRfqs(filters)
    res.json({ rfqs })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.get('/rfqs/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const rfq = await Repository.getRfqById(parseInt(req.params.id, 10))
    if (!rfq) return res.status(404).json({ error: 'RFQ not found.' })
    res.json({ rfq })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/rfqs', authenticateToken, authorizeRoles('procurement_officer', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { pr_id, title, deadline, expected_delivery_date, terms, vendor_ids } = req.body
    if (!pr_id || !title || !deadline || !vendor_ids || !vendor_ids.length) {
      return res.status(400).json({ error: 'PR ID, title, deadline, and at least one invited vendor are required.' })
    }

    const newRfq = await Repository.createRfq({ pr_id, title, deadline, expected_delivery_date, terms, vendor_ids }, req.user!)
    res.status(201).json({ rfq: newRfq })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/rfqs/:id/quotes', authenticateToken, authorizeRoles('vendor', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const rfq_id = parseInt(req.params.id, 10)
    const quote = await Repository.submitQuotation({ ...req.body, rfq_id }, req.user!)
    res.status(201).json({ quotation: quote })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/rfqs/quotes/:quoteId/recommend', authenticateToken, authorizeRoles('procurement_officer', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body
    if (!reason) return res.status(400).json({ error: 'Recommendation rationale is required.' })
    await Repository.recommendQuotation(parseInt(req.params.quoteId, 10), reason, req.user!)
    res.json({ success: true, message: 'Vendor recommendation submitted for Manager approval.' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// -------------------------------------------------------------
// PURCHASE ORDERS
// -------------------------------------------------------------
apiRouter.get('/purchase-orders', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string }
    let filters: any = { status }

    if (req.user!.role === 'vendor') {
      const vendor = await Repository.getVendorByUserId(req.user!.id)
      if (vendor) filters.vendorId = vendor.id
    }

    const orders = await Repository.getPurchaseOrders(filters)
    res.json({ orders })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.get('/purchase-orders/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const po = await Repository.getPurchaseOrderById(parseInt(req.params.id, 10))
    if (!po) return res.status(404).json({ error: 'Purchase Order not found.' })
    res.json({ order: po })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/purchase-orders', authenticateToken, authorizeRoles('procurement_officer', 'admin', 'manager'), async (req: AuthRequest, res: Response) => {
  try {
    const { quote_id, expected_delivery, delivery_address, payment_terms } = req.body
    if (!quote_id || !expected_delivery) {
      return res.status(400).json({ error: 'Quote ID and expected delivery date are required.' })
    }

    const po = await Repository.createPurchaseOrderFromQuotation({ quote_id, expected_delivery, delivery_address, payment_terms }, req.user!)
    res.status(201).json({ order: po })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.patch('/purchase-orders/:id/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, dispatch_date, courier_name, tracking_ref } = req.body
    const po = await Repository.updatePurchaseOrderStatus(
      parseInt(req.params.id, 10),
      { status, dispatch_date, courier_name, tracking_ref },
      req.user!
    )
    if (!po) return res.status(404).json({ error: 'Purchase Order not found.' })
    res.json({ order: po })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// -------------------------------------------------------------
// GOODS RECEIPT NOTES (GRN)
// -------------------------------------------------------------
apiRouter.post('/goods-receipts', authenticateToken, authorizeRoles('procurement_officer', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { po_id, received_date, ordered_qty, received_qty, accepted_qty, rejected_qty, rejection_reason } = req.body
    if (!po_id || !received_date || ordered_qty === undefined || received_qty === undefined || accepted_qty === undefined) {
      return res.status(400).json({ error: 'PO ID, received date, and quantities are required.' })
    }

    const grn = await Repository.createGoodsReceipt(
      { po_id, received_date, ordered_qty, received_qty, accepted_qty, rejected_qty, rejection_reason },
      req.user!
    )
    res.status(201).json({ goods_receipt: grn })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// -------------------------------------------------------------
// INVOICES & PAYMENTS
// -------------------------------------------------------------
apiRouter.get('/invoices', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string }
    let filters: any = { status }

    if (req.user!.role === 'vendor') {
      const vendor = await Repository.getVendorByUserId(req.user!.id)
      if (vendor) filters.vendorId = vendor.id
    }

    const invoices = await Repository.getInvoices(filters)
    res.json({ invoices })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/invoices', authenticateToken, authorizeRoles('vendor', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { po_id, invoice_number, invoice_date, due_date, amount, notes } = req.body
    if (!po_id || !invoice_date || !due_date || !amount) {
      return res.status(400).json({ error: 'PO ID, invoice date, due date, and amount are required.' })
    }

    const invoice = await Repository.submitInvoice({ po_id, invoice_number, invoice_date, due_date, amount, notes }, req.user!)
    res.status(201).json({ invoice })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.post('/invoices/:id/pay', authenticateToken, authorizeRoles('procurement_officer', 'admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { amount, payment_date, payment_ref, notes } = req.body
    if (!amount || !payment_date) {
      return res.status(400).json({ error: 'Payment amount and date are required.' })
    }

    const payment = await Repository.recordPayment(
      { invoice_id: parseInt(req.params.id, 10), amount, payment_date, payment_ref, notes },
      req.user!
    )
    res.status(201).json({ payment })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// -------------------------------------------------------------
// NOTIFICATIONS & AUDIT LOGS
// -------------------------------------------------------------
apiRouter.get('/notifications', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await Repository.getNotifications(req.user!.id, req.user!.role)
    res.json({ notifications })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.patch('/notifications/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await Repository.markNotificationRead(parseInt(req.params.id, 10))
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

apiRouter.get('/audit-logs', authenticateToken, authorizeRoles('admin', 'procurement_officer'), async (req: AuthRequest, res: Response) => {
  try {
    const logs = await Repository.getAuditLogs(100)
    res.json({ logs })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// -------------------------------------------------------------
// ANALYTICS & DASHBOARD
// -------------------------------------------------------------
apiRouter.get('/analytics/dashboard', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const analytics = await Repository.getDashboardAnalytics(req.user!)
    res.json({ analytics })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})
