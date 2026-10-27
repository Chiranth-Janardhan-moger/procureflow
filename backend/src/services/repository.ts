import { isPostgresActive, getPool, memoryStore } from '../db/index.js'
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { getVendorPasswordError } from './vendorCredentials.js'
import * as workflow from './procurementWorkflow.js'
import { atomicWorkflow } from './workflowStore.js'
import { ensure, receiptProgress, date as workflowDate, today as workflowToday } from './workflowRules.js'
export interface LoggedUser {
  id: number
  employee_id: string
  name: string
  email: string
  role: string
  department_id: number | null
}

export class Repository {
  // -------------------------------------------------------------
  // AUDIT LOGGING
  // -------------------------------------------------------------
  static async logAction(
    user: LoggedUser | null,
    action: string,
    entityType: string,
    entityId: string,
    details: string,
    ip: string = '127.0.0.1'
  ) {
    const logItem = {
      id: memoryStore.audit_logs.reduce((max, row) => Math.max(max, row.id), 0) + 1,
      user_id: user?.id ?? null,
      user_name: user?.name ?? 'System',
      user_role: user?.role ?? 'system',
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: ip,
      created_at: new Date().toISOString(),
    }

    if (isPostgresActive()) {
      try {
        await getPool()!.query(
          `INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [logItem.user_id, logItem.user_name, logItem.user_role, logItem.action, logItem.entity_type, logItem.entity_id, logItem.details, logItem.ip_address, logItem.created_at]
        )
      } catch (e) {
        console.error('Failed to log audit event to Postgres:', e)
      }
    } else {
      memoryStore.audit_logs.unshift(logItem)
    }
  }

  // -------------------------------------------------------------
  // NOTIFICATIONS
  // -------------------------------------------------------------
  static async createNotification(userId: number | null, role: string, title: string, message: string, link: string = '/') {
    const notif = {
      id: memoryStore.notifications.reduce((max, row) => Math.max(max, row.id), 0) + 1,
      user_id: userId,
      role,
      title,
      message,
      link,
      is_read: false,
      created_at: new Date().toISOString(),
    }

    if (isPostgresActive()) {
      try {
        await getPool()!.query(
          `INSERT INTO notifications (user_id, role, title, message, link, is_read, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [notif.user_id, notif.role, notif.title, notif.message, notif.link, notif.is_read, notif.created_at]
        )
      } catch (e) {
        console.error('Failed to save notification to Postgres:', e)
      }
    } else {
      memoryStore.notifications.unshift(notif)
    }
  }

  static async getNotifications(userId: number, role: string) {
    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `SELECT * FROM notifications WHERE user_id = $1 OR (user_id IS NULL AND role = $2) ORDER BY created_at DESC LIMIT 30`,
        [userId, role]
      )
      return res.rows
    }
    return memoryStore.notifications.filter(n => n.user_id === userId || (n.user_id === null && n.role === role)).slice(0, 30)
  }

    static async markNotificationRead(id: number, user: LoggedUser): Promise<void> {
    await atomicWorkflow(async store => {
      const notification = await store.find('notifications', id, true)
      ensure(notification, 'Notification not found.', 404)
      ensure(notification.user_id === user.id || (notification.user_id === null && notification.role === user.role), 'This notification belongs to another user.', 403)
      await store.update('notifications', id, { is_read: true })
    })
  }

  static async getUserByEmail(email: string) {
    if (isPostgresActive()) {
      const res = await getPool()!.query(`SELECT * FROM users WHERE LOWER(email) = LOWER($1)`, [email])
      return res.rows[0] || null
    }
    return memoryStore.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
  }

  static async getUserById(id: number) {
    if (isPostgresActive()) {
      const res = await getPool()!.query(`SELECT id, employee_id, name, email, role, department_id, phone, status, created_at FROM users WHERE id = $1`, [id])
      return res.rows[0] || null
    }
    const u = memoryStore.users.find(u => u.id === id)
    if (!u) return null
    const { password_hash, ...safeUser } = u
    return safeUser
  }

  static async getAllUsers() {
    if (isPostgresActive()) {
      const res = await getPool()!.query(`
        SELECT u.id, u.employee_id, u.name, u.email, u.role, u.department_id, d.name as department_name, u.phone, u.status, u.created_at
        FROM users u
        LEFT JOIN departments d ON u.department_id = d.id
        ORDER BY u.id ASC
      `)
      return res.rows
    }
    return memoryStore.users.map(u => {
      const dept = memoryStore.departments.find(d => d.id === u.department_id)
      const { password_hash, ...safe } = u
      return { ...safe, department_name: dept ? dept.name : null }
    })
  }

  static async createUser(userData: {
    employee_id: string
    name: string
    email: string
    password?: string
    role: string
    department_id?: number | null
    phone?: string
  }, adminUser: LoggedUser) {
    const password = userData.password || 'password123'
    const password_hash = bcrypt.hashSync(password, 10)

    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `INSERT INTO users (employee_id, name, email, password_hash, role, department_id, phone, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
         RETURNING id, employee_id, name, email, role, department_id, phone, status, created_at`,
        [userData.employee_id, userData.name, userData.email, password_hash, userData.role, userData.department_id || null, userData.phone || null]
      )
      const newUser = res.rows[0]
      await this.logAction(adminUser, 'CREATE_USER', 'USER', newUser.employee_id, `Created user ${newUser.name} with role ${newUser.role}`)
      return newUser
    }

    const newId = memoryStore.users.length ? Math.max(...memoryStore.users.map(u => u.id)) + 1 : 1
    const newUserObj = {
      id: newId,
      employee_id: userData.employee_id,
      name: userData.name,
      email: userData.email,
      password_hash,
      role: userData.role,
      department_id: userData.department_id || null,
      phone: userData.phone || null,
      status: 'active',
    }
    memoryStore.users.push(newUserObj)
    await this.logAction(adminUser, 'CREATE_USER', 'USER', newUserObj.employee_id, `Created user ${newUserObj.name} with role ${newUserObj.role}`)
    const { password_hash: _, ...safe } = newUserObj
    return safe
  }

  static async updateUser(id: number, data: any, adminUser: LoggedUser) {
    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `UPDATE users
         SET name = COALESCE($1, name),
             role = COALESCE($2, role),
             department_id = COALESCE($3, department_id),
             phone = COALESCE($4, phone),
             status = COALESCE($5, status)
         WHERE id = $6
         RETURNING id, employee_id, name, email, role, department_id, phone, status`,
        [data.name, data.role, data.department_id, data.phone, data.status, id]
      )
      await this.logAction(adminUser, 'UPDATE_USER', 'USER', `ID-${id}`, `Updated user ${data.name || id}`)
      return res.rows[0]
    }

    const u = memoryStore.users.find(u => u.id === id)
    if (!u) return null
    if (data.name !== undefined) u.name = data.name
    if (data.role !== undefined) u.role = data.role
    if (data.department_id !== undefined) u.department_id = data.department_id
    if (data.phone !== undefined) u.phone = data.phone
    if (data.status !== undefined) u.status = data.status

    await this.logAction(adminUser, 'UPDATE_USER', 'USER', u.employee_id, `Updated user ${u.name}`)
    const { password_hash, ...safe } = u
    return safe
  }

  // -------------------------------------------------------------
  // DEPARTMENTS & CATEGORIES
  // -------------------------------------------------------------
  static async getDepartments() {
    if (isPostgresActive()) {
      const res = await getPool()!.query(`
        SELECT d.*, u.name as manager_name
        FROM departments d
        LEFT JOIN users u ON d.manager_id = u.id
        ORDER BY d.id ASC
      `)
      return res.rows
    }
    return memoryStore.departments.map(d => {
      const mgr = memoryStore.users.find(u => u.id === d.manager_id)
      return { ...d, manager_name: mgr ? mgr.name : null }
    })
  }

  static async createDepartment(data: { code: string; name: string; manager_id?: number | null }, user: LoggedUser) {
    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `INSERT INTO departments (code, name, manager_id) VALUES ($1, $2, $3) RETURNING *`,
        [data.code.toUpperCase(), data.name, data.manager_id || null]
      )
      await this.logAction(user, 'CREATE_DEPARTMENT', 'DEPARTMENT', data.code, `Created department ${data.name}`)
      return res.rows[0]
    }
    const newId = memoryStore.departments.length ? Math.max(...memoryStore.departments.map(d => d.id)) + 1 : 1
    const newDept = { id: newId, code: data.code.toUpperCase(), name: data.name, manager_id: data.manager_id || null }
    memoryStore.departments.push(newDept)
    await this.logAction(user, 'CREATE_DEPARTMENT', 'DEPARTMENT', data.code, `Created department ${data.name}`)
    return newDept
  }

  static async getCategories() {
    if (isPostgresActive()) {
      const res = await getPool()!.query(`SELECT * FROM categories ORDER BY id ASC`)
      return res.rows
    }
    return memoryStore.categories
  }

  static async createCategory(data: { name: string; description?: string }, user: LoggedUser) {
    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *`,
        [data.name, data.description || null]
      )
      await this.logAction(user, 'CREATE_CATEGORY', 'CATEGORY', data.name, `Created category ${data.name}`)
      return res.rows[0]
    }
    const newId = memoryStore.categories.length ? Math.max(...memoryStore.categories.map(c => c.id)) + 1 : 1
    const newCat = { id: newId, name: data.name, description: data.description || '' }
    memoryStore.categories.push(newCat)
    await this.logAction(user, 'CREATE_CATEGORY', 'CATEGORY', data.name, `Created category ${data.name}`)
    return newCat
  }

  // -------------------------------------------------------------
  // VENDORS
  // -------------------------------------------------------------
  static async getVendors() {
    if (isPostgresActive()) {
      const res = await getPool()!.query(`
        SELECT v.*, c.name as category_name
        FROM vendors v
        LEFT JOIN categories c ON v.category_id = c.id
        ORDER BY v.id ASC
      `)
      return res.rows
    }
    return memoryStore.vendors.map(v => {
      const cat = memoryStore.categories.find(c => c.id === v.category_id)
      return { ...v, category_name: cat ? cat.name : null }
    })
  }

  static async getVendorById(id: number) {
    if (isPostgresActive()) {
      const res = await getPool()!.query(`
        SELECT v.*, c.name as category_name
        FROM vendors v
        LEFT JOIN categories c ON v.category_id = c.id
        WHERE v.id = $1
      `, [id])
      return res.rows[0] || null
    }
    const v = memoryStore.vendors.find(v => v.id === id)
    if (!v) return null
    const cat = memoryStore.categories.find(c => c.id === v.category_id)
    return { ...v, category_name: cat ? cat.name : null }
  }

  static async getVendorByUserId(userId: number) {
    if (isPostgresActive()) {
      const res = await getPool()!.query(`SELECT * FROM vendors WHERE user_id = $1`, [userId])
      return res.rows[0] || null
    }
    return memoryStore.vendors.find(v => v.user_id === userId) || null
  }

  static async createVendor(data: {
    name: string
    email: string
    password: string
    phone?: string
    contact_person?: string
    address?: string
    gst_number?: string
    category_id?: number | null
    rating?: number
  }, user: LoggedUser) {
    const passwordError = getVendorPasswordError(data.password)
    if (passwordError) throw new Error(passwordError)
    const vendorCode = `VND-${String(randomInt(100, 1000))}`

    // Also auto-create a vendor login account
    const vendorUser = await this.createUser({
      employee_id: vendorCode,
      name: data.name,
      email: data.email,
      password: data.password,
      role: 'vendor',
      department_id: null,
      phone: data.phone,
    }, user)

    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `INSERT INTO vendors (vendor_code, name, email, phone, contact_person, address, gst_number, category_id, rating, status, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active', $10)
         RETURNING *`,
        [vendorCode, data.name, data.email, data.phone || null, data.contact_person || null, data.address || null, data.gst_number || null, data.category_id || null, data.rating || 4.5, vendorUser.id]
      )
      await this.logAction(user, 'CREATE_VENDOR', 'VENDOR', vendorCode, `Added vendor ${data.name} with auto portal login`)
      return res.rows[0]
    }

    const newId = memoryStore.vendors.length ? Math.max(...memoryStore.vendors.map(v => v.id)) + 1 : 1
    const newVendor = {
      id: newId,
      vendor_code: vendorCode,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      contact_person: data.contact_person || null,
      address: data.address || null,
      gst_number: data.gst_number || null,
      category_id: data.category_id || null,
      rating: data.rating || 4.5,
      status: 'active',
      user_id: vendorUser.id,
    }
    memoryStore.vendors.push(newVendor)
    await this.logAction(user, 'CREATE_VENDOR', 'VENDOR', vendorCode, `Added vendor ${data.name} with auto portal login`)
    return newVendor
  }

  // -------------------------------------------------------------
  // PURCHASE REQUESTS & ITEMS
  // -------------------------------------------------------------
  static async getPurchaseRequests(filters?: { userId?: number; departmentId?: number; status?: string }) {
    if (isPostgresActive()) {
      let query = `
        SELECT pr.*, u.name as employee_name, u.email as employee_email, d.name as department_name,
               (SELECT COUNT(*) FROM pr_items WHERE pr_id = pr.id) as item_count
        FROM purchase_requests pr
        LEFT JOIN users u ON pr.user_id = u.id
        LEFT JOIN departments d ON pr.department_id = d.id
        WHERE 1=1
      `
      const params: any[] = []
      let idx = 1
      if (filters?.userId) {
        query += ` AND pr.user_id = $${idx++}`
        params.push(filters.userId)
      }
      if (filters?.departmentId) {
        query += ` AND pr.department_id = $${idx++}`
        params.push(filters.departmentId)
      }
      if (filters?.status && filters.status !== 'all') {
        query += ` AND pr.status = $${idx++}`
        params.push(filters.status)
      }
      query += ` ORDER BY pr.id DESC`

      const res = await getPool()!.query(query, params)
      return res.rows
    }

    return memoryStore.purchase_requests
      .filter(pr => {
        if (filters?.userId && pr.user_id !== filters.userId) return false
        if (filters?.departmentId && pr.department_id !== filters.departmentId) return false
        if (filters?.status && filters.status !== 'all' && pr.status !== filters.status) return false
        return true
      })
      .map(pr => {
        const u = memoryStore.users.find(u => u.id === pr.user_id)
        const d = memoryStore.departments.find(d => d.id === pr.department_id)
        const itemCount = memoryStore.pr_items.filter(item => item.pr_id === pr.id).length
        return {
          ...pr,
          employee_name: u?.name || 'Unknown',
          employee_email: u?.email || '',
          department_name: d?.name || 'General',
          item_count: itemCount,
        }
      })
      .sort((a, b) => b.id - a.id)
  }

  static async getPurchaseRequestById(id: number) {
    if (isPostgresActive()) {
      const prRes = await getPool()!.query(`
        SELECT pr.*, u.name as employee_name, u.email as employee_email, d.name as department_name
        FROM purchase_requests pr
        LEFT JOIN users u ON pr.user_id = u.id
        LEFT JOIN departments d ON pr.department_id = d.id
        WHERE pr.id = $1
      `, [id])
      if (prRes.rows.length === 0) return null

      const itemsRes = await getPool()!.query(`SELECT * FROM pr_items WHERE pr_id = $1 ORDER BY id ASC`, [id])
      const rfqRes = await getPool()!.query(`SELECT id, rfq_number, status, deadline FROM rfqs WHERE pr_id = $1`, [id])

      return {
        ...prRes.rows[0],
        items: itemsRes.rows,
        rfq: rfqRes.rows[0] || null,
      }
    }

    const pr = memoryStore.purchase_requests.find(pr => pr.id === id)
    if (!pr) return null
    const u = memoryStore.users.find(u => u.id === pr.user_id)
    const d = memoryStore.departments.find(d => d.id === pr.department_id)
    const items = memoryStore.pr_items.filter(item => item.pr_id === pr.id)
    const rfq = memoryStore.rfqs.find(r => r.pr_id === pr.id)

    return {
      ...pr,
      employee_name: u?.name || 'Unknown',
      employee_email: u?.email || '',
      department_name: d?.name || 'General',
      items,
      rfq: rfq ? { id: rfq.id, rfq_number: rfq.rfq_number, status: rfq.status, deadline: rfq.deadline } : null,
    }
  }

  static async createPurchaseRequest(data: Record<string, any>, user: LoggedUser) {
    return workflow.createRequest(data, user, this)
  }

  static async updatePurchaseRequestStatus(id: number, status: string, remarks: string | undefined, user: LoggedUser) {
    return workflow.decideRequest(id, status, remarks, user, this)
  }

  static async getRfqs(filters?: { vendorId?: number; status?: string }) {
    const rfqs = await this.loadRfqs(filters)
    return Promise.all(rfqs.map(async row => {
      const details = await this.getRfqById(row.id)
      const request = details ? await this.getPurchaseRequestById(details.pr_id) : null
      return { ...row, deadline: workflowDate(row.deadline, 'Bidding deadline'), department_id: request?.department_id, has_recommendation: Boolean(details?.quotations?.some((quote: any) => quote.is_recommended && quote.status === 'recommended')) }
    }))
  }

  static async loadRfqs(filters?: { vendorId?: number; status?: string }) {
    if (isPostgresActive()) {
      let query = `
        SELECT r.*, pr.pr_number, pr.purpose as pr_purpose, u.name as created_by_name,
               (SELECT COUNT(*) FROM rfq_vendors WHERE rfq_id = r.id) as invited_vendor_count,
               (SELECT COUNT(*) FROM quotations WHERE rfq_id = r.id) as quotation_count
        FROM rfqs r
        LEFT JOIN purchase_requests pr ON r.pr_id = pr.id
        LEFT JOIN users u ON r.created_by = u.id
        WHERE 1=1
      `
      const params: any[] = []
      let idx = 1
      if (filters?.vendorId) {
        query += ` AND EXISTS (SELECT 1 FROM rfq_vendors rv WHERE rv.rfq_id = r.id AND rv.vendor_id = $${idx++})`
        params.push(filters.vendorId)
      }
      if (filters?.status && filters.status !== 'all') {
        query += ` AND r.status = $${idx++}`
        params.push(filters.status)
      }
      query += ` ORDER BY r.id DESC`

      const res = await getPool()!.query(query, params)
      if (!filters?.vendorId || res.rows.length === 0) return res.rows
      const bids = await getPool()!.query(
        'SELECT DISTINCT rfq_id FROM quotations WHERE vendor_id = $1 AND rfq_id = ANY($2::int[])',
        [filters.vendorId, res.rows.map(row => row.id)]
      )
      const submittedIds = new Set(bids.rows.map(row => row.rfq_id))
      return res.rows.map(row => ({ ...row, has_submitted_quotation: submittedIds.has(row.id) }))
    }

    return memoryStore.rfqs
      .filter(rfq => {
        if (filters?.vendorId) {
          const isInvited = memoryStore.rfq_vendors.some(rv => rv.rfq_id === rfq.id && rv.vendor_id === filters.vendorId)
          if (!isInvited) return false
        }
        if (filters?.status && filters.status !== 'all' && rfq.status !== filters.status) return false
        return true
      })
      .map(rfq => {
        const pr = memoryStore.purchase_requests.find(p => p.id === rfq.pr_id)
        const u = memoryStore.users.find(u => u.id === rfq.created_by)
        const invited = memoryStore.rfq_vendors.filter(rv => rv.rfq_id === rfq.id).length
        const quoteCount = memoryStore.quotations.filter(q => q.rfq_id === rfq.id).length
        return {
          ...rfq,
          pr_number: pr?.pr_number || 'N/A',
          pr_purpose: pr?.purpose || '',
          created_by_name: u?.name || 'Procurement',
          invited_vendor_count: invited,
          quotation_count: quoteCount,
          has_submitted_quotation: filters?.vendorId ? memoryStore.quotations.some(q => q.rfq_id === rfq.id && q.vendor_id === filters.vendorId) : false,
        }
      })
      .sort((a, b) => b.id - a.id)
  }

  static async getRfqById(id: number) {
    if (isPostgresActive()) {
      const rfqRes = await getPool()!.query(`
        SELECT r.*, pr.pr_number, pr.purpose as pr_purpose, pr.priority as pr_priority, u.name as created_by_name
        FROM rfqs r
        LEFT JOIN purchase_requests pr ON r.pr_id = pr.id
        LEFT JOIN users u ON r.created_by = u.id
        WHERE r.id = $1
      `, [id])
      if (rfqRes.rows.length === 0) return null

      const rfq = rfqRes.rows[0]
      const itemsRes = await getPool()!.query(`SELECT * FROM pr_items WHERE pr_id = $1`, [rfq.pr_id])
      const vendorsRes = await getPool()!.query(`
        SELECT v.*, rv.invited_at
        FROM rfq_vendors rv
        JOIN vendors v ON rv.vendor_id = v.id
        WHERE rv.rfq_id = $1
      `, [id])
      const quotesRes = await getPool()!.query(`
        SELECT q.*, v.name as vendor_name, v.vendor_code, v.rating as vendor_rating
        FROM quotations q
        JOIN vendors v ON q.vendor_id = v.id
        WHERE q.rfq_id = $1
        ORDER BY q.final_amount ASC
      `, [id])

      return {
        ...rfq,
        items: itemsRes.rows,
        invited_vendors: vendorsRes.rows,
        quotations: quotesRes.rows,
      }
    }

    const rfq = memoryStore.rfqs.find(r => r.id === id)
    if (!rfq) return null
    const pr = memoryStore.purchase_requests.find(p => p.id === rfq.pr_id)
    const u = memoryStore.users.find(u => u.id === rfq.created_by)
    const items = memoryStore.pr_items.filter(i => i.pr_id === rfq.pr_id)
    const invitedVendors = memoryStore.rfq_vendors
      .filter(rv => rv.rfq_id === id)
      .map(rv => {
        const v = memoryStore.vendors.find(v => v.id === rv.vendor_id)
        return { ...v, invited_at: rv.invited_at }
      })
    const quotations = memoryStore.quotations
      .filter(q => q.rfq_id === id)
      .map(q => {
        const v = memoryStore.vendors.find(v => v.id === q.vendor_id)
        return {
          ...q,
          vendor_name: v?.name || 'Vendor',
          vendor_code: v?.vendor_code || '',
          vendor_rating: v?.rating || 4.5,
        }
      })
      .sort((a, b) => Number(a.final_amount) - Number(b.final_amount))

    return {
      ...rfq,
      pr_number: pr?.pr_number || 'N/A',
      pr_purpose: pr?.purpose || '',
      pr_priority: pr?.priority || 'medium',
      created_by_name: u?.name || 'Procurement',
      items,
      invited_vendors: invitedVendors,
      quotations,
    }
  }

  static async createRfq(data: Record<string, any>, user: LoggedUser) {
    return workflow.publishRfq(data, user, this)
  }

  static async submitQuotation(data: Record<string, any>, user: LoggedUser) {
    return workflow.submitQuote(data, user, this)
  }

  static async recommendQuotation(id: number, reason: string, user: LoggedUser) {
    return workflow.recommendQuote(id, reason, user, this)
  }

  static async returnVendorRecommendation(id: number, reason: string, user: LoggedUser) {
    return workflow.sendBackRecommendation(id, reason, user, this)
  }

  static async getPurchaseOrders(filters?: { vendorId?: number; status?: string }) {
    const orders = await this.loadPurchaseOrders(filters)
    const detailed = await Promise.all(orders.map(order => this.getPurchaseOrderById(order.id)))
    return detailed.filter((order): order is NonNullable<typeof order> => order !== null)
  }

  static async loadPurchaseOrders(filters?: { vendorId?: number; status?: string }) {
    if (isPostgresActive()) {
      let query = `
        SELECT po.*, v.name as vendor_name, v.vendor_code, v.email as vendor_email,
               rfq.rfq_number, pr.pr_number, pr.purpose as pr_purpose,
               (SELECT COUNT(*) FROM goods_receipts WHERE po_id = po.id) as grn_count,
               (SELECT COUNT(*) FROM invoices WHERE po_id = po.id) as invoice_count
        FROM purchase_orders po
        JOIN vendors v ON po.vendor_id = v.id
        LEFT JOIN rfqs rfq ON po.rfq_id = rfq.id
        LEFT JOIN purchase_requests pr ON po.pr_id = pr.id
        WHERE 1=1
      `
      const params: any[] = []
      let idx = 1
      if (filters?.vendorId) {
        query += ` AND po.vendor_id = $${idx++}`
        params.push(filters.vendorId)
      }
      if (filters?.status && filters.status !== 'all') {
        query += ` AND po.status = $${idx++}`
        params.push(filters.status)
      }
      query += ` ORDER BY po.id DESC`

      const res = await getPool()!.query(query, params)
      return res.rows
    }

    return memoryStore.purchase_orders
      .filter(po => {
        if (filters?.vendorId && po.vendor_id !== filters.vendorId) return false
        if (filters?.status && filters.status !== 'all' && po.status !== filters.status) return false
        return true
      })
      .map(po => {
        const v = memoryStore.vendors.find(v => v.id === po.vendor_id)
        const rfq = memoryStore.rfqs.find(r => r.id === po.rfq_id)
        const pr = memoryStore.purchase_requests.find(p => p.id === po.pr_id)
        const grnCount = memoryStore.goods_receipts.filter(g => g.po_id === po.id).length
        const invoiceCount = memoryStore.invoices.filter(i => i.po_id === po.id).length

        return {
          ...po,
          vendor_name: v?.name || 'Vendor',
          vendor_code: v?.vendor_code || '',
          vendor_email: v?.email || '',
          rfq_number: rfq?.rfq_number || 'N/A',
          pr_number: pr?.pr_number || 'N/A',
          pr_purpose: pr?.purpose || '',
          grn_count: grnCount,
          invoice_count: invoiceCount,
        }
      })
      .sort((a, b) => b.id - a.id)
  }

  static async getPurchaseOrderById(id: number) {
    const po: any = await this.loadPurchaseOrderById(id)
    if (!po) return null
    const quote = po.quote_id ? await atomicWorkflow(store => store.find('quotations', po.quote_id)) : undefined
    const items: ReturnType<typeof receiptProgress> = receiptProgress(po.items || [], po.goods_receipts || []).map(item => {
      const agreed = quote?.line_items?.find((line: any) => line.pr_item_id === item.id)
      const legacySingleItem = !agreed && (po.items || []).length === 1 && quote
      return { ...item,
        quoted_unit_price: agreed ? Number(agreed.unit_price) : legacySingleItem ? Number(quote.unit_price) : null,
        quoted_subtotal: agreed ? Number(agreed.subtotal) : legacySingleItem ? Number(quote.subtotal) : null,
      }
    })
    const request = po.pr_id ? await this.getPurchaseRequestById(po.pr_id) : null
    const invoices = (await this.getInvoices()).filter(invoice => invoice.po_id === id)
    return {
      ...po, items, invoices, department_id: request?.department_id,
      quotation: quote ? { quote_number: quote.quote_number, subtotal: Number(quote.subtotal), tax_amount: Number(quote.tax_amount), discount_amount: Number(quote.discount_amount), final_amount: Number(quote.final_amount), warranty_years: Number(quote.warranty_years), delivery_days: Number(quote.delivery_days) } : null,
      ordered_qty: items.reduce((sum, item) => sum + Number(item.quantity), 0),
      accepted_qty: items.reduce((sum, item) => sum + item.accepted_qty, 0),
      remaining_qty: items.reduce((sum, item) => sum + item.remaining_qty, 0),
      invoice_submitted: invoices.length > 0,
    }
  }

  static async loadPurchaseOrderById(id: number) {
    if (isPostgresActive()) {
      const poRes = await getPool()!.query(`
        SELECT po.*, v.name as vendor_name, v.vendor_code, v.email as vendor_email, v.phone as vendor_phone, v.address as vendor_address, v.gst_number,
               rfq.rfq_number, pr.pr_number, pr.purpose as pr_purpose, q.quote_number, q.delivery_days, q.warranty_years
        FROM purchase_orders po
        JOIN vendors v ON po.vendor_id = v.id
        LEFT JOIN rfqs rfq ON po.rfq_id = rfq.id
        LEFT JOIN purchase_requests pr ON po.pr_id = pr.id
        LEFT JOIN quotations q ON po.quote_id = q.id
        WHERE po.id = $1
      `, [id])
      if (poRes.rows.length === 0) return null

      const po = poRes.rows[0]
      const itemsRes = await getPool()!.query(`SELECT * FROM pr_items WHERE pr_id = $1`, [po.pr_id])
      const grnRes = await getPool()!.query(`SELECT * FROM goods_receipts WHERE po_id = $1 ORDER BY id DESC`, [id])
      const invRes = await getPool()!.query(`SELECT * FROM invoices WHERE po_id = $1 ORDER BY id DESC`, [id])

      return {
        ...po,
        items: itemsRes.rows,
        goods_receipts: grnRes.rows,
        invoices: invRes.rows,
      }
    }

    const po = memoryStore.purchase_orders.find(p => p.id === id)
    if (!po) return null
    const v = memoryStore.vendors.find(v => v.id === po.vendor_id)
    const rfq = memoryStore.rfqs.find(r => r.id === po.rfq_id)
    const pr = memoryStore.purchase_requests.find(p => p.id === po.pr_id)
    const q = memoryStore.quotations.find(q => q.id === po.quote_id)
    const items = memoryStore.pr_items.filter(i => i.pr_id === po.pr_id)
    const goodsReceipts = memoryStore.goods_receipts.filter(g => g.po_id === id)
    const invoices = memoryStore.invoices.filter(i => i.po_id === id)

    return {
      ...po,
      vendor_name: v?.name || 'Vendor',
      vendor_code: v?.vendor_code || '',
      vendor_email: v?.email || '',
      vendor_phone: v?.phone || '',
      vendor_address: v?.address || '',
      gst_number: v?.gst_number || '',
      rfq_number: rfq?.rfq_number || 'N/A',
      pr_number: pr?.pr_number || 'N/A',
      pr_purpose: pr?.purpose || '',
      quote_number: q?.quote_number || 'N/A',
      delivery_days: q?.delivery_days || 7,
      warranty_years: q?.warranty_years || 1,
      items,
      goods_receipts: goodsReceipts,
      invoices,
    }
  }

  static async createPurchaseOrderFromQuotation(data: Record<string, any>, user: LoggedUser) {
    return workflow.approvePo(data, user, this)
  }

  static async updatePurchaseOrderStatus(id: number, data: Record<string, any>, user: LoggedUser) {
    return workflow.updatePo(id, data, user, this)
  }

  static async createGoodsReceipt(data: Record<string, any>, user: LoggedUser) {
    return workflow.recordReceipt(data, user, this)
  }

  static async getInvoices(filters?: { vendorId?: number; status?: string }) {
    if (isPostgresActive()) {
      let query = `
        SELECT inv.*, v.name as vendor_name, v.vendor_code, po.po_number,
               (SELECT json_build_object('payment_ref', p.payment_ref, 'payment_date', p.payment_date, 'amount', p.amount, 'status', p.status)
                FROM payments p WHERE p.invoice_id = inv.id LIMIT 1) as payment
        FROM invoices inv
        JOIN vendors v ON inv.vendor_id = v.id
        JOIN purchase_orders po ON inv.po_id = po.id
        WHERE 1=1
      `
      const params: any[] = []
      let idx = 1
      if (filters?.vendorId) {
        query += ` AND inv.vendor_id = $${idx++}`
        params.push(filters.vendorId)
      }
      if (filters?.status && filters.status !== 'all') {
        query += ` AND inv.status = $${idx++}`
        params.push(filters.status)
      }
      query += ` ORDER BY inv.id DESC`

      const res = await getPool()!.query(query, params)
      return res.rows
    }

    return memoryStore.invoices
      .filter(inv => {
        if (filters?.vendorId && inv.vendor_id !== filters.vendorId) return false
        if (filters?.status && filters.status !== 'all' && inv.status !== filters.status) return false
        return true
      })
      .map(inv => {
        const v = memoryStore.vendors.find(v => v.id === inv.vendor_id)
        const po = memoryStore.purchase_orders.find(p => p.id === inv.po_id)
        const pay = memoryStore.payments.find(p => p.invoice_id === inv.id)
        return {
          ...inv,
          vendor_name: v?.name || 'Vendor',
          vendor_code: v?.vendor_code || '',
          po_number: po?.po_number || 'N/A',
          payment: pay ? { payment_ref: pay.payment_ref, payment_date: pay.payment_date, amount: pay.amount, status: pay.status } : null,
        }
      })
      .sort((a, b) => b.id - a.id)
  }

  static async submitInvoice(data: Record<string, any>, user: LoggedUser) {
    return workflow.invoicePo(data, user, this)
  }

  static async recordPayment(data: Record<string, any>, user: LoggedUser) {
    return workflow.payInvoice(data, user, this)
  }

  static async getAuditLogs(limit: number = 100) {
    if (isPostgresActive()) {
      const res = await getPool()!.query(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`, [limit])
      return res.rows
    }
    return memoryStore.audit_logs.slice(0, limit)
  }

  // -------------------------------------------------------------
  // ANALYTICS & DASHBOARD METRICS
  // -------------------------------------------------------------
  static async getDashboardAnalytics(user: LoggedUser) {
    if (user.role === 'employee') {
      const myPrs = await this.getPurchaseRequests({ userId: user.id })
      return {
        role: 'employee',
        totalRequests: myPrs.length,
        pendingRequests: myPrs.filter(p => p.status === 'pending').length,
        approvedRequests: myPrs.filter(p => p.status === 'approved' || p.status === 'in_procurement').length,
        rejectedRequests: myPrs.filter(p => p.status === 'rejected').length,
        completedRequests: myPrs.filter(p => p.status === 'completed').length,
        recentRequests: myPrs.slice(0, 5),
      }
    }

    if (user.role === 'manager') {
      ensure(user.department_id, 'Manager department is not configured.', 403)
      const deptPrs = await this.getPurchaseRequests({ departmentId: user.department_id })
      const allQuotes = (await this.getRfqs()).filter(rfq => rfq.department_id === user.department_id && rfq.has_recommendation).length

      const totalDeptSpend = deptPrs.reduce((sum, p) => p.status === 'approved' || p.status === 'completed' || p.status === 'in_procurement' ? sum + Number(p.total_estimated_cost) : sum, 0)

      return {
        role: 'manager',
        requestsAwaitingApproval: deptPrs.filter(p => p.status === 'pending').length,
        approvedThisMonth: deptPrs.filter(p => p.status === 'approved' || p.status === 'completed').length,
        rejectedThisMonth: deptPrs.filter(p => p.status === 'rejected').length,
        totalDepartmentSpending: totalDeptSpend,
        vendorSelectionsAwaitingApproval: allQuotes,
        pendingApprovals: deptPrs.filter(p => p.status === 'pending').slice(0, 5),
      }
    }

    if (user.role === 'procurement_officer') {
      const allPrs = await this.getPurchaseRequests()
      const allRfqs = await this.getRfqs()
      const allPos = await this.getPurchaseOrders()
      const allInvoices = await this.getInvoices()

      const approvedAwaitingProc = allPrs.filter(p => p.status === 'approved' && !allRfqs.some(rfq => rfq.pr_id === p.id)).length
      const openRfqs = allRfqs.filter(r => r.status === 'open' || r.status === 'evaluation').length
      const activePos = allPos.filter(p => !['completed', 'cancelled'].includes(p.status)).length
      const pendingDeliveries = allPos.filter(p => p.status === 'dispatched').length
      const pendingInvoices = allInvoices.filter(i => i.status === 'submitted' || i.status === 'verified').length

      const totalProcurementSpend = allPos.reduce((sum, po) => sum + Number(po.total_amount), 0)

      return {
        role: 'procurement_officer',
        approvedAwaitingProcurement: approvedAwaitingProc,
        openRfqs,
        activeOrders: activePos,
        pendingDeliveries,
        pendingInvoices,
        totalSpend: totalProcurementSpend,
        recentOrders: allPos.slice(0, 5),
        recentRfqs: allRfqs.slice(0, 5),
      }
    }

    if (user.role === 'vendor') {
      const vendor = await this.getVendorByUserId(user.id)
      ensure(vendor, 'Vendor profile not found.', 403)
      const vId = vendor.id
      const myRfqs = await this.getRfqs({ vendorId: vId })
      const myPos = await this.getPurchaseOrders({ vendorId: vId })
      const myInvoices = await this.getInvoices({ vendorId: vId })

      return {
        role: 'vendor',
        vendorInfo: vendor,
        newRfqs: myRfqs.filter(r => ['open', 'evaluation'].includes(r.status) && !r.has_submitted_quotation && r.deadline >= workflowToday()).length,
        activeOrders: myPos.filter(p => !['completed', 'cancelled'].includes(p.status)).length,
        pendingDeliveries: myPos.filter(p => p.status === 'dispatched').length,
        submittedInvoices: myInvoices.length,
        recentOrders: myPos.slice(0, 5),
        openRfqs: myRfqs.slice(0, 5),
      }
    }

    // Admin Dashboard
    const allUsers = await this.getAllUsers()
    const allDepts = await this.getDepartments()
    const allVendors = await this.getVendors()
    const logs = await this.getAuditLogs(10)

    return {
      role: 'admin',
      totalUsers: allUsers.length,
      totalDepartments: allDepts.length,
      activeVendors: allVendors.filter(v => v.status === 'active').length,
      recentActivity: logs,
    }
  }
}
