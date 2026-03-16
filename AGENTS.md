# AGENTS.md — CNC Tool Analytics Dashboard

> This file provides authoritative instructions for AI coding agents working on this codebase.
> Read it in full before making any changes. Follow every rule strictly.

---

## 1. Project Overview

**CNC Tool Analytics Dashboard** is a Node.js + Express web application connected to a **PostgreSQL** database.  
It provides two major modules:

| Module | URL | Purpose |
|---|---|---|
| Tool Usage Dashboard | `/` | Monitors accumulated tool-life/usage for CNC machines (30-day rolling view) |
| Cost Efficiency Dashboard | `/cost-efficiency/` | Tracks daily tool cost, cost rankings, and cost breakdowns by line / machine / type |

**Tech stack:**
- **Backend**: Node.js, Express 5, pg (PostgreSQL client), dotenv, cors, body-parser
- **Frontend**: Vanilla HTML + CSS + JavaScript (no framework)
- **Charts**: ApexCharts (CDN)
- **Typography**: Google Fonts — Outfit
- **Port**: `3001` (configured via `PORT` env var, default `3001`)

---

## 2. Repository Structure

```
ExtensionDaPage/
├── server.js                        # Main Express entry point
├── package.json
├── .env                             # Secret DB credentials (never commit)
├── .env.example                     # Template for .env
├── routes/
│   └── cost-efficiency.js           # API route handlers for /api/cost-efficiency/*
└── public/                          # Static files served by Express
    ├── index.html                   # Tool Usage Dashboard page
    ├── css/
    │   └── style.css                # Shared CSS for main dashboard
    ├── js/
    │   └── app.js                   # JS for main dashboard (tool usage)
    └── cost-efficiency/
        ├── index.html               # Cost Efficiency — Baht/Piece page
        ├── baht-per-piece.html      # Cost Efficiency — Baht/Piece (alias)
        ├── baht-per-count.html      # Cost Efficiency — Baht/Count page
        ├── css/
        │   └── style.css            # CSS for cost-efficiency pages
        └── js/
            └── app.js               # JS for cost-efficiency dashboard
```

---

## 3. Environment Variables

Stored in `.env` at project root. **Never hardcode credentials.**

```env
DB_USER=your_username
DB_HOST=your_host
DB_DATABASE=your_database
DB_PASSWORD=your_password
DB_PORT=5432
PORT=3001
```

---

## 4. Running the Project

```bash
# Install dependencies (only first time or after package.json changes)
npm install

# Start the server
npm start
# → Server runs at http://localhost:3001
```

---

## 5. Database Schema (Key Tables / Views)

> All queries go through the shared `pool` (pg Pool) defined in `server.js` and passed as an argument to route modules.

### `tool`
| Column | Type | Notes |
|---|---|---|
| `tool_id` | TEXT | Format: `T-{line}-{machine}-{seq}` e.g. `T-L1-M1-1` |
| `tooltype_id` | TEXT | FK to `tooltype` |

### `tooltype`
| Column | Type | Notes |
|---|---|---|
| `tooltype_id` | TEXT | Primary key |
| `std` | NUMERIC | Standard tool life (max life threshold) |

### `tool_status_monitor` (View)
| Column | Notes |
|---|---|
| `tool_id` | FK to `tool` |
| `usage_date` | TIMESTAMPTZ — always convert with `AT TIME ZONE 'Asia/Bangkok'` |
| `cycle_accumulated` | Accumulated usage cycles |
| `std` | Max life for this tool |

### `tool_usage_daily` (View)
Used only to fetch the date range for filter dropdowns.

### `daily_tool_cost` (View / Table)
Primary source for all cost-efficiency data.

| Column | Notes |
|---|---|
| `usage_date` | TIMESTAMPTZ |
| `tool_id` | |
| `machine_id` | |
| `line_id` | |
| `tooltype_id` | |
| `daily_insert_use` | Cycles used that day |
| `baht_per_use` | Cost per cycle (NUMERIC) |
| `daily_tool_cost` | Total cost that day (NUMERIC, cast with `::numeric`) |

