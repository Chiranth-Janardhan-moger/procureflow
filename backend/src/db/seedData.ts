import bcrypt from 'bcryptjs'

export const HASHED_PASSWORDS = {
  password123: bcrypt.hashSync('password123', 10),
  admin123: bcrypt.hashSync('admin123', 10),
  vendor123: bcrypt.hashSync('vendor123', 10),
}

export interface DepartmentRow {
  id: number
  code: string
  name: string
  manager_id: number | null
}

export interface CategoryRow {
  id: number
  name: string
  description: string | null
}

export interface UserRow {
  id: number
  employee_id: string
  name: string
  email: string
  password_hash: string
  role: string
  department_id: number | null
  phone: string | null
  status: string
}

export interface VendorRow {
  id: number
  vendor_code: string
  name: string
  email: string
  phone: string | null
  contact_person: string | null
  address: string | null
  gst_number: string | null
  category_id: number | null
  rating: number
  status: string
  user_id: number | null
}

export interface PurchaseRequestRow {
  id: number
  pr_number: string
  user_id: number
  department_id: number | null
  required_date: string
  priority: string
  purpose: string
  status: string
  manager_remarks: string | null
  total_estimated_cost: number
  created_at: string
  updated_at: string
}

export interface PrItemRow {
  id: number
  pr_id: number
  item_name: string
  category: string | null
  quantity: number
  estimated_unit_price: number
  estimated_total: number
  specification: string | null
}

export interface RfqRow {
  id: number
  rfq_number: string
  pr_id: number
  title: string
  deadline: string
  expected_delivery_date: string | null
  terms: string | null
  status: string
  created_by: number | null
  created_at: string
}

export interface RfqVendorRow {
  id: number
  rfq_id: number
  vendor_id: number
  invited_at?: string
}

export interface QuotationRow {
  id: number
  quote_number: string
  rfq_id: number
  vendor_id: number
  unit_price: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  final_amount: number
  delivery_days: number
  warranty_years: number
  payment_terms: string | null
  validity_date: string | null
  notes: string | null
  status: string
  is_recommended: boolean
  recommendation_reason: string | null
  submitted_at: string
}

export interface PurchaseOrderRow {
  id: number
  po_number: string
  rfq_id: number | null
  quote_id: number | null
  vendor_id: number
  pr_id: number | null
  total_amount: number
  expected_delivery: string
  delivery_address: string | null
  payment_terms: string | null
  status: string
  dispatch_date: string | null
  courier_name: string | null
  tracking_ref: string | null
  created_at: string
}

