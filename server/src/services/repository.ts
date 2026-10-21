import { isPostgresActive, getPool, memoryStore } from '../db/index.js'
import bcrypt from 'bcryptjs'

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
      id: Date.now(),
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
      id: Date.now(),
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
        `SELECT * FROM notifications WHERE user_id = $1 OR role = $2 ORDER BY created_at DESC LIMIT 30`,
        [userId, role]
      )
      return res.rows
    }
    return memoryStore.notifications.filter(n => n.user_id === userId || n.role === role).slice(0, 30)
  }

  static async markNotificationRead(id: number) {
    if (isPostgresActive()) {
      await getPool()!.query(`UPDATE notifications SET is_read = true WHERE id = $1`, [id])
      return true
    }
    const item = memoryStore.notifications.find(n => n.id === id)
    if (item) item.is_read = true
    return true
  }

  // -------------------------------------------------------------
  // AUTH & USERS
  // -------------------------------------------------------------
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
    phone?: string
    contact_person?: string
    address?: string
    gst_number?: string
    category_id?: number | null
    rating?: number
  }, user: LoggedUser) {
    const vendorCode = `VND-${String(Math.floor(100 + Math.random() * 900))}`

    // Also auto-create a vendor login account
    const vendorUser = await this.createUser({
      employee_id: vendorCode,
      name: data.name,
      email: data.email,
      password: 'vendor123',
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

  static async createPurchaseRequest(
    data: {
      required_date: string
      priority: string
      purpose: string
      status?: string
      items: Array<{
        item_name: string
        category?: string
        quantity: number
        estimated_unit_price: number
        specification?: string
      }>
    },
    user: LoggedUser
  ) {
    const prNumber = `PR-${String(Math.floor(100 + Math.random() * 900))}`
    const totalEst = data.items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.estimated_unit_price)), 0)
    const initialStatus = data.status || 'pending'
    const now = new Date().toISOString()

    if (isPostgresActive()) {
      const prRes = await getPool()!.query(
        `INSERT INTO purchase_requests (pr_number, user_id, department_id, required_date, priority, purpose, status, total_estimated_cost, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING *`,
        [prNumber, user.id, user.department_id, data.required_date, data.priority || 'medium', data.purpose, initialStatus, totalEst, now]
      )
      const newPr = prRes.rows[0]

      const insertedItems = []
      for (const item of data.items) {
        const itemTotal = Number(item.quantity) * Number(item.estimated_unit_price)
        const itemRes = await getPool()!.query(
          `INSERT INTO pr_items (pr_id, item_name, category, quantity, estimated_unit_price, estimated_total, specification)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [newPr.id, item.item_name, item.category || 'General', item.quantity, item.estimated_unit_price, itemTotal, item.specification || null]
        )
        insertedItems.push(itemRes.rows[0])
      }

      await this.logAction(user, 'CREATE_PURCHASE_REQUEST', 'PURCHASE_REQUEST', prNumber, `Created purchase request ${prNumber} with estimated value ₹${totalEst.toLocaleString('en-IN')}`)
      await this.createNotification(null, 'manager', `New Purchase Request ${prNumber}`, `${user.name} submitted ${prNumber} for approval. Total Est: ₹${totalEst.toLocaleString('en-IN')}`, `/manager/approvals`)

      return { ...newPr, items: insertedItems }
    }

    const newPrId = memoryStore.purchase_requests.length ? Math.max(...memoryStore.purchase_requests.map(p => p.id)) + 1 : 1
    const newPr = {
      id: newPrId,
      pr_number: prNumber,
      user_id: user.id,
      department_id: user.department_id,
      required_date: data.required_date,
      priority: data.priority || 'medium',
      purpose: data.purpose,
      status: initialStatus,
      manager_remarks: null,
      total_estimated_cost: totalEst,
      created_at: now,
      updated_at: now,
    }
    memoryStore.purchase_requests.unshift(newPr)

    const insertedItems = []
    for (const item of data.items) {
      const newItemId = memoryStore.pr_items.length ? Math.max(...memoryStore.pr_items.map(i => i.id)) + 1 : 1
      const itemTotal = Number(item.quantity) * Number(item.estimated_unit_price)
      const itemObj = {
        id: newItemId,
        pr_id: newPrId,
        item_name: item.item_name,
        category: item.category || 'General',
        quantity: Number(item.quantity),
        estimated_unit_price: Number(item.estimated_unit_price),
        estimated_total: itemTotal,
        specification: item.specification || '',
      }
      memoryStore.pr_items.push(itemObj)
      insertedItems.push(itemObj)
    }

    await this.logAction(user, 'CREATE_PURCHASE_REQUEST', 'PURCHASE_REQUEST', prNumber, `Created purchase request ${prNumber} with estimated value ₹${totalEst.toLocaleString('en-IN')}`)
    await this.createNotification(null, 'manager', `New Purchase Request ${prNumber}`, `${user.name} submitted ${prNumber} for approval. Total Est: ₹${totalEst.toLocaleString('en-IN')}`, `/manager/approvals`)

    return { ...newPr, items: insertedItems }
  }

  static async updatePurchaseRequestStatus(
    id: number,
    status: 'approved' | 'rejected' | 'in_procurement' | 'completed',
    remarks: string | undefined,
    user: LoggedUser
  ) {
    const now = new Date().toISOString()
    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `UPDATE purchase_requests
         SET status = $1, manager_remarks = COALESCE($2, manager_remarks), updated_at = $3
         WHERE id = $4
         RETURNING *`,
        [status, remarks || null, now, id]
      )
      const pr = res.rows[0]
      if (pr) {
        await this.logAction(user, `${status.toUpperCase()}_PURCHASE_REQUEST`, 'PURCHASE_REQUEST', pr.pr_number, `Updated status to ${status}. Remarks: ${remarks || 'None'}`)
        await this.createNotification(pr.user_id, 'employee', `Purchase Request ${pr.pr_number} ${status.toUpperCase()}`, `Your request has been ${status} by ${user.name}.`, `/purchase-requests/${pr.id}`)

        if (status === 'approved') {
          await this.createNotification(null, 'procurement_officer', `PR ${pr.pr_number} Approved for Procurement`, `${pr.pr_number} is ready for RFQ creation.`, `/procurement/approved-requests`)
        }
      }
      return pr
    }

    const pr = memoryStore.purchase_requests.find(p => p.id === id)
    if (!pr) return null
    pr.status = status
    if (remarks) pr.manager_remarks = remarks
    pr.updated_at = now

    await this.logAction(user, `${status.toUpperCase()}_PURCHASE_REQUEST`, 'PURCHASE_REQUEST', pr.pr_number, `Updated status to ${status}. Remarks: ${remarks || 'None'}`)
    await this.createNotification(pr.user_id, 'employee', `Purchase Request ${pr.pr_number} ${status.toUpperCase()}`, `Your request has been ${status} by ${user.name}.`, `/purchase-requests/${pr.id}`)

    if (status === 'approved') {
      await this.createNotification(null, 'procurement_officer', `PR ${pr.pr_number} Approved for Procurement`, `${pr.pr_number} is ready for RFQ creation.`, `/procurement/approved-requests`)
    }

    return pr
  }

  // -------------------------------------------------------------
  // RFQS & QUOTATIONS
  // -------------------------------------------------------------
  static async getRfqs(filters?: { vendorId?: number; status?: string }) {
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
      return res.rows
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

  static async createRfq(
    data: {
      pr_id: number
      title: string
      deadline: string
      expected_delivery_date?: string
      terms?: string
      vendor_ids: number[]
    },
    user: LoggedUser
  ) {
    const rfqNumber = `RFQ-${String(Math.floor(200 + Math.random() * 800))}`
    const now = new Date().toISOString()

    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `INSERT INTO rfqs (rfq_number, pr_id, title, deadline, expected_delivery_date, terms, status, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8)
         RETURNING *`,
        [rfqNumber, data.pr_id, data.title, data.deadline, data.expected_delivery_date || null, data.terms || null, user.id, now]
      )
      const newRfq = res.rows[0]

      for (const vId of data.vendor_ids) {
        await getPool()!.query(
          `INSERT INTO rfq_vendors (rfq_id, vendor_id, invited_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [newRfq.id, vId, now]
        )
        // Notify vendor user
        const vendor = await this.getVendorById(vId)
        if (vendor?.user_id) {
          await this.createNotification(vendor.user_id, 'vendor', `Invited to RFQ ${rfqNumber}`, `You have been invited to quote for: ${data.title}. Deadline: ${data.deadline}`, `/vendor/rfqs/${newRfq.id}`)
        }
      }

      // Mark PR as in_procurement
      await getPool()!.query(`UPDATE purchase_requests SET status = 'in_procurement' WHERE id = $1`, [data.pr_id])
      await this.logAction(user, 'CREATE_RFQ', 'RFQ', rfqNumber, `Published RFQ ${rfqNumber} inviting ${data.vendor_ids.length} vendors`)

      return newRfq
    }

    const newId = memoryStore.rfqs.length ? Math.max(...memoryStore.rfqs.map(r => r.id)) + 1 : 1
    const newRfq = {
      id: newId,
      rfq_number: rfqNumber,
      pr_id: data.pr_id,
      title: data.title,
      deadline: data.deadline,
      expected_delivery_date: data.expected_delivery_date || null,
      terms: data.terms || '',
      status: 'open',
      created_by: user.id,
      created_at: now,
    }
    memoryStore.rfqs.unshift(newRfq)

    for (const vId of data.vendor_ids) {
      memoryStore.rfq_vendors.push({
        id: memoryStore.rfq_vendors.length + 1,
        rfq_id: newId,
        vendor_id: vId,
        invited_at: now,
      } as any)

      const vendor = memoryStore.vendors.find(v => v.id === vId)
      if (vendor?.user_id) {
        await this.createNotification(vendor.user_id, 'vendor', `Invited to RFQ ${rfqNumber}`, `You have been invited to quote for: ${data.title}. Deadline: ${data.deadline}`, `/vendor/rfqs/${newId}`)
      }
    }

    const pr = memoryStore.purchase_requests.find(p => p.id === data.pr_id)
    if (pr) pr.status = 'in_procurement'

    await this.logAction(user, 'CREATE_RFQ', 'RFQ', rfqNumber, `Published RFQ ${rfqNumber} inviting ${data.vendor_ids.length} vendors`)
    return newRfq
  }

  static async submitQuotation(
    data: {
      rfq_id: number
      unit_price: number
      subtotal?: number
      tax_amount?: number
      discount_amount?: number
      final_amount?: number
      delivery_days: number
      warranty_years?: number
      payment_terms?: string
      validity_date?: string
      notes?: string
    },
    user: LoggedUser
  ) {
    const vendor = await this.getVendorByUserId(user.id)
    if (!vendor) throw new Error('Vendor profile not found for this account')

    const quoteNumber = `QT-${String(Math.floor(500 + Math.random() * 500))}`
    const rfq = await this.getRfqById(data.rfq_id)
    if (!rfq) throw new Error('RFQ not found')

    const firstItem = rfq.items?.[0]
    const qty = firstItem ? Number(firstItem.quantity) : 1
    const subtotal = data.subtotal || (Number(data.unit_price) * qty)
    const tax = data.tax_amount !== undefined ? Number(data.tax_amount) : Math.round(subtotal * 0.18)
    const discount = Number(data.discount_amount || 0)
    const finalAmount = data.final_amount || (subtotal + tax - discount)
    const now = new Date().toISOString()

    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `INSERT INTO quotations (quote_number, rfq_id, vendor_id, unit_price, subtotal, tax_amount, discount_amount, final_amount, delivery_days, warranty_years, payment_terms, validity_date, notes, status, submitted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'submitted', $14)
         RETURNING *`,
        [quoteNumber, data.rfq_id, vendor.id, data.unit_price, subtotal, tax, discount, finalAmount, data.delivery_days, data.warranty_years || 1, data.payment_terms || 'Net 30 Days', data.validity_date || null, data.notes || null, now]
      )

      await getPool()!.query(`UPDATE rfqs SET status = 'evaluation' WHERE id = $1`, [data.rfq_id])
      await this.logAction(user, 'SUBMIT_QUOTATION', 'QUOTATION', quoteNumber, `Submitted quote ${quoteNumber} for RFQ ${rfq.rfq_number} (Final: ₹${finalAmount.toLocaleString('en-IN')})`)
      await this.createNotification(null, 'procurement_officer', `New Quotation for ${rfq.rfq_number}`, `${vendor.name} submitted quotation ${quoteNumber} (₹${finalAmount.toLocaleString('en-IN')}).`, `/rfqs/${data.rfq_id}/comparison`)

      return res.rows[0]
    }

    const newId = memoryStore.quotations.length ? Math.max(...memoryStore.quotations.map(q => q.id)) + 1 : 1
    const newQuote = {
      id: newId,
      quote_number: quoteNumber,
      rfq_id: data.rfq_id,
      vendor_id: vendor.id,
      unit_price: Number(data.unit_price),
      subtotal,
      tax_amount: tax,
      discount_amount: discount,
      final_amount: finalAmount,
      delivery_days: Number(data.delivery_days),
      warranty_years: Number(data.warranty_years || 1),
      payment_terms: data.payment_terms || 'Net 30 Days',
      validity_date: data.validity_date || null,
      notes: data.notes || '',
      status: 'submitted',
      is_recommended: false,
      recommendation_reason: null,
      submitted_at: now,
    }
    memoryStore.quotations.push(newQuote)

    const rfqObj = memoryStore.rfqs.find(r => r.id === data.rfq_id)
    if (rfqObj) rfqObj.status = 'evaluation'

    await this.logAction(user, 'SUBMIT_QUOTATION', 'QUOTATION', quoteNumber, `Submitted quote ${quoteNumber} for RFQ ${rfq.rfq_number} (Final: ₹${finalAmount.toLocaleString('en-IN')})`)
    await this.createNotification(null, 'procurement_officer', `New Quotation for ${rfq.rfq_number}`, `${vendor.name} submitted quotation ${quoteNumber} (₹${finalAmount.toLocaleString('en-IN')}).`, `/rfqs/${data.rfq_id}/comparison`)

    return newQuote
  }

  static async recommendQuotation(quoteId: number, reason: string, user: LoggedUser) {
    if (isPostgresActive()) {
      // Clear other recommendations for the same RFQ
      const qRes = await getPool()!.query(`SELECT * FROM quotations WHERE id = $1`, [quoteId])
      const quote = qRes.rows[0]
      if (!quote) throw new Error('Quotation not found')

      await getPool()!.query(`UPDATE quotations SET is_recommended = false, recommendation_reason = null WHERE rfq_id = $1`, [quote.rfq_id])
      await getPool()!.query(`UPDATE quotations SET is_recommended = true, recommendation_reason = $1, status = 'recommended' WHERE id = $2`, [reason, quoteId])

      const rfqRes = await getPool()!.query(`SELECT * FROM rfqs WHERE id = $1`, [quote.rfq_id])
      const rfq = rfqRes.rows[0]

      await this.logAction(user, 'RECOMMEND_VENDOR', 'QUOTATION', quote.quote_number, `Recommended quotation ${quote.quote_number} for RFQ ${rfq.rfq_number}. Rationale: ${reason}`)
      await this.createNotification(null, 'manager', `Vendor Recommendation Awaiting Approval`, `Procurement recommended ${quote.quote_number} for ${rfq.rfq_number}. Please review and approve.`, `/manager/vendor-approvals`)

      return true
    }

    const quote = memoryStore.quotations.find(q => q.id === quoteId)
    if (!quote) throw new Error('Quotation not found')

    memoryStore.quotations.filter(q => q.rfq_id === quote.rfq_id).forEach(q => {
      q.is_recommended = false
      q.recommendation_reason = null
    })
    quote.is_recommended = true
    quote.recommendation_reason = reason
    quote.status = 'recommended'

    const rfq = memoryStore.rfqs.find(r => r.id === quote.rfq_id)
    await this.logAction(user, 'RECOMMEND_VENDOR', 'QUOTATION', quote.quote_number, `Recommended quotation ${quote.quote_number} for RFQ ${rfq?.rfq_number}. Rationale: ${reason}`)
    await this.createNotification(null, 'manager', `Vendor Recommendation Awaiting Approval`, `Procurement recommended ${quote.quote_number} for ${rfq?.rfq_number}. Please review and approve.`, `/manager/vendor-approvals`)

    return true
  }

  // -------------------------------------------------------------
  // PURCHASE ORDERS
  // -------------------------------------------------------------
  static async getPurchaseOrders(filters?: { vendorId?: number; status?: string }) {
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

  static async createPurchaseOrderFromQuotation(
    data: {
      quote_id: number
      expected_delivery: string
      delivery_address?: string
      payment_terms?: string
    },
    user: LoggedUser
  ) {
    const poNumber = `PO-${String(Math.floor(300 + Math.random() * 700))}`
    const now = new Date().toISOString()

    if (isPostgresActive()) {
      const qRes = await getPool()!.query(`
        SELECT q.*, r.pr_id, r.rfq_number, v.name as vendor_name, v.user_id as vendor_user_id
        FROM quotations q
        JOIN rfqs r ON q.rfq_id = r.id
        JOIN vendors v ON q.vendor_id = v.id
        WHERE q.id = $1
      `, [data.quote_id])
      const quote = qRes.rows[0]
      if (!quote) throw new Error('Quotation not found')

      const res = await getPool()!.query(
        `INSERT INTO purchase_orders (po_number, rfq_id, quote_id, vendor_id, pr_id, total_amount, expected_delivery, delivery_address, payment_terms, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'issued', $10)
         RETURNING *`,
        [
          poNumber,
          quote.rfq_id,
          quote.id,
          quote.vendor_id,
          quote.pr_id,
          quote.final_amount,
          data.expected_delivery,
          data.delivery_address || 'ProcureFlow Tech Park, Wing B, Level 4 IT Ops, Bengaluru 560100',
          data.payment_terms || quote.payment_terms,
          now,
        ]
      )
      const newPo = res.rows[0]

      // Update RFQ status to closed, Quote to selected
      await getPool()!.query(`UPDATE rfqs SET status = 'closed' WHERE id = $1`, [quote.rfq_id])
      await getPool()!.query(`UPDATE quotations SET status = 'selected' WHERE id = $1`, [quote.id])

      await this.logAction(user, 'GENERATE_PURCHASE_ORDER', 'PURCHASE_ORDER', poNumber, `Created PO ${poNumber} for ${quote.vendor_name} (Amount: ₹${Number(quote.final_amount).toLocaleString('en-IN')})`)
      if (quote.vendor_user_id) {
        await this.createNotification(quote.vendor_user_id, 'vendor', `New Purchase Order ${poNumber} Received`, `You have received PO ${poNumber} for ₹${Number(quote.final_amount).toLocaleString('en-IN')}. Please accept and begin processing.`, `/vendor/orders/${newPo.id}`)
      }

      return newPo
    }

    const quote = memoryStore.quotations.find(q => q.id === data.quote_id)
    if (!quote) throw new Error('Quotation not found')
    const rfq = memoryStore.rfqs.find(r => r.id === quote.rfq_id)
    const vendor = memoryStore.vendors.find(v => v.id === quote.vendor_id)

    const newId = memoryStore.purchase_orders.length ? Math.max(...memoryStore.purchase_orders.map(p => p.id)) + 1 : 1
    const newPo = {
      id: newId,
      po_number: poNumber,
      rfq_id: quote.rfq_id,
      quote_id: quote.id,
      vendor_id: quote.vendor_id,
      pr_id: rfq ? rfq.pr_id : 1,
      total_amount: quote.final_amount,
      expected_delivery: data.expected_delivery,
      delivery_address: data.delivery_address || 'ProcureFlow Tech Park, Wing B, Level 4 IT Ops, Bengaluru 560100',
      payment_terms: data.payment_terms || quote.payment_terms,
      status: 'issued',
      dispatch_date: null,
      courier_name: null,
      tracking_ref: null,
      created_at: now,
    }
    memoryStore.purchase_orders.unshift(newPo)

    if (rfq) rfq.status = 'closed'
    quote.status = 'selected'

    await this.logAction(user, 'GENERATE_PURCHASE_ORDER', 'PURCHASE_ORDER', poNumber, `Created PO ${poNumber} for ${vendor?.name} (Amount: ₹${Number(quote.final_amount).toLocaleString('en-IN')})`)
    if (vendor?.user_id) {
      await this.createNotification(vendor.user_id, 'vendor', `New Purchase Order ${poNumber} Received`, `You have received PO ${poNumber} for ₹${Number(quote.final_amount).toLocaleString('en-IN')}. Please accept and begin processing.`, `/vendor/orders/${newId}`)
    }

    return newPo
  }

  static async updatePurchaseOrderStatus(
    id: number,
    data: {
      status: 'accepted' | 'processing' | 'dispatched' | 'delivered' | 'completed' | 'cancelled'
      dispatch_date?: string
      courier_name?: string
      tracking_ref?: string
    },
    user: LoggedUser
  ) {
    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `UPDATE purchase_orders
         SET status = $1,
             dispatch_date = COALESCE($2, dispatch_date),
             courier_name = COALESCE($3, courier_name),
             tracking_ref = COALESCE($4, tracking_ref)
         WHERE id = $5
         RETURNING *`,
        [data.status, data.dispatch_date || null, data.courier_name || null, data.tracking_ref || null, id]
      )
      const po = res.rows[0]
      if (po) {
        await this.logAction(user, `UPDATE_PO_STATUS`, 'PURCHASE_ORDER', po.po_number, `Updated PO ${po.po_number} status to ${data.status} ${data.tracking_ref ? `(Tracking: ${data.tracking_ref})` : ''}`)
        await this.createNotification(null, 'procurement_officer', `PO ${po.po_number} Status: ${data.status.toUpperCase()}`, `PO ${po.po_number} has been updated to ${data.status} by ${user.name}.`, `/purchase-orders/${po.id}`)
      }
      return po
    }

    const po = memoryStore.purchase_orders.find(p => p.id === id)
    if (!po) return null
    po.status = data.status
    if (data.dispatch_date) po.dispatch_date = data.dispatch_date
    if (data.courier_name) po.courier_name = data.courier_name
    if (data.tracking_ref) po.tracking_ref = data.tracking_ref

    await this.logAction(user, `UPDATE_PO_STATUS`, 'PURCHASE_ORDER', po.po_number, `Updated PO ${po.po_number} status to ${data.status} ${data.tracking_ref ? `(Tracking: ${data.tracking_ref})` : ''}`)
    await this.createNotification(null, 'procurement_officer', `PO ${po.po_number} Status: ${data.status.toUpperCase()}`, `PO ${po.po_number} has been updated to ${data.status} by ${user.name}.`, `/purchase-orders/${po.id}`)

    return po
  }

  // -------------------------------------------------------------
  // GOODS RECEIPT NOTES (GRN)
  // -------------------------------------------------------------
  static async createGoodsReceipt(
    data: {
      po_id: number
      received_date: string
      ordered_qty: number
      received_qty: number
      accepted_qty: number
      rejected_qty?: number
      rejection_reason?: string
    },
    user: LoggedUser
  ) {
    const grnNumber = `GRN-${String(Math.floor(100 + Math.random() * 900))}`
    const now = new Date().toISOString()
    const rejected = Number(data.rejected_qty || 0)

    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `INSERT INTO goods_receipts (grn_number, po_id, received_date, ordered_qty, received_qty, accepted_qty, rejected_qty, rejection_reason, received_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [grnNumber, data.po_id, data.received_date, data.ordered_qty, data.received_qty, data.accepted_qty, rejected, data.rejection_reason || null, user.id, now]
      )
      const grn = res.rows[0]

      // Mark PO as delivered
      await getPool()!.query(`UPDATE purchase_orders SET status = 'delivered' WHERE id = $1`, [data.po_id])

      const poRes = await getPool()!.query(`SELECT po_number, vendor_id FROM purchase_orders WHERE id = $1`, [data.po_id])
      const po = poRes.rows[0]

      await this.logAction(user, 'RECORD_GOODS_RECEIPT', 'GOODS_RECEIPT', grnNumber, `Recorded GRN ${grnNumber} for ${po?.po_number}: ${data.accepted_qty} accepted, ${rejected} rejected`)

      return grn
    }

    const newId = memoryStore.goods_receipts.length ? Math.max(...memoryStore.goods_receipts.map(g => g.id)) + 1 : 1
    const newGrn = {
      id: newId,
      grn_number: grnNumber,
      po_id: data.po_id,
      received_date: data.received_date,
      ordered_qty: Number(data.ordered_qty),
      received_qty: Number(data.received_qty),
      accepted_qty: Number(data.accepted_qty),
      rejected_qty: rejected,
      rejection_reason: data.rejection_reason || null,
      received_by: user.id,
      created_at: now,
    }
    memoryStore.goods_receipts.unshift(newGrn)

    const po = memoryStore.purchase_orders.find(p => p.id === data.po_id)
    if (po) po.status = 'delivered'

    await this.logAction(user, 'RECORD_GOODS_RECEIPT', 'GOODS_RECEIPT', grnNumber, `Recorded GRN ${grnNumber} for ${po?.po_number}: ${data.accepted_qty} accepted, ${rejected} rejected`)
    return newGrn
  }

  // -------------------------------------------------------------
  // INVOICES & PAYMENTS
  // -------------------------------------------------------------
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

  static async submitInvoice(
    data: {
      po_id: number
      invoice_number?: string
      invoice_date: string
      due_date: string
      amount: number
      notes?: string
    },
    user: LoggedUser
  ) {
    const vendor = await this.getVendorByUserId(user.id)
    if (!vendor) throw new Error('Vendor account not found')

    const invNumber = data.invoice_number || `INV-${String(Math.floor(400 + Math.random() * 600))}`
    const now = new Date().toISOString()

    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `INSERT INTO invoices (invoice_number, po_id, vendor_id, invoice_date, due_date, amount, status, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'submitted', $7, $8)
         RETURNING *`,
        [invNumber, data.po_id, vendor.id, data.invoice_date, data.due_date, data.amount, data.notes || null, now]
      )
      const inv = res.rows[0]
      await this.logAction(user, 'SUBMIT_INVOICE', 'INVOICE', invNumber, `Submitted invoice ${invNumber} for amount ₹${Number(data.amount).toLocaleString('en-IN')}`)
      await this.createNotification(null, 'procurement_officer', `New Invoice ${invNumber} Submitted`, `${vendor.name} submitted invoice ${invNumber} for ₹${Number(data.amount).toLocaleString('en-IN')}.`, `/invoices`)
      return inv
    }

    const newId = memoryStore.invoices.length ? Math.max(...memoryStore.invoices.map(i => i.id)) + 1 : 1
    const newInv = {
      id: newId,
      invoice_number: invNumber,
      po_id: data.po_id,
      vendor_id: vendor.id,
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      amount: Number(data.amount),
      status: 'submitted',
      notes: data.notes || null,
      created_at: now,
    }
    memoryStore.invoices.unshift(newInv)

    await this.logAction(user, 'SUBMIT_INVOICE', 'INVOICE', invNumber, `Submitted invoice ${invNumber} for amount ₹${Number(data.amount).toLocaleString('en-IN')}`)
    await this.createNotification(null, 'procurement_officer', `New Invoice ${invNumber} Submitted`, `${vendor.name} submitted invoice ${invNumber} for ₹${Number(data.amount).toLocaleString('en-IN')}.`, `/invoices`)
    return newInv
  }

  static async recordPayment(
    data: {
      invoice_id: number
      amount: number
      payment_date: string
      payment_ref?: string
      notes?: string
    },
    user: LoggedUser
  ) {
    const payRef = data.payment_ref || `PAY-${String(Math.floor(10000 + Math.random() * 90000))}`
    const now = new Date().toISOString()

    if (isPostgresActive()) {
      const res = await getPool()!.query(
        `INSERT INTO payments (payment_ref, invoice_id, amount, payment_date, status, notes, created_at)
         VALUES ($1, $2, $3, $4, 'paid', $5, $6)
         RETURNING *`,
        [payRef, data.invoice_id, data.amount, data.payment_date, data.notes || null, now]
      )
      const pay = res.rows[0]

      // Mark invoice as paid
      await getPool()!.query(`UPDATE invoices SET status = 'paid' WHERE id = $1`, [data.invoice_id])

      // If PO is delivered, also mark PO completed
      const invRes = await getPool()!.query(`SELECT po_id, vendor_id, invoice_number FROM invoices WHERE id = $1`, [data.invoice_id])
      const inv = invRes.rows[0]
      if (inv) {
        await getPool()!.query(`UPDATE purchase_orders SET status = 'completed' WHERE id = $1`, [inv.po_id])
        await this.logAction(user, 'RECORD_PAYMENT', 'PAYMENT', payRef, `Recorded payment ${payRef} of ₹${Number(data.amount).toLocaleString('en-IN')} for invoice ${inv.invoice_number}`)
      }

      return pay
    }

    const newId = memoryStore.payments.length ? Math.max(...memoryStore.payments.map(p => p.id)) + 1 : 1
    const newPay = {
      id: newId,
      payment_ref: payRef,
      invoice_id: data.invoice_id,
      amount: Number(data.amount),
      payment_date: data.payment_date,
      status: 'paid',
      notes: data.notes || null,
      created_at: now,
    }
    memoryStore.payments.unshift(newPay)

    const inv = memoryStore.invoices.find(i => i.id === data.invoice_id)
    if (inv) {
      inv.status = 'paid'
      const po = memoryStore.purchase_orders.find(p => p.id === inv.po_id)
      if (po) po.status = 'completed'
      await this.logAction(user, 'RECORD_PAYMENT', 'PAYMENT', payRef, `Recorded payment ${payRef} of ₹${Number(data.amount).toLocaleString('en-IN')} for invoice ${inv.invoice_number}`)
    }

    return newPay
  }

  // -------------------------------------------------------------
  // AUDIT LOGS
  // -------------------------------------------------------------
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
      const deptPrs = await this.getPurchaseRequests({ departmentId: user.department_id || 1 })
      const allQuotes = isPostgresActive()
        ? (await getPool()!.query(`SELECT COUNT(*) as cnt FROM quotations WHERE is_recommended = true AND status = 'recommended'`).then(r => parseInt(r.rows[0].cnt)))
        : memoryStore.quotations.filter(q => q.is_recommended && q.status === 'recommended').length

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

      const approvedAwaitingProc = allPrs.filter(p => p.status === 'approved').length
      const openRfqs = allRfqs.filter(r => r.status === 'open' || r.status === 'evaluation').length
      const activePos = allPos.filter(p => p.status === 'issued' || p.status === 'processing' || p.status === 'dispatched').length
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
      const vId = vendor?.id || 1
      const myRfqs = await this.getRfqs({ vendorId: vId })
      const myPos = await this.getPurchaseOrders({ vendorId: vId })
      const myInvoices = await this.getInvoices({ vendorId: vId })

      return {
        role: 'vendor',
        vendorInfo: vendor,
        newRfqs: myRfqs.filter(r => r.status === 'open').length,
        activeOrders: myPos.filter(p => p.status === 'issued' || p.status === 'processing' || p.status === 'dispatched').length,
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
