# ProcureFlow - Enterprise Procurement & Vendor Management System

ProcureFlow is a full-lifecycle procurement management platform designed for enterprise organizations to streamline requisition workflows, manager authorizations, vendor quotation comparisons, purchase order dispatching, goods receipt notes (GRN), and treasury payment tracking.

## Architecture & Technology Stack

- Frontend: React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite
- Backend: Node.js, Express, TypeScript, JWT Authentication, bcryptjs
- Database: PostgreSQL on Neon (Cloud-native serverless PostgreSQL) with connection pooling and local resilient fallback repository
- Deployment: Monorepo with concurrently orchestration, static client serving, and unified API proxying

## System Roles & Access Model

The system enforces role-based access control (RBAC). In accordance with enterprise security practices, public employee self-registration is disabled; accounts are provisioned and maintained by the System Administrator.

1. Employee: Creates purchase requisitions (PR), specifies line items, estimated pricing, technical specs, and tracks progress.
2. Department Manager: Reviews and approves departmental requisitions; evaluates and approves recommended vendor bids.
3. Procurement Officer: Oversees vendor catalog, publishes Requests for Quotation (RFQs), analyzes multi-bid comparison matrices, generates Purchase Orders (POs), and records Goods Receipt Notes (GRN).
4. Vendor: External supplier portal to view tender invitations, submit competitive commercial proposals, accept POs, update carrier tracking references, and submit tax invoices.
5. System Administrator: Provisions users, manages cost center departments and catalog categories, maintains vendor status, and reviews immutable compliance audit logs.

## Procurement Workflow Lifecycle

1. Requisition: Employee initiates Purchase Request (PR) with itemized specifications.
2. Manager Approval: Department manager authorizes budget allocation and remarks.
3. RFQ Publication: Procurement publishes tender and invites certified vendors.
4. Quotation Bidding: Vendors submit line pricing, delivery SLAs, warranties, and payment terms.
5. Comparative Evaluation: Procurement evaluates side-by-side matrices (Lowest Price, Fastest Delivery, Highest Rating) and recommends selection.
6. PO Issuance: Manager confirms recommendation, generating binding Purchase Order.
7. Fulfillment & Dispatch: Vendor accepts PO, updates carrier consignment tracking.
8. Inspection (GRN): Procurement inspects shipment on arrival, recording accepted versus rejected units.
9. Invoicing & Settlement: Vendor submits commercial invoice; corporate treasury records payment reference.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0 (v20+ recommended)
- npm >= 9.0.0

### Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd bea
npm install
npm install --prefix client
npm install --prefix server
```

### Database Configuration (Neon PostgreSQL)

Configure your database connection string in `server/.env`:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key
DATABASE_URL=postgresql://user:password@ep-sample-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

Note: If `DATABASE_URL` is not provided, ProcureFlow automatically runs with an in-memory repository pre-loaded with full enterprise seed data, allowing local demonstration and testing out of the box.

### Development Mode

Run both backend API server and frontend client concurrently:

```bash
npm run dev
```

- Frontend client runs on: http://localhost:5173
- Backend API server runs on: http://localhost:5000
- API Healthcheck: http://localhost:5000/api/health

### Production Build

```bash
npm run build
npm start
```

## Demo Credentials

For quick evaluation, use the one-click demo role switcher in the application header or log in directly with:

- Employee: rahul@company.com / password123
- Manager: anita@company.com / password123
- Procurement Officer: kiran@company.com / password123
- Vendor: sales@techworld.com / vendor123
- Administrator: admin@company.com / admin123