> **Important:** Always cast `daily_tool_cost` and `baht_per_use` to `::numeric` in queries — they are stored as TEXT/NUMERIC-like and implicit casting can cause silent errors.

---

## 6. API Routes

### Base routes (in `server.js`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/tool-usage-report` | Tool life data for main dashboard chart |
| GET | `/api/filters` | Dropdown data: lines, machines, tooltypes, years, months, date range |

**`/api/tool-usage-report` query params:** `year`, `month`, `line`, `machine`, `tooltype`  
**Required params:** `line`, `machine`, `tooltype`

### Cost Efficiency routes (`/api/cost-efficiency/*` — defined in `routes/cost-efficiency.js`)

| Method | Path | Query Params | Description |
|---|---|---|---|
| GET | `/api/cost-efficiency/summary` | `year`, `month`, `line`, `machine` | Total cost, avg daily cost, tool count |
| GET | `/api/cost-efficiency/daily` | `year`, `month`, `line`, `machine` | Daily cost time-series |
| GET | `/api/cost-efficiency/rankings` | `year`, `month`, `line`, `machine` | Top-10 tool & tool-type cost rankings |
| GET | `/api/cost-efficiency/details` | `year`, `month`, `line`, `machine` | Detailed cost table (last 100 rows) |
| GET | `/api/cost-efficiency/line-summary` | `year`, `month` | Cost breakdown by line (top 5) |
| GET | `/api/cost-efficiency/machine-summary` | `year`, `month` | Cost breakdown by machine (top 5) |
| GET | `/api/cost-efficiency/type-summary` | `year`, `month` | Cost breakdown by tool type (top 5) |

**Filter logic for `line` / `machine`:**  
If the value is `'All'` or not provided, the filter clause is **omitted** (shows all). Otherwise, the `WHERE line_id = $N` / `WHERE machine_id = $N` clause is appended dynamically.

---

## 7. Adding a New API Route

1. If the route belongs to an existing module (e.g. cost-efficiency), add it inside `routes/cost-efficiency.js` following the existing pattern:
   ```js
   router.get('/new-endpoint', async (req, res) => {
       try {
           const { year, month } = req.query;
           const result = await pool.query(`SELECT ...`, [parseInt(year) || 2024, parseInt(month) || 2]);
           res.json({ success: true, data: result.rows });
       } catch (err) {
           res.status(500).json({ success: false, error: err.message });
       }
   });
   ```
2. For a new module, create a new file in `routes/`, export a factory function `(pool) => router`, and register it in `server.js`:
   ```js
   const myRoutes = require('./routes/my-module');
   app.use('/api/my-module', myRoutes(pool));
   ```

---

## 8. Adding a New Frontend Page

1. Create the HTML file inside `public/` or a subdirectory (e.g. `public/new-feature/index.html`).
2. Link the shared sidebar navigation present in all pages — always keep `nav-item active` on the current page's link.
3. Create corresponding CSS in `public/new-feature/css/style.css` and JS in `public/new-feature/js/app.js`.
4. Add a nav link in **all existing HTML files'** `<aside class="sidebar">` block so navigation is consistent.
5. Register the static directory in Express if outside `public/` (normally not required — `express.static` serves the whole `public/` folder).

---

## 9. Frontend Conventions