export interface GoodsReceiptRow {
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

export interface InvoiceRow {
  id: number
  invoice_number: string
  po_id: number
  vendor_id: number
  invoice_date: string
  due_date: string
  amount: number
  status: string
  notes: string | null
  created_at: string
}

export interface PaymentRow {
  id: number
  payment_ref: string
  invoice_id: number
  amount: number
  payment_date: string
  status: string
  notes: string | null
  created_at: string
}

export interface NotificationRow {
  id: number
  user_id: number | null
  role: string | null
  title: string
  message: string
  link: string
  is_read: boolean
  created_at: string
}

export interface AuditLogRow {
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

export const initialDepartments: DepartmentRow[] = [
  { id: 1, code: 'IT', name: 'Information Technology', manager_id: 2 },
  { id: 2, code: 'HR', name: 'Human Resources', manager_id: 2 },
  { id: 3, code: 'OPS', name: 'Operations & Facilities', manager_id: 2 },
  { id: 4, code: 'FIN', name: 'Finance & Accounts', manager_id: 2 },
  { id: 5, code: 'PROC', name: 'Procurement & Supply Chain', manager_id: 3 },
]

export const initialCategories: CategoryRow[] = [
  { id: 1, name: 'IT Equipment', description: 'Laptops, monitors, peripherals, servers, and networking gear' },
  { id: 2, name: 'Office Furniture', description: 'Ergonomic chairs, standing desks, conference tables, storage' },
  { id: 3, name: 'Stationery & Consumables', description: 'Paper, pens, desk items, pantry supplies' },
  { id: 4, name: 'Software & Licenses', description: 'Productivity software, cloud services, developer tools' },
  { id: 5, name: 'Facility & Maintenance', description: 'HVAC parts, security hardware, electrical components' },
]

export const initialUsers: UserRow[] = [
  {
    id: 1,
    employee_id: 'EMP001',
    name: 'Rahul Sharma',
    email: 'rahul@company.com',
    password_hash: HASHED_PASSWORDS.password123,
    role: 'employee',
    department_id: 1,
    phone: '+91 98765 43210',
    status: 'active',
  },
  {
    id: 2,
    employee_id: 'EMP002',
    name: 'Anita Roy',
    email: 'anita@company.com',
    password_hash: HASHED_PASSWORDS.password123,
    role: 'manager',
    department_id: 1,
    phone: '+91 98765 43211',
    status: 'active',
  },
  {
    id: 3,
    employee_id: 'EMP003',
    name: 'Kiran Patel',
    email: 'kiran@company.com',
    password_hash: HASHED_PASSWORDS.password123,
    role: 'procurement_officer',
    department_id: 5,
    phone: '+91 98765 43212',
    status: 'active',
  },
  {
    id: 4,
    employee_id: 'EMP004',
    name: 'Priya Nair',
    email: 'admin@company.com',
    password_hash: HASHED_PASSWORDS.admin123,
    role: 'admin',
    department_id: 1,
    phone: '+91 98765 43213',
    status: 'active',
  },
  {
    id: 5,
    employee_id: 'VND001',
    name: 'TechWorld Solutions',
    email: 'sales@techworld.com',
    password_hash: HASHED_PASSWORDS.vendor123,
    role: 'vendor',
    department_id: null,
    phone: '+91 80 2345 6789',
    status: 'active',
  },
  {
    id: 6,
    employee_id: 'VND002',
    name: 'Digital Systems Ltd',
    email: 'contact@digitalsys.com',
    password_hash: HASHED_PASSWORDS.vendor123,
    role: 'vendor',
    department_id: null,
    phone: '+91 80 8765 4321',
    status: 'active',
  },
  {
    id: 7,
    employee_id: 'VND003',
    name: 'CompZone Infotech',
    email: 'bids@compzone.com',
    password_hash: HASHED_PASSWORDS.vendor123,
    role: 'vendor',
    department_id: null,
    phone: '+91 80 5544 3322',
    status: 'active',
  },
  {
    id: 8,
    employee_id: 'VND004',
    name: 'OfficePro Furnishings',
    email: 'hello@officepro.com',
    password_hash: HASHED_PASSWORDS.vendor123,
    role: 'vendor',
    department_id: null,
    phone: '+91 80 9988 7766',
    status: 'active',
  },
]

export const initialVendors: VendorRow[] = [
  {
    id: 1,
    vendor_code: 'VND-001',
    name: 'TechWorld Solutions',
    email: 'sales@techworld.com',
    phone: '+91 80 2345 6789',
    contact_person: 'Rahul Verma',
    address: '42 Electronics City, Phase 1, Bengaluru, Karnataka 560100',
    gst_number: '29ABCDE1234F1Z5',
    category_id: 1,
    rating: 4.6,
    status: 'active',
    user_id: 5,
  },
  {
    id: 2,
    vendor_code: 'VND-002',
    name: 'Digital Systems Ltd',
    email: 'contact@digitalsys.com',
    phone: '+91 80 8765 4321',
    contact_person: 'Vikram Joshi',
    address: '108 Indiranagar 100ft Road, Bengaluru, Karnataka 560038',
    gst_number: '29XYZDE5678F1Z2',
    category_id: 1,
    rating: 4.3,
    status: 'active',
    user_id: 6,
  },
  {
    id: 3,
    vendor_code: 'VND-003',
    name: 'CompZone Infotech',
    email: 'bids@compzone.com',
    phone: '+91 80 5544 3322',
    contact_person: 'Suresh Menon',
    address: '25 SP Road, Commercial Street Area, Bengaluru 560002',
    gst_number: '29LMNOP9012F1Z8',
    category_id: 1,
    rating: 4.1,
    status: 'active',
    user_id: 7,
  },
  {
    id: 4,
    vendor_code: 'VND-004',
    name: 'OfficePro Furnishings',
    email: 'hello@officepro.com',
    phone: '+91 80 9988 7766',
    contact_person: 'Anita Deshmukh',
    address: '77 Bannerghatta Main Road, Bengaluru 560076',
    gst_number: '29QRSTU3456F1Z1',
    category_id: 2,
    rating: 4.2,
    status: 'active',
    user_id: 8,
  },
]

export const initialPurchaseRequests: PurchaseRequestRow[] = [
  {
    id: 1,
    pr_number: 'PR-102',
    user_id: 1,
    department_id: 1,
    required_date: '2026-10-30',
    priority: 'high',
    purpose: 'Equipment required for 10 newly recruited senior backend and cloud developers joining in Q4.',
    status: 'in_procurement',
    manager_remarks: 'Approved. Essential onboarding hardware budget allocated under Tech Headcount 2026.',
    total_estimated_cost: 508000.0,
    created_at: '2026-10-10T09:30:00Z',
    updated_at: '2026-10-10T11:10:00Z',
  },
  {
    id: 2,
    pr_number: 'PR-103',
    user_id: 1,
    department_id: 1,
    required_date: '2026-11-05',
    priority: 'medium',
    purpose: 'Ergonomic high-back mesh chairs for developer desks in Tech Wing B to replace broken seating.',
    status: 'pending',
    manager_remarks: null,
    total_estimated_cost: 185000.0,
    created_at: '2026-10-18T14:15:00Z',
    updated_at: '2026-10-18T14:15:00Z',
  },
  {
    id: 3,
    pr_number: 'PR-095',
    user_id: 1,
    department_id: 1,
    required_date: '2026-09-20',
    priority: 'urgent',
    purpose: 'Replacement 24-Port Gigabit Managed Switches with POE+ for server room redundancy.',
    status: 'completed',
    manager_remarks: 'Approved with priority. Redundancy critical for SOC2 compliance.',
    total_estimated_cost: 145000.0,
    created_at: '2026-09-03T10:00:00Z',
    updated_at: '2026-09-03T12:00:00Z',
  },
]

export const initialPrItems: PrItemRow[] = [
  {
    id: 1,
    pr_id: 1,
    item_name: 'Dell Latitude 7440 Laptops',
    category: 'IT Equipment',
    quantity: 10,
    estimated_unit_price: 50000.0,
    estimated_total: 500000.0,
    specification: 'Intel Core i7 13th Gen, 16GB LPDDR5 RAM, 512GB NVMe SSD, 14-inch FHD Anti-Glare Display, Backlit KB, 3-Yr Onsite Warranty.',
  },
  {
    id: 2,
    pr_id: 1,
    item_name: 'Logitech Wireless Keyboard & Mouse Combo',
    category: 'IT Equipment',
    quantity: 10,
    estimated_unit_price: 800.0,
    estimated_total: 8000.0,
    specification: 'Silent touch keys, 2.4GHz USB nano receiver, battery included.',
  },
  {
    id: 3,
    pr_id: 2,
    item_name: 'Ergonomic High-Back Mesh Chairs',
    category: 'Office Furniture',
    quantity: 15,
    estimated_unit_price: 12333.33,
    estimated_total: 185000.0,
    specification: 'Adjustable lumbar support, 3D armrests, breathable Korean mesh, nylon caster base, 5-year warranty.',
  },
  {
    id: 4,
    pr_id: 3,
    item_name: 'Cisco CBS350 24-Port PoE+ Managed Switch',
    category: 'IT Equipment',
    quantity: 2,
    estimated_unit_price: 72500.0,
    estimated_total: 145000.0,
    specification: '24 x Gigabit Ethernet ports with 195W PoE power budget, 4 x 10G SFP+ uplinks.',
  },
]

export const initialRfqs: RfqRow[] = [
  {
    id: 1,
    rfq_number: 'RFQ-204',
    pr_id: 1,
    title: 'RFQ for 10 Enterprise Dell Latitude Laptops & Peripherals',
    deadline: '2026-10-28',
    expected_delivery_date: '2026-11-04',
    terms: 'Delivery within 10 days of PO issuance. Standard Net 30 payment terms post Goods Receipt Note verification. Vendor must provide 3-year OEM onsite support.',
    status: 'evaluation',
    created_by: 3,
    created_at: '2026-10-12T10:00:00Z',
  },
]

export const initialRfqVendors: RfqVendorRow[] = [
  { id: 1, rfq_id: 1, vendor_id: 1, invited_at: '2026-10-12T10:05:00Z' },
  { id: 2, rfq_id: 1, vendor_id: 2, invited_at: '2026-10-12T10:05:00Z' },
  { id: 3, rfq_id: 1, vendor_id: 3, invited_at: '2026-10-12T10:05:00Z' },
]

export const initialQuotations: QuotationRow[] = [
  {
    id: 1,
    quote_number: 'QT-501',
    rfq_id: 1,
    vendor_id: 1,
    unit_price: 48000.0,
    subtotal: 480000.0,
    tax_amount: 86400.0,
    discount_amount: 0.0,
    final_amount: 566400.0,
    delivery_days: 7,
    warranty_years: 3.0,
    payment_terms: 'Net 30 Days after GRN',
    validity_date: '2026-11-15',
    notes: 'Authorized Dell Platinum Tier Partner. Free express courier delivery and 3-year Next Business Day onsite service included.',
    status: 'recommended',
    is_recommended: true,
    recommendation_reason: 'Balanced pricing with the best 3-year warranty package, 4.6 star vendor rating, and guaranteed 7-day delivery window.',
    submitted_at: '2026-10-15T15:30:00Z',
  },
  {
    id: 2,
    quote_number: 'QT-502',
    rfq_id: 1,
    vendor_id: 2,
    unit_price: 49500.0,
    subtotal: 495000.0,
    tax_amount: 89100.0,
    discount_amount: 5000.0,
    final_amount: 579100.0,
    delivery_days: 5,
    warranty_years: 2.0,
    payment_terms: 'Net 15 Days',
    validity_date: '2026-11-10',
    notes: 'In-stock ready inventory. Fastest dispatch turnaround in 5 business days with direct factory courier.',
    status: 'submitted',
    is_recommended: false,
    recommendation_reason: null,
    submitted_at: '2026-10-16T11:20:00Z',
  },
  {
    id: 3,
    quote_number: 'QT-503',
    rfq_id: 1,
    vendor_id: 3,
    unit_price: 47800.0,
    subtotal: 478000.0,
    tax_amount: 86040.0,
    discount_amount: 2000.0,
    final_amount: 562040.0,
    delivery_days: 12,
    warranty_years: 2.0,
    payment_terms: 'Net 30 Days',
    validity_date: '2026-11-05',
    notes: 'Aggressive pricing model. Lead time is 12 calendar days due to regional warehouse shipment.',
    status: 'submitted',
    is_recommended: false,
    recommendation_reason: null,
    submitted_at: '2026-10-16T16:45:00Z',
  },
]

export const initialPurchaseOrders: PurchaseOrderRow[] = [
  {
    id: 1,
    po_number: 'PO-301',
    rfq_id: 1,
    quote_id: 1,
    vendor_id: 1,
    pr_id: 1,
    total_amount: 566400.0,
    expected_delivery: '2026-10-25',
    delivery_address: 'ProcureFlow Tech Park, Wing B, Level 4 IT Ops, Bengaluru 560100',
    payment_terms: 'Net 30 Days after GRN',
    status: 'dispatched',
    dispatch_date: '2026-10-19',
    courier_name: 'BlueDart Logistics',
    tracking_ref: 'BDX-9821734BLR',
    created_at: '2026-10-17T11:00:00Z',
  },
]

export const initialGoodsReceipts: GoodsReceiptRow[] = [
  {
    id: 1,
    grn_number: 'GRN-101',
    po_id: 1,
    received_date: '2026-10-20',
    ordered_qty: 10,
    received_qty: 10,
    accepted_qty: 9,
    rejected_qty: 1,
    rejection_reason: '1 unit had screen bezel damage during transit. Vendor notified for immediate replacement dispatch.',
    received_by: 3,
    created_at: '2026-10-20T16:00:00Z',
  },
]

export const initialInvoices: InvoiceRow[] = [
  {
    id: 1,
    invoice_number: 'INV-401',
    po_id: 1,
    vendor_id: 1,
    invoice_date: '2026-10-19',
    due_date: '2026-11-18',
    amount: 566400.0,
    status: 'paid',
    notes: 'Invoice for 10 Dell Latitude Laptops delivered under PO-301. Tax invoice with GST compliance.',
    created_at: '2026-10-19T14:00:00Z',
  },
]

export const initialPayments: PaymentRow[] = [
  {
    id: 1,
    payment_ref: 'PAY-92731',
    invoice_id: 1,
    amount: 566400.0,
    payment_date: '2026-10-21',
    status: 'paid',
    notes: 'Electronic NEFT settlement via Corporate Treasury account to TechWorld Solutions.',
    created_at: '2026-10-21T11:30:00Z',
  },
]

export const initialNotifications: NotificationRow[] = [
  {
    id: 1,
    user_id: 1,
    role: 'employee',
    title: 'PR-102 Approved by Manager',
    message: 'Anita Roy has approved your Purchase Request for 10 Dell Laptops. Forwarded to Procurement.',
    link: '/purchase-requests/1',
    is_read: false,
    created_at: '2026-10-10T11:15:00Z',
  },
  {
    id: 2,
    user_id: 3,
    role: 'procurement_officer',
    title: '3 Quotations Received for RFQ-204',
    message: 'All invited vendors (TechWorld, Digital Systems, CompZone) have submitted quotations. Ready for evaluation.',
    link: '/rfqs/1/comparison',
    is_read: false,
    created_at: '2026-10-16T17:00:00Z',
  },
  {
    id: 3,
    user_id: 5,
    role: 'vendor',
    title: 'Purchase Order PO-301 Issued',
    message: 'Congratulations, your quotation was selected. Purchase Order PO-301 for ₹5,66,400 has been issued.',
    link: '/vendor/orders/1',
    is_read: false,
    created_at: '2026-10-17T11:05:00Z',
  },
  {
    id: 4,
    user_id: 3,
    role: 'procurement_officer',
    title: 'PO-301 Dispatched by TechWorld',
    message: 'Shipment dispatched via BlueDart Logistics (Tracking: BDX-9821734BLR). Expected delivery 22 Oct.',
    link: '/purchase-orders/1',
    is_read: false,
    created_at: '2026-10-19T10:30:00Z',
  },
  {
    id: 5,
    user_id: 4,
    role: 'admin',
    title: 'Payment Completed for INV-401',
    message: 'Payment of ₹5,66,400 settled under reference PAY-92731 to TechWorld Solutions.',
    link: '/invoices',
    is_read: true,
    created_at: '2026-10-21T11:35:00Z',
  },
]

export const initialAuditLogs: AuditLogRow[] = [
  {
    id: 1,
    user_id: 1,
    user_name: 'Rahul Sharma',
    user_role: 'employee',
    action: 'CREATE_PURCHASE_REQUEST',
    entity_type: 'PURCHASE_REQUEST',
    entity_id: 'PR-102',
    details: 'Created PR-102 for 10 Dell Latitude Laptops (Est: ₹5,08,000)',
    ip_address: '192.168.1.45',
    created_at: '2026-10-10T09:30:00Z',
  },
  {
    id: 2,
    user_id: 2,
    user_name: 'Anita Roy',
    user_role: 'manager',
    action: 'APPROVE_PURCHASE_REQUEST',
    entity_type: 'PURCHASE_REQUEST',
    entity_id: 'PR-102',
    details: 'Approved PR-102 with remarks: "Essential onboarding hardware budget allocated"',
    ip_address: '192.168.1.12',
    created_at: '2026-10-10T11:10:00Z',
  },
  {
    id: 3,
    user_id: 3,
    user_name: 'Kiran Patel',
    user_role: 'procurement_officer',
    action: 'CREATE_RFQ',
    entity_type: 'RFQ',
    entity_id: 'RFQ-204',
    details: 'Published RFQ-204 inviting 3 verified vendors (TechWorld, Digital Systems, CompZone)',
    ip_address: '192.168.1.88',
    created_at: '2026-10-12T10:00:00Z',
  },
  {
    id: 4,
    user_id: 5,
    user_name: 'TechWorld Solutions',
    user_role: 'vendor',
    action: 'SUBMIT_QUOTATION',
    entity_type: 'QUOTATION',
    entity_id: 'QT-501',
    details: 'Submitted quotation for ₹5,66,400 with 3-year warranty and 7-day lead time',
    ip_address: '103.21.54.12',
    created_at: '2026-10-15T15:30:00Z',
  },
  {
    id: 5,
    user_id: 3,
    user_name: 'Kiran Patel',
    user_role: 'procurement_officer',
    action: 'RECOMMEND_VENDOR',
    entity_type: 'QUOTATION',
    entity_id: 'QT-501',
    details: 'Recommended TechWorld Solutions (QT-501) for RFQ-204 based on 3-yr warranty and 4.6 rating',
    ip_address: '192.168.1.88',
    created_at: '2026-10-17T09:45:00Z',
  },
  {
    id: 6,
    user_id: 2,
    user_name: 'Anita Roy',
    user_role: 'manager',
    action: 'APPROVE_VENDOR_SELECTION',
    entity_type: 'RFQ',
    entity_id: 'RFQ-204',
    details: 'Approved selection of TechWorld Solutions for PR-102 procurement',
    ip_address: '192.168.1.12',
    created_at: '2026-10-17T10:30:00Z',
  },
  {
    id: 7,
    user_id: 3,
    user_name: 'Kiran Patel',
    user_role: 'procurement_officer',
    action: 'GENERATE_PURCHASE_ORDER',
    entity_type: 'PURCHASE_ORDER',
    entity_id: 'PO-301',
    details: 'Generated Purchase Order PO-301 for TechWorld Solutions (Total: ₹5,66,400)',
    ip_address: '192.168.1.88',
    created_at: '2026-10-17T11:00:00Z',
  },
  {
    id: 8,
    user_id: 5,
    user_name: 'TechWorld Solutions',
    user_role: 'vendor',
    action: 'DISPATCH_PURCHASE_ORDER',
    entity_type: 'PURCHASE_ORDER',
    entity_id: 'PO-301',
    details: 'Dispatched order via BlueDart Logistics tracking BDX-9821734BLR',
    ip_address: '103.21.54.12',
    created_at: '2026-10-19T10:15:00Z',
  },
  {
    id: 9,
    user_id: 3,
    user_name: 'Kiran Patel',
    user_role: 'procurement_officer',
    action: 'RECORD_GOODS_RECEIPT',
    entity_type: 'GOODS_RECEIPT',
    entity_id: 'GRN-101',
    details: 'Inspected shipment: 9 units accepted, 1 unit rejected for transport bezel damage',
    ip_address: '192.168.1.88',
    created_at: '2026-10-20T16:00:00Z',
  },
  {
    id: 10,
    user_id: 4,
    user_name: 'Priya Nair',
    user_role: 'admin',
    action: 'RECORD_PAYMENT',
    entity_type: 'PAYMENT',
    entity_id: 'PAY-92731',
    details: 'Processed payment of ₹5,66,400 for INV-401 via NEFT corporate clearing',
    ip_address: '192.168.1.5',
    created_at: '2026-10-21T11:30:00Z',
  },
]
