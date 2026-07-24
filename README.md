# PS Industries PMS

Production management system for **PS Industries — Greater Noida Plant**.

## Design system

| Token | Value | Usage |
|-------|-------|-------|
| `ps-navy` | `#1e3a8a` | Navbar, table headers, buttons |
| `ps-dark` | `#0f2847` | Sidebar |
| `ps-red` | `#dc2626` | KPI left border, accents |

## Quick start

```bash
cp .env.example .env.local
# Fill Firebase client + Admin + SESSION_SECRET + SEED_SECRET

npm install
npm run dev
```

Seed sample users (requires Admin SDK + running app):

```bash
npm run seed
```

### Sample users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@psindustries.in | admin123 |
| Plant Head | plant@psindustries.in | plant123 |
| Accountant | accountant@psindustries.in | acc123 |
| Store | store@psindustries.in | store123 |
| Production | production@psindustries.in | prod123 |

## Routes

- `/auth/login`, `/auth/register`
- `/dashboard` — admin overview KPIs + tables
- `/dashboard/[role]` — role-specific dashboards
- `/admin/dashboard`
- `/accountant/po-upload`, `/accountant/po-list`
- `/plant-head/approvals`, `/plant-head/material-check`
- `/store/inventory`
- `/production/runs`

## Mock POs

- **BMR** `4400042956-0` — 2 items — ₹13,25,507
- **Kent** `426RM0461` — 2 items — ₹3,90,735
- **Prem** `000612` — 1 item — ₹84,800

## PO APIs (`pages/api`)

- `POST /api/po/upload` — parse PDF (sample name match)
- `POST /api/po/save` — persist to in-memory store
- `POST /api/po/approve` — Plant Head approve
- `POST /api/po/reject` — Plant Head reject
- `GET /api/po/list` — list orders