- **Charts**: Use **ApexCharts** (loaded via CDN). Do not introduce other charting libraries.
- **Fonts**: `Outfit` from Google Fonts (weights 300, 400, 600, 800). Do not change the font family.
- **Design theme**: Dark background (`#0a0a1a` / `#0d0d1d`), neon/glow accents (cyan `#00f5ff`, pink `#ff006e`, purple `#7c3aed`), glassmorphism cards (`rgba` background + `backdrop-filter: blur`). Keep all new UI consistent with this aesthetic.
- **CSS class naming**: Use descriptive kebab-case. Reuse existing classes from `style.css` before creating new ones.
- **Frameworks**: Any JS or CSS framework (React, Vue, Angular, Tailwind, etc.) may be used if it improves the implementation. However, **the visual theme must remain identical across all pages** — see the fixed color palette below.
- **Fixed Color Theme (mandatory, no exceptions)**:
  | Token | Value | Usage |
  |---|---|---|
  | Background (deep) | `#0a0a1a` | Page/app base background |
  | Background (card) | `#0d0d1d` | Glass-card surfaces |
  | Accent — Cyan | `#00f5ff` | Primary highlights, active states, glows |
  | Accent — Pink | `#ff006e` | Secondary highlights, danger indicators |
  | Accent — Purple | `#7c3aed` | Tertiary accents, gradients |
  | Text — primary | `#ffffff` | Headings, key values |
  | Text — muted | `rgba(255,255,255,0.6)` | Labels, subtitles |
  | Card glass bg | `rgba(255,255,255,0.03)` | Glassmorphism card fill |
  | Card border | `rgba(0,245,255,0.15)` | Card border / separator |
  - All glassmorphism cards must use `backdrop-filter: blur(...)`.
  - Font family must always be **Outfit** (Google Fonts, weights 300/400/600/800).
  - Do **not** override these tokens with framework defaults (e.g. no plain Tailwind blue, no Bootstrap primary).
- **Timezone**: All date/time display must be relative to `Asia/Bangkok` (UTC+7). DB queries must use `AT TIME ZONE 'Asia/Bangkok'` when converting timestamps.
- **Export**: The main dashboard has CSV export built in (`#export-csv` button). Match the same pattern for any new page that requires export.

---

## 10. Coding Rules & Constraints

1. **No `.env` changes without explicit user instruction.** Never modify `.env` or add credentials to source files.
2. **No new npm packages** unless the user explicitly approves. The current dependencies (`express`, `pg`, `dotenv`, `cors`, `body-parser`) are sufficient for all backend work.
3. **Parameterized queries only.** Never interpolate user input directly into SQL strings. Always use `$1`, `$2`, ... placeholders with a `params` array.
4. **Error handling on every route.** Wrap all `await pool.query(...)` calls in `try/catch`. Return `{ success: false, error: err.message }` on failure (with appropriate HTTP status code).
5. **Preserve the sidebar** in all HTML pages. Any new page must include the full `<aside class="sidebar">` block matching the structure in `public/index.html`.
6. **Do not break existing routes.** When editing `server.js` or route files, run a mental diff to ensure existing endpoints remain unchanged.
7. **Cast numeric columns.** Always use `::numeric` when summing or averaging `daily_tool_cost` and `baht_per_use`.
8. **Console.error for server-side errors only.** Do not use `console.log` for production logging of sensitive data.

---

## 11. Common Pitfalls

| Pitfall | Correct Approach |
|---|---|
| Forgetting `::numeric` cast on cost columns | Always cast: `SUM(daily_tool_cost::numeric)` |
| Hardcoding line/machine filters | Use dynamic `$N` parameterization; skip clause when value is `'All'` |
| Using `console.log` on DB results in production | Use `console.error` only on errors |
| Adding chart library other than ApexCharts | Don't — use ApexCharts exclusively |
| Breaking sidebar navigation on a new page | Copy sidebar block from `public/index.html`; update `active` class |
| Using UTC dates without timezone conversion | Always use `AT TIME ZONE 'Asia/Bangkok'` in SQL and display accordingly |
| Mutating `pool` outside `server.js` | `pool` is created once in `server.js` and injected; never create a second pool |

---

## 12. Testing

There are currently **no automated tests**. When making changes:

1. Start the server with `npm start`.
2. Open `http://localhost:3001` and verify the main dashboard loads and charts render.
3. Open `http://localhost:3001/cost-efficiency/` and verify all cards, charts, and the details table load correctly.
4. Test API endpoints directly with curl or browser: e.g. `http://localhost:3001/api/filters`
5. Check the Node.js console for any uncaught errors or DB query failures.

---

*Last updated: 2026-03-16 — auto-generated by Antigravity AI agent*
