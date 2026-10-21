import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import {
  initialDepartments,
  initialCategories,
  initialUsers,
  initialVendors,
  initialPurchaseRequests,
  initialPrItems,
  initialRfqs,
  initialRfqVendors,
  initialQuotations,
  initialPurchaseOrders,
  initialGoodsReceipts,
  initialInvoices,
  initialPayments,
  initialNotifications,
  initialAuditLogs,
  DepartmentRow,
  CategoryRow,
  UserRow,
  VendorRow,
  PurchaseRequestRow,
  PrItemRow,
  RfqRow,
  RfqVendorRow,
  QuotationRow,
  PurchaseOrderRow,
  GoodsReceiptRow,
  InvoiceRow,
  PaymentRow,
  NotificationRow,
  AuditLogRow,
} from './seedData.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const { Pool } = pg

export interface DBClient {
  isPostgres: boolean
  query: (text: string, params?: any[]) => Promise<{ rows: any[]; rowCount: number }>
}

let pool: pg.Pool | null = null
let isConnectedToPostgres = false

// In-Memory store for offline/fallback mode
export const memoryStore: {
  departments: DepartmentRow[]
  categories: CategoryRow[]
  users: UserRow[]
  vendors: VendorRow[]
  purchase_requests: PurchaseRequestRow[]
  pr_items: PrItemRow[]
  rfqs: RfqRow[]
  rfq_vendors: RfqVendorRow[]
  quotations: QuotationRow[]
  purchase_orders: PurchaseOrderRow[]
  goods_receipts: GoodsReceiptRow[]
  invoices: InvoiceRow[]
  payments: PaymentRow[]
  notifications: NotificationRow[]
  audit_logs: AuditLogRow[]
} = {
  departments: [...initialDepartments],
  categories: [...initialCategories],
  users: [...initialUsers],
  vendors: [...initialVendors],
  purchase_requests: [...initialPurchaseRequests],
  pr_items: [...initialPrItems],
  rfqs: [...initialRfqs],
  rfq_vendors: [...initialRfqVendors],
  quotations: [...initialQuotations],
  purchase_orders: [...initialPurchaseOrders],
  goods_receipts: [...initialGoodsReceipts],
  invoices: [...initialInvoices],
  payments: [...initialPayments],
  notifications: [...initialNotifications],
  audit_logs: [...initialAuditLogs],
}

export async function initDatabase(): Promise<DBClient> {
  const databaseUrl = process.env.DATABASE_URL?.trim()

  if (databaseUrl && (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://'))) {
    console.log('[ProcureFlow DB] Neon / PostgreSQL URL detected. Attempting connection...')
    try {
      pool = new Pool({
        connectionString: databaseUrl,
        ssl: {
          rejectUnauthorized: false,
        },
        connectionTimeoutMillis: 10000,
      })

      const testRes = await pool.query('SELECT NOW() as now, current_database() as db')
      console.log(`[ProcureFlow DB] Connected to PostgreSQL on Neon! Database: ${testRes.rows[0].db} at ${testRes.rows[0].now}`)
      isConnectedToPostgres = true

      // Initialize Schema
      const schemaPath = path.join(__dirname, 'schema.sql')
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8')
        await pool.query(schemaSql)
        console.log('[ProcureFlow DB] Schema verified and up to date.')
      }

      // Check if seeded
      const userCountRes = await pool.query('SELECT COUNT(*) as cnt FROM users')
      if (parseInt(userCountRes.rows[0].cnt, 10) === 0) {
        console.log('[ProcureFlow DB] Database is empty. Seeding initial enterprise records...')
        await seedPostgres(pool)
        console.log('[ProcureFlow DB] Seeding completed successfully.')
      }

      return {
        isPostgres: true,
        query: async (text: string, params?: any[]) => {
          const res = await pool!.query(text, params)
          return { rows: res.rows, rowCount: res.rowCount ?? 0 }
        },
      }
    } catch (err: any) {
      console.warn(`[ProcureFlow DB] Could not connect to PostgreSQL (${err.message}). Defaulting to local memory repository.`)
      isConnectedToPostgres = false
    }
  } else {
    console.log('[ProcureFlow DB] No DATABASE_URL configured in server/.env.')
    console.log('[ProcureFlow DB] Running in Local Memory Mode with complete demo datasets.')
    console.log('[ProcureFlow DB] To connect your Neon PostgreSQL database, add your connection string to server/.env:')
    console.log('                 DATABASE_URL=postgresql://user:pass@ep-name.region.aws.neon.tech/neondb?sslmode=require\n')
  }

  return {
    isPostgres: false,
    query: async () => ({ rows: [], rowCount: 0 }),
  }
}

