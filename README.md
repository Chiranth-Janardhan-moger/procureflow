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

## Automated Testing Suite

The backend includes a comprehensive unit, integration, and lifecycle test suite covering all roles, role-based security rules, goods receipt calculations, quotation validations, and treasury settlements.

### Test Execution Commands

```bash
# Run backend test suite (83 tests across 10 suites)
npm test --prefix backend

# Run automated scalability & load benchmark
npm run test:load --prefix backend

# Run distributed load test via k6
k6 run scripts/k6-load-test.js

# Run frontend production build & type check
npm run build --prefix frontend
```

### Test Suite Coverage Summary

- Lifecycle Rules and Role Isolation: 31 tests passing
- Full-Lifecycle End-to-End Procurement Suite: 14 tests passing
- Vendor Security and Credential Hashing: 5 tests passing
- Quotation Calculations and GRN Authoritative Ledger: 6 tests passing
- Single Quotation Per Invited Vendor Constraint: 6 tests passing
- Single RFQ Per Approved Requisition Constraint: 5 tests passing
- Vendor Bid Eligibility and Deadlines: 4 tests passing
- Purchase Requisition Line Cost Computations: 5 tests passing
- Total Coverage: 83 tests passing across 10 suites (0 failures).

## Performance & High-Concurrency Benchmarks

The system was benchmarked under real HTTP load using Autocannon and k6 against both public health endpoints and authenticated JWT business queries (`GET /api/purchase-requests`).

### Empirical Benchmark Results

| Concurrency Tier | Target Endpoint | Throughput | Avg Latency | p50 (Median) | p99 Latency | Max Latency | Success (2xx) | Socket Errors |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 100 Users | GET /api/health | 14,139 req/s | 6.58 ms | 6.0 ms | 19.0 ms | 60.0 ms | 100% (42,407 reqs) | 0 |
| 100 Users | GET /api/purchase-requests (Auth) | 5,086 req/s | 19.15 ms | 18.0 ms | 43.0 ms | 54.0 ms | 100% (15,259 reqs) | 0 |
| 500 Users | GET /api/health | 16,846 req/s | 30.12 ms | 25.0 ms | 72.0 ms | 188.0 ms | 100% (50,539 reqs) | 0 |
| 1,000 Users | GET /api/health | 15,469 req/s | 64.20 ms | 59.0 ms | 325.0 ms | 339.0 ms | 100% (46,412 reqs) | 0 |
| 1,000 Users | GET /api/purchase-requests (Auth) | 4,130 req/s | 236.86 ms | 210.0 ms | 521.0 ms | 548.0 ms | 100% (12,391 reqs) | 0 |
| 1,200 Users | GET /api/health (Stress Peak) | 11,559 req/s | 106.40 ms | 84.0 ms | 613.0 ms | 725.0 ms | 100% (34,678 reqs) | 45 (OS ephemeral port limit) |

### Scalability Roadmap: Scaling to 10k, 100k, and 10 Million Users

- 100 to 1,000 Users: Served directly by a single Node.js process with sub-30ms baseline latency and over 5,000 requests per second.
- 1,000 to 10,000 Users: Deploy in Cluster Mode (PM2 / Node.js cluster) across multiple CPU cores behind an Nginx reverse proxy with connection keep-alive and PgBouncer connection pooling.
- 10,000 to 100,000 Users: Deploy on Kubernetes with Horizontal Pod Autoscaler (HPA) behind an AWS Application Load Balancer / Google Cloud Load Balancer, Redis Cluster for session and read cache, and PostgreSQL read replicas.
- 100,000 to 10,000,000 Users: Global Anycast CDN edge layer (Cloudflare / Akamai) caching static assets and read endpoints with 99%+ edge hit ratio, asynchronous write ingestion via Kafka / AWS SQS message queues, and sharded PostgreSQL / CockroachDB clusters with distributed k6 load testing workers.

## CI/CD Pipeline

The repository includes a GitHub Actions pipeline configured in `.github/workflows/ci-cd.yml` executing on every push and pull request to the `main` branch.

### Pipeline Stages

1. Dependency Security Audit: Scans dependencies for security vulnerabilities.
2. Code Quality & Type Checking: Validates strict TypeScript types across both frontend and backend modules (`frontend/tsconfig.json` and `backend/tsconfig.json`).
3. Integration & E2E Testing: Boots a background test instance of the API server and executes the 14-point procurement lifecycle test suite (`npm test`).
4. Production Build Verification: Compiles optimized static production assets via Vite and TypeScript server output.

## Demo Credentials

For quick evaluation, use the one-click demo role switcher in the application header or log in directly with:

- Employee: rahul@company.com / password123
- Manager: anita@company.com / password123
- Procurement Officer: kiran@company.com / password123
- Vendor: sales@techworld.com / vendor123
- Administrator: admin@company.com / admin123
