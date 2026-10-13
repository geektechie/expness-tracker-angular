# Expense Tracker — Angular frontend

An Angular 20 frontend for the [Expense Tracker API](../ExpenseTracker): record expenses,
manage categories, set monthly budgets, and explore where the money goes.

| Page | What it does |
|---|---|
| **Dashboard** | This month so far: total spent, daily average, daily spending, top categories, payment methods, budget health, recent expenses |
| **Expenses** | The ledger — search, filter by date range / category / payment method, sort, page, add, edit, delete |
| **Categories** | Create, rename, recolour, archive and restore; delete only while unused |
| **Budgets** | Monthly limits per category with live progress, projections, and copy-from-last-month |
| **Reports** | Any date range: totals, a daily or monthly trend, and breakdowns by category and payment method |

---

## Running it

The frontend talks to the API through the Angular dev server's proxy, so start the API
first:

```bash
dotnet run --project ../ExpenseTracker/src/ExpenseTracker.Api --launch-profile https
```

Then the frontend:

```bash
npm install
npm start
```

Open <http://localhost:4200>.

### How the frontend reaches the API

`ng serve` proxies `/api` to `https://localhost:7284` (see `proxy.conf.json`). The browser
only ever talks to `localhost:4200`, which means:

- **no CORS round trip** — the request is same-origin as far as the browser knows, and
- **no certificate warning** — the proxy accepts the API's self-signed development
  certificate (`"secure": false`), which the browser would block outright.

`environment.ts` sets `apiBaseUrl: '/api'`. For production, serve the built app from the
same host as the API (or behind a reverse proxy that forwards `/api`) and nothing needs
to change. Point `apiBaseUrl` at an absolute URL only if the API lives on another origin
— and then add that origin to the API's `Cors:AllowedOrigins`.

---

## Folder structure

```
src/
├── environments/               apiBaseUrl per build configuration
├── styles.css                  design tokens (light + dark) and shared utility classes
└── app/
    ├── app.ts|html|css         shell: sidebar navigation, theme toggle, toast region
    ├── app.config.ts           router, HttpClient + error interceptor, page titles
    ├── app.routes.ts           every page lazy-loaded
    │
    ├── core/                   singletons and contracts — no UI
    │   ├── api/                one client per API resource: expenses, categories, budgets, reports
    │   ├── http/               ApiError, the interceptor that produces it, API base URL + query params
    │   ├── models/             TypeScript mirrors of the API's request and response DTOs
    │   ├── routing/            "Page · Expense Tracker" tab titles
    │   └── services/           toasts, theme
    │
    ├── shared/                 reusable, feature-agnostic building blocks
    │   ├── charts/             bar-list, column-chart, budget-meter
    │   ├── components/         icon, page-header, stat-tile, modal, confirm-dialog, pagination,
    │   │                       date-range-filter, month-picker, category-chip, empty-state,
    │   │                       error-banner, toast-host
    │   ├── pipes/              money, calendarDate, paymentMethodLabel
    │   └── utils/              calendar dates, money formatting, axis ticks, form errors
    │
    └── features/               one folder per page; nothing here imports from another feature
        ├── dashboard/
        ├── expenses/           expense-list, expense-form
        ├── categories/         category-list, category-form
        ├── budgets/            budget-planner, budget-form
        ├── reports/
        └── not-found/
```

Every component is three files — `name.ts`, `name.html`, `name.css` — wired with
`templateUrl` and `styleUrl`. No component carries an inline template or inline styles.

---

## Conventions

- **Angular 20 style.** Standalone components, signals for state, `input()` / `output()` /
  `model()`, `inject()`, built-in control flow (`@if`, `@for`), `OnPush` everywhere. No
  NgModules. File and class names drop the old suffixes: `ExpenseForm` lives in
  `expense-form.ts`.
- **Components never touch `HttpClient`.** They call the clients in `core/api`, which keeps
  every URL and query-string rule in one place per resource.
- **One error type.** The interceptor turns every failure — problem+json from the API, a
  dropped connection, a proxy error page — into an `ApiError`. Field errors are normalised
  to camelCase control names, so `applyServerErrors()` can put the API's message straight
  under the right input.
- **Errors go where they belong.** A field error sits under its field. A page that failed
  to load shows a banner with a retry, because the content it replaces is still missing. A
  toast is only for outcomes with no better home — a delete that succeeded, a conflict on
  an action button.
- **Calendar dates are strings.** The API speaks `yyyy-MM-dd` and `yyyy-MM`. `dates.ts`
  works on local date parts and never calls `new Date(iso)` or `toISOString()`, both of
  which shift a date across timezones — an expense logged at 1am would land on yesterday.
- **Money uses the API's currency.** Amounts are formatted with the currency code the
  API returns, so changing the server's `Tracker:Currency` relabels every screen.
- **Forms mirror the API's rules.** Amounts reject a third decimal place (the API refuses
  `12.345` rather than rounding it), dates stop at tomorrow, lengths match the server's.
  The request the API would reject is never sent.
- **Refetch keeps the frame.** While new data loads, the previous render stays on screen
  at reduced opacity rather than collapsing to a spinner, so nothing jumps.
- **No out-of-order responses.** Filter-driven requests go through `switchMap`, so a slow
  response for an old filter can never overwrite a newer one.

---

## Charts

The charts are hand-built SVG and CSS — no chart library — and follow a small set of
data-visualisation rules:

- **One colour for single-series marks.** Category breakdowns are ranked bars that are
  all the same blue. Categories are nominal, so bar *length* already carries the
  comparison; colouring each bar differently would spend the colour channel on nothing
  and, past three or four categories, produce hues a colour-blind reader cannot separate.
  A category's own colour appears only as a small swatch beside its name.
- **The series colour is validated.** `--series-1` passes the lightness, chroma and
  contrast checks against the chart surface in both light and dark mode.
- **Status never relies on colour.** Budget meters go accent → warning → critical, and
  every state carries an icon and a text label ("Near limit", "Over budget"). The warning
  colour is deliberately too light to read as text on the light surface, so the words do
  the work.
- **Thin marks, quiet chrome.** Columns are at most 24px wide with a 4px rounded top and a
  square foot; gridlines are solid hairlines; only the tallest column is directly
  labelled; y-axis ticks are rounded to clean values.
- **Hover enhances, never gates.** Each column's hit area is its whole band, far bigger
  than the mark. The arrow keys move through columns with the same readout, and every
  chart has a table view, so no value is only reachable by pointing at it.
- **Numbers agree.** Each page has at most one filter row, above everything it scopes.
  The dashboard is fixed to the current month so its budget section can never disagree
  with its totals; arbitrary ranges are the Reports page's job.

---

## Theme

Light, dark, or follow the system — the toggle sits at the bottom of the sidebar and the
choice is remembered. Dark mode uses its own stepped colours from the same palette, not
an automatic inversion.

---

## Commands

| Command | Does |
|---|---|
| `npm start` | Dev server on <http://localhost:4200> with the API proxy |
| `npm run build` | Production build into `dist/` — about 91 KB transferred for the first load |

---

## What this frontend deliberately does not have yet

- **No automated tests.** `npm test` is wired up (Karma), but there are no spec files.
  The behaviour was verified by hand against the running API: every page, create /
  edit / delete, validation, filters, light and dark mode, and phone width. The pure
  helpers in `shared/utils/` (dates, money, ticks, form errors) are the cheapest place
  to start.
- **No amount filter on the ledger.** The API supports `minAmount` / `maxAmount`; the
  Expenses page does not expose them yet.
- **No authentication.** Neither does the API — see its README.
"# expness-tracker-angular" 
