export type UserRole = 'employee' | 'manager' | 'procurement_officer' | 'vendor' | 'admin'

export interface User {
  id: number
  employee_id: string
  name: string
  email: string
  role: UserRole
  department_id: number | null
  department_name?: string | null
  phone: string | null
  status: 'active' | 'disabled'
  created_at?: string
}

export interface Department {
  id: number
  code: string
  name: string
  manager_id: number | null
  manager_name?: string | null
}

export interface Category {
  id: number
  name: string
  description?: string
}

export interface Vendor {
  id: number
  vendor_code: string
  name: string
  email: string
  phone: string | null
  contact_person: string | null
  address: string | null
  gst_number: string | null
  category_id: number | null
  category_name?: string | null
  rating: number
  status: 'active' | 'inactive' | 'pending_approval'
  user_id: number | null
}

export interface PRItem {
  quoted_unit_price?: number | null
  quoted_subtotal?: number | null
  id: number
  pr_id: number
  item_name: string
  category: string
  quantity: number
  estimated_unit_price: number
  estimated_total: number
  accepted_qty?: number
  remaining_qty?: number
  specification?: string
}

export type PRStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'in_procurement' | 'completed'

export interface PurchaseRequest {
  id: number
  pr_number: string
  user_id: number
  employee_name?: string
  employee_email?: string
  department_id: number | null
  department_name?: string
  required_date: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  purpose: string
  status: PRStatus
  manager_remarks: string | null
  total_estimated_cost: number
  created_at: string
  updated_at: string
  item_count?: number
  items?: PRItem[]
  rfq?: {
    id: number
    rfq_number: string
    status: string
    deadline: string
  } | null
}

export type RFQStatus = 'draft' | 'open' | 'evaluation' | 'closed' | 'cancelled'

export interface RFQ {
  id: number
  rfq_number: string
  pr_id: number
  pr_number?: string
  pr_purpose?: string
  pr_priority?: string
  title: string
  deadline: string
  expected_delivery_date: string | null
  terms: string | null
  status: RFQStatus
  created_by: number | null
  created_by_name?: string
  created_at: string
  invited_vendor_count?: number
  quotation_count?: number
  has_submitted_quotation?: boolean
  has_recommendation?: boolean
  items?: PRItem[]
  invited_vendors?: Vendor[]
  quotations?: Quotation[]
}

export interface Quotation {
  line_items?: Array<{ pr_item_id: number; item_name: string; quantity: number; unit_price: number; subtotal: number }>
  id: number
  quote_number: string
  rfq_id: number
  vendor_id: number
  vendor_name?: string
  vendor_code?: string
  vendor_rating?: number
  unit_price: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  final_amount: number
  delivery_days: number
  warranty_years: number
  payment_terms: string
  validity_date: string | null
  notes: string | null
  status: 'submitted' | 'recommended' | 'selected' | 'rejected'
  is_recommended: boolean
  recommendation_reason: string | null
  submitted_at: string
}

export type POStatus = 'draft' | 'issued' | 'accepted' | 'processing' | 'dispatched' | 'delivered' | 'completed' | 'cancelled'

export interface PurchaseOrder {
  quotation?: { quote_number: string; subtotal: number; tax_amount: number; discount_amount: number; final_amount: number; warranty_years: number; delivery_days: number } | null
  ordered_qty?: number
  accepted_qty?: number
  remaining_qty?: number
  invoice_submitted?: boolean
  id: number
  po_number: string
  rfq_id: number | null
  rfq_number?: string
  quote_id: number | null
  quote_number?: string
  vendor_id: number
  vendor_name?: string
  vendor_code?: string
  vendor_email?: string
  vendor_phone?: string
  vendor_address?: string
  gst_number?: string
  pr_id: number | null
  pr_number?: string
  pr_purpose?: string
  total_amount: number
  expected_delivery: string
  delivery_address: string
  payment_terms: string
  status: POStatus
  dispatch_date: string | null
  courier_name: string | null
  tracking_ref: string | null
  created_at: string
  items?: PRItem[]
  goods_receipts?: GoodsReceipt[]
  invoices?: Invoice[]
}

export interface GoodsReceipt {
  items?: Array<{ pr_item_id: number; item_name: string; received_qty: number; accepted_qty: number; rejected_qty: number; rejection_reason?: string | null }>
  id: number
  grn_number: string
  po_id: number
  received_date: string
  ordered_qty: number
  received_qty: number
  accepted_qty: number
  rejected_qty: number
  rejection_reason: string | null
  received_by: number | null
  created_at: string
}

export interface Invoice {
  id: number
  invoice_number: string
  po_id: number
  po_number?: string
  vendor_id: number
  vendor_name?: string
  vendor_code?: string
  invoice_date: string
  due_date: string
  amount: number
  status: 'submitted' | 'verified' | 'pending_payment' | 'paid' | 'rejected'
  notes: string | null
  created_at: string
  payment?: {
    payment_ref: string
    payment_date: string
    amount: number
    status: string
  } | null
}

export interface Payment {
  id: number
  payment_ref: string
  invoice_id: number
  amount: number
  payment_date: string
  status: 'paid'
  notes: string | null
  created_at: string
}

export interface Notification {
  id: number
  user_id: number | null
  role: string
  title: string
  message: string
  link: string
  is_read: boolean
  created_at: string
}

export interface AuditLog {
  id: number
  user_id: number | null
  user_name: string | null
  user_role: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: string | null
  ip_address: string | null
  created_at: string
}
