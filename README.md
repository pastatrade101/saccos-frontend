# SACCOS Frontend

React + TypeScript frontend for the SACCOS backend in the repository root.

## Stack

- React 18
- TypeScript
- Vite
- Material UI
- React Router
- Axios
- Supabase Auth client
- React Hook Form + Zod
- Chart.js

## Environment

Create `frontend/.env` from `frontend/.env.example`.

```bash
cp .env.example .env
```

Required values:

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```

Do not add service-role keys to frontend env.

## Run

```bash
npm install
npm run dev
```

From monorepo root:

```bash
cd frontend
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Docker

Files:

- `frontend/Dockerfile`
- `frontend/docker-compose.yml`
- `frontend/nginx.conf`

Run:

```bash
docker compose build
docker compose up -d
```

## Route Coverage

Public:

- `/`
- `/signin`
- `/service-unavailable`
- `/access-denied`

Account policy:

- `/change-password`

Setup:

- `/setup/tenant`
- `/setup/super-admin`

Operational:

- `/dashboard`
- `/platform/tenants`
- `/platform/plans`
- `/staff-users`
- `/products`
- `/member-applications`
- `/members`
- `/members/import`
- `/cash`
- `/cash-control`
- `/contributions`
- `/dividends`
- `/loans`
- `/loans/:loanId`
- `/follow-ups`
- `/reports`

Auditor:

- `/auditor/exceptions`
- `/auditor/journals`
- `/auditor/journals/:id`
- `/auditor/audit-logs`
- `/auditor/reports`

Member:

- `/portal`

## Role Behavior

- `platform_admin`: tenant and plan management only
- `super_admin`: governance and approval controls
- `branch_manager`: operations coordination and approvals
- `loan_officer`: appraisal and loan workflow operations
- `teller`: cash desk and disbursement execution
- `auditor`: read-only auditor pages
- `member`: portal only

Menu items are hidden by role and plan entitlements; backend authorization remains authoritative.

## Loan Workflow in UI

Implemented in `src/pages/Loans.tsx`:

1. create/submit application
2. appraise (loan officer)
3. approve/reject (branch manager)
4. disburse approved application (loan officer/teller only)
5. repay and review portfolio/details

## Member Import

`/members/import` supports:

- CSV upload
- optional portal account creation
- import summary
- failed rows table + failures CSV
- credentials download URL for generated temporary passwords

Template file:

- `../docs/member-import-template.csv`

## Related Docs

- `../docs/frontend-context.md`
- `../docs/backend-context.md`
- `../docs/api-examples.md`
- `../docs/product-sales-guide.md`
