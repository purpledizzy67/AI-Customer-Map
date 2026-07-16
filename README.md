# Proactive AI Work Assistant

Monitor connected work apps, understand priorities from **real activity**, and prepare work before you ask — without guessing what you're thinking.

## Architecture

```
App
 ↓
Service Layer (Gmail · Calendar · Slack · GitHub · Notion)
 ↓
Unified Context Builder
 ↓
LLM (OpenAI Responses / Chat Completions)  ← never calls APIs directly
 ↓
Action Generator (approval-gated)
 ↓
Automation Layer (n8n + workers)
```

### Safety rules

- Never send emails automatically
- Never merge PRs
- Never post Slack replies
- Every suggestion requires approval and cites evidence sources

## Stack

- Next.js 15 (App Router) + TypeScript + TailwindCSS
- PostgreSQL via Supabase (in-memory demo fallback)
- OpenAI for priority analysis, briefs, drafts, embeddings
- n8n for scheduled automations
- Google / Slack / GitHub / Notion OAuth with AES-256-GCM encrypted tokens

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

With `DEMO_MODE=true` (default when secrets are missing), the app loads realistic sample activity so you can explore the full pipeline without OAuth apps.

### Seed / worker

```bash
npm run db:seed          # run collect + analyze + morning dashboard once
npm run worker           # background collect every 15 minutes
npm test                 # unit tests for crypto, retry, services, orchestrator
```

## Environment variables

See `.env.example` for the full list. Minimum for local demo:

| Variable | Description |
|----------|-------------|
| `ENCRYPTION_KEY` | 16+ char secret for token encryption |
| `DEMO_MODE` | `true` to use mock providers |
| `OPENAI_API_KEY` | Optional — enables live LLM; heuristics used otherwise |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Optional Postgres |
| `GOOGLE_*` / `SLACK_*` / `GITHUB_*` / `NOTION_*` | OAuth app credentials |

Apply `database/schema.sql` in the Supabase SQL editor for production.

## OAuth setup

1. Create OAuth apps for Google (Gmail + Calendar readonly), Slack, GitHub, Notion
2. Set redirect URIs to `/api/auth/callback/{google|slack|github|notion}`
3. Fill credentials in `.env`
4. Set `DEMO_MODE=false`
5. Connect accounts from **Settings** (supports reconnect)

Tokens are encrypted with AES-256-GCM before storage.

## Pipeline (Steps 1–10)

| Step | What happens |
|------|----------------|
| 1 | OAuth connect + encrypted tokens + reconnect |
| 2 | Collect every 15m from all five apps |
| 3 | Merge into `UnifiedContext` |
| 4 | AI analysis → structured JSON with citations |
| 5 | If confidence > 0.8 → prepare `/projects/{slug}` artifacts |
| 6 | Meeting within 30m → Meeting Brief |
| 7 | Merged PR webhook → Release package (approval for Notion) |
| 8 | Slack question → Suggested Reply draft (never posted) |
| 9 | Morning dashboard |
| 10 | Evening summary |

## API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/dashboard` | GET | Full dashboard payload (`?refresh=1` to recollect) |
| `/api/collect` | POST | Run collect + analyze pipeline |
| `/api/analyze` | POST | Analyze latest context |
| `/api/approvals` | POST | Approve/reject actions |
| `/api/chat` | GET/POST | Evidence-cited chat |
| `/api/search?q=` | GET | Semantic search across apps |
| `/api/projects` | GET/POST | Prepared project artifacts |
| `/api/morning` / `/api/evening` | POST | Daily dashboards |
| `/api/webhooks/github` | POST | Merged PR → release notes |
| `/api/webhooks/slack` | POST | Question → suggested reply |
| `/api/webhooks/n8n` | POST | `{ "workflow": "collect\|morning\|evening" }` |

## Project layout

```
src/
  app/           # Next.js App Router + API routes
  components/    # Dashboard UI
  services/      # gmail, calendar, slack, github, notion
  lib/ai/        # context builder, orchestrator, actions, automation
  workflows/     # collect, prepare, briefs, release, dashboards, chat
  prompts/       # LLM system prompts
  types/         # shared TypeScript types
  hooks/         # reusable client hooks
  utils/         # helpers
database/        # PostgreSQL / Supabase schema
workflows/n8n/   # importable n8n workflows
projects/        # generated work artifacts
```

## Docker

```bash
docker compose up --build
# optional n8n profile:
docker compose --profile n8n up
```

Import `workflows/n8n/*.json` into n8n and set `APP_URL` to your app.

## Cursor MCP

Point Cursor MCP servers at this app's APIs for agent tooling, e.g.:

- Collect context: `POST /api/collect`
- Ask priorities: `POST /api/chat`
- Search memory: `GET /api/search?q=`

## License

MIT
