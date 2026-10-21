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
npm install --prefix frontend
npm install --prefix backend
```

### Database Configuration (Neon PostgreSQL)

Configure your database connection string in `backend/.env`:

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

## CI/CD Pipeline & Automated Testing

The repository includes a GitHub Actions pipeline configured in `.github/workflows/ci-cd.yml` executing on every push and pull request to the `main` branch.

### Pipeline Stages

1. Dependency Security Audit: Scans dependencies for security vulnerabilities.
2. Code Quality & Type Checking: Validates strict TypeScript types across both frontend and backend modules (`client/tsconfig.json` and `server/tsconfig.json`).
3. Integration & E2E Testing: Boots a background test instance of the API server and executes the 14-point procurement lifecycle test suite (`npm test`).
4. Production Build Verification: Compiles optimized static production assets via Vite and TypeScript server output.
5. Vercel Automated Deployment: Deploys verified builds to Vercel production.

## Vercel Deployment

ProcureFlow is pre-configured for Vercel deployment with `vercel.json` and a serverless API handler in `api/index.ts`.

### Deployment Options

1. Automatic Git Integration (Recommended):
   - Import the repository in the Vercel dashboard: https://vercel.com/new/import?s=https://github.com/Chiranth-Janardhan-moger/procureflow
   - Framework Preset: Vite
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `client/dist`
   - Add environment variables in the Vercel project settings (`DATABASE_URL`, `JWT_SECRET`).

2. GitHub Actions Deployment:
   - Configure repository secrets in GitHub:
     - `VERCEL_TOKEN`: Your personal Vercel access token
     - `VERCEL_ORG_ID`: Your Vercel organization ID
     - `VERCEL_PROJECT_ID`: Your Vercel project ID
   - Pushes to `main` will trigger automated deployment via the GitHub Actions workflow.

## Demo Credentials

For quick evaluation, use the one-click demo role switcher in the application header or log in directly with:

- Employee: rahul@company.com / password123
- Manager: anita@company.com / password123
- Procurement Officer: kiran@company.com / password123
- Vendor: sales@techworld.com / vendor123
- Administrator: admin@company.com / admin123
