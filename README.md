# Jasa-in — starter foundation

Starter repository for `jasa-in.my.id`: Next.js App Router + TypeScript, Supabase PostgreSQL/Auth, and a QRIS PHP reference module.

## Requirements
- Current Node.js LTS
- npm
- A Supabase project

## 1. Install dependencies
```bash
npm install
```

## 2. Configure Supabase
1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from Supabase project API settings.
4. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable or browser code.

## 3. Apply the database migration
Open Supabase Dashboard → SQL Editor and run `supabase/migrations/001_initial_schema.sql`.

The migration creates the first marketplace tables and enables RLS. Policies are intentionally not permissive yet; add and test role-specific policies before wiring up catalog or dashboard reads/writes.

## 4. Start development
```bash
npm run dev
```
Open `http://localhost:3000`.

## Current scope
- Minimal landing page and route placeholders in the nav.
- Supabase browser/server client helpers.
- Initial schema for profiles, sellers, services, orders, payments, and reviews.
- Original QRIS transformation functions preserved as reference only.

## Next implementation steps
1. Add tested RLS policies and role elevation workflow.
2. Build auth routes and session refresh/proxy pattern for the installed Next.js version.
3. Build catalog and seller dashboard.
4. Build cart and server-calculated checkout; split checkout into one order per seller.
5. Port QRIS logic to TypeScript and run regression tests against known payloads; keep PHP fallback isolated until parity is proven.
6. Implement payment confirmation workflow and review eligibility checks.
