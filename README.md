# Closet — Digital Wardrobe & Outfit Builder

A personal digital wardrobe: upload clothing items, organize them into your
own category tree, filter by anything, and build reusable outfits.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind 4 + shadcn/ui (Base UI) ·
Supabase (Postgres + Auth + Storage) · Zustand · Zod

## One-time setup

1. **Apply the database schema**
   Open your [Supabase SQL Editor](https://supabase.com/dashboard/project/twsihetqryovvrdnyaho/sql/new),
   paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it.
   It creates all tables, row-level-security policies, and the `wardrobe`
   storage bucket. The script is idempotent — safe to re-run.

2. **(Recommended) Disable email confirmation** for instant sign-up:
   Dashboard → Authentication → Sign In / Providers → Email → turn off
   “Confirm email”. Otherwise you'll need to click the link Supabase emails
   you after signing up (handled at `/auth/confirm`).

3. **Run the app**

   ```bash
   npm install
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000), create your account on the login screen,
   and start adding items.

Environment variables live in `.env` (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).

## Architecture

```text
src/
  app/                  # routes only — thin server components
    (app)/              # authenticated app (wardrobe, outfits, categories, fields)
    login/  auth/       # public auth surface
  proxy.ts              # session refresh + route protection (Supabase SSR)
  features/             # feature modules: UI + server actions per domain
    wardrobe/           # item CRUD, image upload, item form/cards
    categories/         # user-defined nested category tree
    filters/            # URL-driven filtering engine (params -> Supabase query)
    outfits/            # outfit builder (Zustand store) + CRUD
    custom-fields/      # user-defined typed attributes
    auth/
  components/           # shared UI (shadcn/ui in components/ui)
  utils/supabase/       # browser / server / middleware clients
  types/                # domain row types mirroring the SQL schema
  lib/                  # small helpers (image URLs, cn)
supabase/
  schema.sql            # full database schema + RLS + storage policies
```

Key design decisions:

- **Categories are 100% user-defined** — a self-referencing tree; nothing hardcoded.
- **System filters** (color, brand, season, occasion, style, material, fit,
  pattern, price, wear count, laundry status, favorite) are typed, indexed
  columns on `wardrobe_items`.
- **Custom fields** store typed values (`value_text` / `value_number` /
  `value_boolean` / `value_options`) — never a JSON blob — so filtering stays
  type-safe.
- **Filters live in the URL** and are applied server-side through
  parameterized Supabase queries (AND across fields, OR within a field).
- **Row-level security everywhere**: every row belongs to `auth.uid()`;
  storage uploads are confined to the user's own folder.
