# Copilot Instructions for skz-binder

## Project Overview
- **skz-binder** is a Next.js app for managing K-pop photocard collections, with a focus on Stray Kids. It uses Supabase for backend data and authentication.
- The main UI is in `app/`, with feature pages in subfolders (`binder/`, `binders/`, `library/`, `login/`).
- Data and images are organized under `public/mock-pcs/` with a deep folder structure for groups, albums, and templates.

## Key Workflows
- **Development:**
  - Start: `npm run dev` (Next.js dev server)
  - Build: `npm run build`
  - Lint: `npm run lint`
- **Data Import:**
  - Use `scripts/import-mock-pcs.mjs` to sync CSV/image data to Supabase. Reads from `items_import.csv`, `groups_lookup.csv`, `albums_lookup.csv`.
  - Handles duplicate keys and updates group/album IDs as needed.
- **CSV Generation:**
  - Use `scripts/build-items-csv.mjs` to scan `public/mock-pcs/` and generate importable CSVs. Follows strict filename conventions for front/back images and member tokens.

## Patterns & Conventions
- **Image Naming:**
  - Front: `001-front-bang-chan.png`, `002-front-ot8.png` (member tokens separated by `+` or `_`)
  - Back: `001-back-ot8.png`, `001-back-bang-chan.png`
- **Slugification:**
  - Use `slugify()` (see `import-mock-pcs.mjs`) for group/album slugs: lowercase, accents removed, non-alphanumerics to `-`.
- **Drag & Drop:**
  - Custom drag payloads in binder UI (`binderclient.tsx`), using `application/json` and hiding default drag ghost.
- **Supabase Usage:**
  - All data mutations and queries use Supabase client (`lib/supabaseClient.ts`).
  - Error handling for duplicate keys and missing environment variables is strict.

## Integration Points
- **Supabase:**
  - Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` or `.env`.
- **Next.js API routes:**
  - Custom endpoints in `app/api/` (e.g., `mock-pcs/list/route.ts`) for file listing and validation.

## Debugging & Testing
- Debug output is often printed to console (see `library/page.tsx` for filter and subset logs).
- No formal test suite detected; rely on manual validation and console logs.

## Examples
- To add a new photocard type, update image files in `public/mock-pcs/`, run `build-items-csv.mjs`, then import with `import-mock-pcs.mjs`.
- To extend drag-and-drop, see `setDragData()` and payload handling in `binderclient.tsx`.

## References
- Main UI: `app/binder/binderclient.tsx`, `app/library/page.tsx`
- Data import: `scripts/import-mock-pcs.mjs`, `scripts/build-items-csv.mjs`
- API: `app/api/mock-pcs/list/route.ts`
- Data: `items_import.csv`, `groups_lookup.csv`, `albums_lookup.csv`

---
_Review and update this file as project conventions evolve. Feedback welcome!_
