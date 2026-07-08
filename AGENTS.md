# AGENTS.md

## Cursor Cloud specific instructions

IntentMap is a single Next.js 15 (App Router) + TypeScript app. There is one service.

- **Run (dev):** `npm run dev` serves the app on `http://localhost:3000`. See `README.md` "Quick start" for the standard flow. Copy `.env.example` to `.env` first (`cp .env.example .env`).
- **Lint:** `npm run lint`. Two warnings in `src/components/CommunityPanel.tsx` (react-hooks/exhaustive-deps and no-img-element) are pre-existing and expected; exit code is still 0.
- **Build:** `npm run build`.

Non-obvious notes:
- **No external API keys are required.** `APOLLO_API_KEY`, `APIFY_API_KEY`, and `OPENAI_API_KEY` are all optional and have fallbacks (keyword-based intent scoring; curated Discord/Disboard seed data). The app runs fully without any secrets.
- **Data auto-seeds.** On first page load (or via `POST /api/seed`) the app populates a local SQLite DB. Slofile (Slack) communities are scraped live over the network; Disboard (Discord) falls back to curated seed data unless `APIFY_API_KEY` is set.
- **The `db:seed` npm script is broken** — it references `scripts/seed.ts`, which does not exist. Seed via the first-load behavior or `POST /api/seed` instead.
- **Storage is a local SQLite file** (`better-sqlite3`, a native module) at `./data/intentmap.db` by default (override with `DATABASE_PATH`). Both `./data/` and `.env*` are gitignored. Delete `./data/` to reset all state.
