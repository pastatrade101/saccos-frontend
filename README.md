# SACCOS Frontend

React + TypeScript frontend for the client-specific SACCOS deployment.

The application still carries some compatibility types and helpers from the earlier SaaS version of the system, but the active route surface is a single client workspace rather than a self-service multi-tenant platform.

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

From the monorepo root:

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

## Production Deploy

Vite reads `VITE_*` variables at build time. If they are missing during build, the app will fail at runtime.

```bash
cp .env.production.example .env
docker compose build --no-cache frontend
docker compose up -d frontend
docker compose logs -f frontend
```

## Route Coverage

Public:

- `/`
- `/signin`
- `/signup`
- `/reset-password`
- `/privacy-policy`
- `/terms-and-agreement`
- `/service-unavailable`
- `/access-denied`

Account policy:

- `/change-password`

Setup:

- `/setup/super-admin`

Operational workspace:

- `/dashboard`
- `/staff-users`
- `/products`
- `/member-applications`
- `/members`
- `/members/import`
- `/contributions`
- `/savings`
- `/payments`
- `/cash`
- `/cash-control`
- `/dividends`
- `/follow-ups`
- `/approvals`
- `/loans`
- `/loans/:loanId`
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

- `super_admin`: governance and approval controls
- `branch_manager`: staff, members, products, contributions, dividends, and operational oversight
- `loan_officer`: loan appraisal and lending workflow operations
- `teller`: cash desk, disbursement, and repayment execution
- `auditor`: read-only auditor pages
- `member`: portal only

Legacy internal roles such as `platform_admin` may still appear in shared types or compatibility logic, but there are no active platform management pages in the current route map.

## Workspace Status and Compatibility

- The frontend still reads `/api/me/subscription`.
- In the current deployment, that endpoint is treated as workspace status/capability data rather than a public SaaS provisioning surface.
- Some older UI copy still says "subscription" because the underlying backend contracts and types have not been fully renamed.

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
