# iAGO Loyalty

Multi-tenant loyalty platform for iAGO Digital. Phase 1 is the foundation: staff authentication, businesses, roles, invitations, and tenant isolation. Loyalty cards, stamp QR codes, NFC stamps, and wallets are later phases and are not simulated here.

## Stack

Next.js, TypeScript, Tailwind, shadcn/ui, and PostgreSQL with the same schema Supabase will host. Production authentication is Supabase Auth. Local development can use PostgreSQL directly so the security rules can be tested before a Supabase project exists.

## Local development

1. Install PostgreSQL 16 and run `sh scripts/prepare-local-db.sh`.
2. Copy `.env.example` to `.env.local`.
3. Replace `SESSION_SECRET` and `SETUP_TOKEN` with random values of at least 32 characters.
4. Run `npm test` and `npm run dev`.
5. Open `/setup`, enter the setup token, and create the first super admin.

The local database password in `.env.example` is a development default created by the prepare script. It is not a production secret. Local sessions are refused when `NODE_ENV=production`.

Hosted Supabase replaces local mode when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set. Apply `supabase/migrations` to that project. Do not run `supabase/local/prelude.sql` there. The service role key stays on the server. Apple, Google, email, WhatsApp, and SMS credentials are not part of this phase.

## Tenant isolation

Business data is scoped by `business_id`. Authenticated reads go through row level security. Writes go through database functions that check the caller again. `npm test` creates two businesses and proves one owner cannot read or invite into the other, and that suspending a business blocks owner writes.

## Stamp collection, later

A stamp will be collectable in three ways, all posting the same ledger operation: an employee scans the customer QR, the customer scans a stamp QR, or the customer taps an NFC tag. The NFC tag stores the same HTTPS URL as the QR so iPhone and Android open it without a native app. Static codes are rate-limited. Rotating codes expire quickly. That behavior is not built yet.