async function seedPostgres(client: pg.Pool) {
  // Insert departments
  for (const dept of initialDepartments) {
    await client.query(
      `INSERT INTO departments (id, code, name, manager_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [dept.id, dept.code, dept.name, dept.manager_id]
    )
  }

  // Insert categories
  for (const cat of initialCategories) {
    await client.query(
      `INSERT INTO categories (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [cat.id, cat.name, cat.description]
    )
  }

  // Insert users
  for (const u of initialUsers) {
    await client.query(
      `INSERT INTO users (id, employee_id, name, email, password_hash, role, department_id, phone, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [u.id, u.employee_id, u.name, u.email, u.password_hash, u.role, u.department_id, u.phone, u.status]
    )
  }

  // Insert vendors
  for (const v of initialVendors) {
    await client.query(
      `INSERT INTO vendors (id, vendor_code, name, email, phone, contact_person, address, gst_number, category_id, rating, status, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
      [v.id, v.vendor_code, v.name, v.email, v.phone, v.contact_person, v.address, v.gst_number, v.category_id, v.rating, v.status, v.user_id]
    )
  }

  // Insert PRs
  for (const pr of initialPurchaseRequests) {
    await client.query(
      `INSERT INTO purchase_requests (id, pr_number, user_id, department_id, required_date, priority, purpose, status, manager_remarks, total_estimated_cost)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
      [pr.id, pr.pr_number, pr.user_id, pr.department_id, pr.required_date, pr.priority, pr.purpose, pr.status, pr.manager_remarks, pr.total_estimated_cost]
    )
  }

  // Insert PR Items
  for (const item of initialPrItems) {
    await client.query(
      `INSERT INTO pr_items (id, pr_id, item_name, category, quantity, estimated_unit_price, estimated_total, specification)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
      [item.id, item.pr_id, item.item_name, item.category, item.quantity, item.estimated_unit_price, item.estimated_total, item.specification]
    )
  }

  // Insert RFQs
  for (const rfq of initialRfqs) {
    await client.query(
      `INSERT INTO rfqs (id, rfq_number, pr_id, title, deadline, expected_delivery_date, terms, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [rfq.id, rfq.rfq_number, rfq.pr_id, rfq.title, rfq.deadline, rfq.expected_delivery_date, rfq.terms, rfq.status, rfq.created_by]
    )
  }

  // Insert RFQ Vendors
  for (const rv of initialRfqVendors) {
    await client.query(
      `INSERT INTO rfq_vendors (id, rfq_id, vendor_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [rv.id, rv.rfq_id, rv.vendor_id]
    )
  }

  // Insert Quotations
  for (const q of initialQuotations) {
    await client.query(
      `INSERT INTO quotations (id, quote_number, rfq_id, vendor_id, unit_price, subtotal, tax_amount, discount_amount, final_amount, delivery_days, warranty_years, payment_terms, validity_date, notes, status, is_recommended, recommendation_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) ON CONFLICT (id) DO NOTHING`,
      [q.id, q.quote_number, q.rfq_id, q.vendor_id, q.unit_price, q.subtotal, q.tax_amount, q.discount_amount, q.final_amount, q.delivery_days, q.warranty_years, q.payment_terms, q.validity_date, q.notes, q.status, q.is_recommended, q.recommendation_reason]
    )
  }

  // Insert Purchase Orders
  for (const po of initialPurchaseOrders) {
    await client.query(
      `INSERT INTO purchase_orders (id, po_number, rfq_id, quote_id, vendor_id, pr_id, total_amount, expected_delivery, delivery_address, payment_terms, status, dispatch_date, courier_name, tracking_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (id) DO NOTHING`,
      [po.id, po.po_number, po.rfq_id, po.quote_id, po.vendor_id, po.pr_id, po.total_amount, po.expected_delivery, po.delivery_address, po.payment_terms, po.status, po.dispatch_date, po.courier_name, po.tracking_ref]
    )
  }

  // Insert GRNs
  for (const grn of initialGoodsReceipts) {
    await client.query(
      `INSERT INTO goods_receipts (id, grn_number, po_id, received_date, ordered_qty, received_qty, accepted_qty, rejected_qty, rejection_reason, received_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (id) DO NOTHING`,
      [grn.id, grn.grn_number, grn.po_id, grn.received_date, grn.ordered_qty, grn.received_qty, grn.accepted_qty, grn.rejected_qty, grn.rejection_reason, grn.received_by]
    )
  }

  // Insert Invoices
  for (const inv of initialInvoices) {
    await client.query(
      `INSERT INTO invoices (id, invoice_number, po_id, vendor_id, invoice_date, due_date, amount, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [inv.id, inv.invoice_number, inv.po_id, inv.vendor_id, inv.invoice_date, inv.due_date, inv.amount, inv.status, inv.notes]
    )
  }

  // Insert Payments
  for (const pay of initialPayments) {
    await client.query(
      `INSERT INTO payments (id, payment_ref, invoice_id, amount, payment_date, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
      [pay.id, pay.payment_ref, pay.invoice_id, pay.amount, pay.payment_date, pay.status, pay.notes]
    )
  }

  // Insert Notifications
  for (const n of initialNotifications) {
    await client.query(
      `INSERT INTO notifications (id, user_id, role, title, message, link, is_read)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
      [n.id, n.user_id, n.role, n.title, n.message, n.link, n.is_read]
    )
  }

  // Insert Audit Logs
  for (const log of initialAuditLogs) {
    await client.query(
      `INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (id) DO NOTHING`,
      [log.id, log.user_id, log.user_name, log.user_role, log.action, log.entity_type, log.entity_id, log.details, log.ip_address]
    )
  }

  // Advance sequences
  const tables = ['departments', 'categories', 'users', 'vendors', 'purchase_requests', 'pr_items', 'rfqs', 'rfq_vendors', 'quotations', 'purchase_orders', 'goods_receipts', 'invoices', 'payments', 'notifications', 'audit_logs']
  for (const table of tables) {
    try {
      await client.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(max(id), 1)) FROM ${table}`)
    } catch {
      // Ignore if no sequence
    }
  }
}

export function isPostgresActive(): boolean {
  return isConnectedToPostgres && pool !== null
}

export function getPool(): pg.Pool | null {
  return pool
}
