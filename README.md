# AiFyn Control Room

Internal dashboard for the AiFyn website: **website traffic** and **query (demo-request) management**.
React (Vite) + a small Cloudflare Worker API, deployed as its own Worker that reads the website's D1 database (`aifyn-db`).

```
src/pages/       Overview · Traffic · Queries · Login
src/components/  Shell (sidebar/top bar), charts, LeadDrawer (query detail), ui primitives
src/lib/         api client, demo dataset, metrics, store (shared state), formatting
worker/index.js  API: /api/login, /api/traffic, /api/live, /api/leads (+ PATCH, notes, events, export)
```

## What it shows

- **Overview** – visitors, queries received, visitor→query conversion, open/overdue queries, average first-reply time
  (all with change vs. the previous period), traffic trend, pipeline funnel, queries per day, a "needs attention" list
  (replies past the site's 24-hour promise, follow-ups due), top pages, channels and queries by industry.
- **Traffic** – visitors, page views, sessions, pages/session, bounce rate, average visit; trend; live visitors and feed;
  channels / sources / UTM campaigns (with queries and conversion per campaign); top pages (with queries per page) and
  entry pages; countries / cities; device / browser / OS; weekday × hour heatmap.
- **Queries** – every demo request from the site form, with status pipeline
  (New → Contacted → Demo scheduled → Proposal sent → Won / Lost, plus Spam), owner, priority, follow-up date,
  24h SLA flags, search and filters, table or drag-and-drop board, bulk status/assign, CSV export, and a detail drawer
  with call / WhatsApp / email shortcuts, notes and a full activity timeline. Each query also shows where the visitor
  came from (channel, source, campaign, landing page).

Date ranges: Today (hourly), 7, 30, 90 days. Light/dark theme. Works on mobile.

## How the data gets here (changes in AiFyn)

The website now records page views itself (no cookies, no third-party script):

- `src/lib/analytics.js` sends a beacon to `POST /api/t` on every route change, plus time-on-page when the tab is hidden.
- `worker/index.js` stores it in `pageviews` (country/city from Cloudflare, device/browser/OS from the user agent,
  referrer host, UTM tags). The visitor id is a salted hash of IP + user agent that changes every day; bots and `/admin` are skipped.
- Leads now carry the visitor's session id, so each query is linked to the visit that produced it.
- `migrations/0002_traffic_and_queries.sql` adds `pageviews`, `lead_events` and the status/priority/assignee/follow-up columns on `leads`.

## Setup

1. **Website** (AiFyn): apply the migration and deploy

   ```bash
   cd ../AiFyn
   npm run db:migrate        # remote D1
   npm run deploy
   ```

2. **Dashboard**

   ```bash
   npm install
   npx wrangler secret put DASHBOARD_PASSWORD
   npm run deploy
   ```

   Sign in with username `aifyn` (`DASHBOARD_USER` in `wrangler.jsonc`) and that password.
   Edit `TEAM` in `wrangler.jsonc` to change the names offered in "Assigned to".
   Add a custom domain (e.g. `dashboard.aifyn.in`) in Cloudflare → Workers → aifyn-dashboard → Domains & Routes.

## Develop locally

```bash
cp .dev.vars.example .dev.vars          # set DASHBOARD_PASSWORD
(cd ../AiFyn && npm run db:migrate:local)
npm run dev:api                         # API on :8788, shares the site's local D1 (../AiFyn/.wrangler/state)
npm run dev                             # UI on http://localhost:5174 (proxies /api)
```

Run the website with `npm run preview` in AiFyn (port 8787) to generate real local traffic and leads.
