# IntentMap

Turn public Discord and Slack communities into a **live map of customer buying intent** — discover and reach potential customers faster.

![IntentMap](https://img.shields.io/badge/platforms-Discord%20%7C%20Slack-5865F2)

## What it does

1. **Discovers** public communities from [Disboard](https://disboard.org/) (Discord) and [Slofile](https://slofile.com/) (Slack)
2. **Scores** each community for buying intent using keyword signals + optional LLM analysis
3. **Maps** communities on an interactive intent landscape (intent score × reach)
4. **Surfaces** outreach links, intent signals, and filters so you can prioritize hot leads

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first load, the app auto-seeds sample data and scrapes live Slack communities from Slofile.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APIFY_API_KEY` | Recommended | Enables live Disboard scraping (Cloudflare-protected). Uses [Apify Discord scraper](https://apify.com/khadinakbar/discord-all-in-one-scraper). |
| `OPENAI_API_KEY` | Optional | Enables hybrid LLM intent scoring (falls back to keyword scoring). |
| `DEFAULT_KEYWORDS` | Optional | Comma-separated discovery keywords (default: `saas,startup,marketing,seo,product`) |
| `DATABASE_PATH` | Optional | SQLite path (default: `./data/intentmap.db`) |

### Apify setup (for live Discord data)

Disboard.org is behind Cloudflare, so direct scraping doesn't work. Add your Apify API key:

```env
APIFY_API_KEY=apify_api_xxxxxxxx
```

The platform uses the [`magicfingers/discord-server-scraper`](https://apify.com/magicfingers/discord-server-scraper) actor with Apify Proxy to search Disboard by keyword.

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/communities` | GET | List communities with filters (`platform`, `tier`, `search`, `minIntent`) |
| `/api/scrape` | POST | Run discovery: `{ "sources": ["disboard","slofile"], "keywords": ["saas"], "maxPerSource": 40 }` |
| `/api/stats` | GET | Map statistics and config status |
| `/api/seed` | POST | Seed database if empty |

## Intent scoring

Communities are scored 0–100 based on:

- **Active need signals** — "looking for", "need a tool", "anyone know"
- **Evaluation language** — "recommend", "alternative to", "best tool"
- **Commercial audience** — SaaS, startup, founder, marketing, SEO, B2B
- **Pain points** — "frustrated with", "switching from"
- **Optional LLM boost** — when `OPENAI_API_KEY` is set

Tiers: **Hot** (70+), **Warm** (45+), **Cool** (25+), **Cold** (&lt;25)

## Architecture

```
src/
├── app/api/          # REST API routes
├── components/       # Dashboard, IntentMap (D3), CommunityPanel
├── lib/
│   ├── scrapers/     # Slofile (direct), Disboard (Apify/seed)
│   ├── intent-analyzer.ts
│   ├── discovery.ts
│   └── db.ts         # SQLite persistence
```

## Data sources

| Source | Method | Notes |
|--------|--------|-------|
| Slofile | Direct HTML scrape | Works out of the box |
| Disboard | Apify actor | Requires `APIFY_API_KEY`; falls back to curated seed data |
| Intent analysis | Keywords + optional OpenAI | Works without any API keys |

## License

MIT
