# FieldFlow — Farm Contracting Management

A web application for managing agricultural contracting jobs, work logging, and invoicing. Built with Next.js, Prisma, and PostgreSQL (AWS RDS).

## Quick Start

### Prerequisites
- Node.js 18+ installed
- Your AWS RDS PostgreSQL instance running
- RDS security group allows inbound connections on port 5432 from your IP

### 1. Install dependencies

```bash
cd fieldflow
npm install
```

### 2. Configure your database connection

```bash
cp .env.example .env
```

Edit `.env` and set your RDS connection string:

```
DATABASE_URL="postgresql://fieldflow_admin:YourPassword@your-rds-instance.eu-west-2.rds.amazonaws.com:5432/fieldflow?schema=public"
```

**Important RDS notes:**
- Make sure your RDS instance's security group allows inbound PostgreSQL (port 5432) from your machine's IP
- If using RDS in a private subnet, you'll need a bastion host or VPN
- The database name (`fieldflow` above) must already exist — create it via `psql` or pgAdmin if needed

### 3. Push the schema to your database

```bash
# This creates all the tables matching your existing schema design
npx prisma db push
```

### 4. Seed test data

```bash
npx prisma db seed
```

This creates realistic test data:
- 1 organisation (Henderson Agricultural Services)
- 4 users (1 admin + 3 contractors)
- 5 customers with 13 fields across Surrey/Hampshire
- 10 job types (ploughing, drilling, spraying, combining, etc.)
- 10 machines (tractors, combine, drill, sprayer, etc.)
- 11 jobs (mix of scheduled, in progress, completed)
- 5 work logs
- 2 invoices with line items

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Browse your data with Prisma Studio (optional)

```bash
npx prisma studio
```

Opens a visual database browser at [http://localhost:5555](http://localhost:5555)

---

## API Routes

All routes return `{ success: true, data: ... }` on success.

### Customers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/customers` | List all customers with fields |
| POST | `/api/customers` | Create customer |
| GET | `/api/customers/:id` | Customer detail with jobs & invoices |
| PATCH | `/api/customers/:id` | Update customer |
| DELETE | `/api/customers/:id` | Delete customer |

### Fields
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fields?customerId=1` | List fields (optional filter) |
| POST | `/api/fields` | Create field |
| GET | `/api/fields/:id` | Field detail |
| PATCH | `/api/fields/:id` | Update field |
| DELETE | `/api/fields/:id` | Delete field |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs?status=scheduled&assignedTo=2` | List jobs with filters |
| POST | `/api/jobs` | Create job |
| GET | `/api/jobs/:id` | Job detail with logs |
| PATCH | `/api/jobs/:id` | Update job / change status |
| DELETE | `/api/jobs/:id` | Delete job (and its logs) |

### Job Logs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/job-logs?jobId=1&contractorId=2` | List logs with filters |
| POST | `/api/job-logs` | Log work (auto-updates job to in_progress) |
| PATCH | `/api/job-logs/:id` | Update log |
| DELETE | `/api/job-logs/:id` | Delete log |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List all invoices |
| POST | `/api/invoices` | Generate invoice from job IDs |
| GET | `/api/invoices/:id` | Invoice detail with line items |
| PATCH | `/api/invoices/:id` | Update status (draft→sent→paid) |
| DELETE | `/api/invoices/:id` | Delete invoice |

### Reference Data
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users |
| GET | `/api/job-types` | List job types |
| GET | `/api/machines` | List machines |

### Utilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/seed` | Clear all data (dev only!) |

---

## Project Structure

```
fieldflow/
├── prisma/
│   ├── schema.prisma      # Database schema (matches your ERD)
│   └── seed.ts            # Test data seeder
├── src/
│   ├── app/
│   │   └── api/           # All API routes
│   │       ├── customers/
│   │       ├── fields/
│   │       ├── jobs/
│   │       ├── job-logs/
│   │       ├── job-types/
│   │       ├── machines/
│   │       ├── invoices/
│   │       └── seed/
│   └── lib/
│       ├── db.ts           # Prisma client singleton
│       └── api-helpers.ts  # Response utilities
├── .env.example
├── package.json
└── tsconfig.json
```

## Next Steps

- [ ] Connect the React frontend to these API routes
- [ ] Add NextAuth.js authentication
- [ ] Invoice PDF generation
- [ ] PWA setup for offline mobile use
- [ ] Multi-tenancy for SaaS launch
