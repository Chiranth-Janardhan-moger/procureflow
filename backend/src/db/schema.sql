-- ProcureFlow Database Schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  manager_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('employee', 'manager', 'procurement_officer', 'vendor', 'admin')),
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  phone VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  vendor_code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(50),
  contact_person VARCHAR(100),
  address TEXT,
  gst_number VARCHAR(100),
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  rating NUMERIC(3, 2) DEFAULT 4.5,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending_approval')),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_requests (
  id SERIAL PRIMARY KEY,
  pr_number VARCHAR(50) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  required_date DATE NOT NULL,
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  purpose TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'in_procurement', 'completed')),
  manager_remarks TEXT,
  total_estimated_cost NUMERIC(12, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pr_items (
  id SERIAL PRIMARY KEY,
  pr_id INTEGER REFERENCES purchase_requests(id) ON DELETE CASCADE,
  item_name VARCHAR(150) NOT NULL,
  category VARCHAR(100),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  estimated_unit_price NUMERIC(12, 2) NOT NULL,
  estimated_total NUMERIC(12, 2) NOT NULL,
  specification TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rfqs (
  id SERIAL PRIMARY KEY,
  rfq_number VARCHAR(50) UNIQUE NOT NULL,
  pr_id INTEGER REFERENCES purchase_requests(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  deadline DATE NOT NULL,
  expected_delivery_date DATE,
  terms TEXT,
  status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('draft', 'open', 'evaluation', 'closed', 'cancelled')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rfq_vendors (
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER REFERENCES rfqs(id) ON DELETE CASCADE,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(rfq_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS quotations (
  id SERIAL PRIMARY KEY,
  quote_number VARCHAR(50) UNIQUE NOT NULL,
  rfq_id INTEGER REFERENCES rfqs(id) ON DELETE CASCADE,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  unit_price NUMERIC(12, 2) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  tax_amount NUMERIC(12, 2) DEFAULT 0,
  discount_amount NUMERIC(12, 2) DEFAULT 0,
  final_amount NUMERIC(12, 2) NOT NULL,
  delivery_days INTEGER NOT NULL,
  warranty_years NUMERIC(3, 1) DEFAULT 1,
  payment_terms VARCHAR(100),
  validity_date DATE,
  notes TEXT,
  status VARCHAR(30) DEFAULT 'submitted' CHECK (status IN ('submitted', 'recommended', 'selected', 'rejected')),
  is_recommended BOOLEAN DEFAULT false,
  recommendation_reason TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number VARCHAR(50) UNIQUE NOT NULL,
  rfq_id INTEGER REFERENCES rfqs(id) ON DELETE SET NULL,
  quote_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  pr_id INTEGER REFERENCES purchase_requests(id) ON DELETE SET NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  expected_delivery DATE NOT NULL,
  delivery_address TEXT,
  payment_terms VARCHAR(100),
  status VARCHAR(30) DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'accepted', 'processing', 'dispatched', 'delivered', 'completed', 'cancelled')),
  dispatch_date DATE,
  courier_name VARCHAR(100),
  tracking_ref VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id SERIAL PRIMARY KEY,
  grn_number VARCHAR(50) UNIQUE NOT NULL,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  received_date DATE NOT NULL,
  ordered_qty INTEGER NOT NULL,
  received_qty INTEGER NOT NULL,
  accepted_qty INTEGER NOT NULL,
  rejected_qty INTEGER DEFAULT 0,
  rejection_reason TEXT,
  received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
  vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  status VARCHAR(30) DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'pending_payment', 'paid', 'rejected')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  payment_ref VARCHAR(50) UNIQUE NOT NULL,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  payment_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'failed')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50),
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(100),
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(50),
  details TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
