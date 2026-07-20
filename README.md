# PS Industries — Production Management System

Next.js 14 + Firebase authentication with role-based dashboards.

## Features

- Email/password and Google Sign-In via Firebase Auth
- Registration restricted to `@psindustriesindia.in` and `@psindustries.in`
- Roles in Firestore at `/users/{uid}` → `role` field
- httpOnly JWT session cookie (`jose`)
- Middleware protects all routes except auth endpoints
- Role redirects: Admin → `/admin`, Plant Head → `/plant-head`, etc.

## Setup

1. **Install**

```bash
npm install
cp .env.example .env.local
```

2. **Firebase console**

- Create a project and enable **Email/Password** + **Google** auth
- Create a Firestore database
- Create a service account and paste credentials into `.env.local`
- Deploy `firestore.rules` (or paste into the Rules tab)
- Add authorized domains for local (`localhost`) and production

3. **Env**

Fill every value in `.env.local`. `SESSION_SECRET` and `SEED_SECRET` must be long random strings (≥32 chars for `SESSION_SECRET`).

4. **Run**

```bash
npm run dev
```

5. **Seed sample users**

With the dev server running:

```bash
curl -X POST http://localhost:3000/api/auth/seed \
  -H "x-seed-secret: YOUR_SEED_SECRET" \
  -H "Content-Type: application/json"
```

Or: `npm run seed`

### Sample accounts (change passwords before production)

| Email | Role | Password |
|-------|------|----------|
| admin@psindustries.in | admin | Admin@PS2024! |
| plant@psindustriesindia.in | plant_head | Plant@PS2024! |
| accountant@psindustriesindia.in | accountant | Account@PS2024! |
| store@psindustriesindia.in | store_manager | Store@PS2024! |
| production@psindustriesindia.in | production_head | Prod@PS2024! |

## Assigning roles

Admins can assign a role to any registered user:

```bash
curl -X POST http://localhost:3000/api/auth/seed \
  -H "Cookie: ps_session=..." \
  -H "Content-Type: application/json" \
  -d '{"email":"newhire@psindustriesindia.in","role":"store_manager"}'
```

Or edit Firestore: `/users/{uid}` → set `role` and `approved: true`.

## Auth flow

1. User signs in on `/auth/login` (or registers on `/auth/register`)
2. Client gets a Firebase ID token
3. `POST /api/auth/session` verifies the token, loads role from Firestore, sets `ps_session` httpOnly cookie
4. Middleware reads the cookie JWT and enforces route access
5. Logout calls Firebase `signOut` + `POST /api/auth/logout` (clears cookie)

## Project map

```
app/auth/login          Login form
app/auth/register       Register + domain validation
app/api/auth/*          Session, logout, register, seed
lib/firebase.ts         Client Auth helpers
lib/auth.ts             Role utilities (getRole, isAuthorized, canAccess)
lib/session.ts          jose JWT session
middleware.ts           Route protection
```
