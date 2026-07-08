# ISC App Template

A shared starting point for web apps: **Vite + React** client, **Express** API, **MongoDB** via Mongoose — styled with the ISC visual identity from [ISC-HEI/isc-logos](https://github.com/ISC-HEI/isc-logos).

## Quick start

Requires Node ≥ 20 and (optionally) Docker for MongoDB.

```bash
npm install          # installs both workspaces
npm run db:up        # starts MongoDB in Docker (or use your own instance)
npm run dev          # runs API (:5174) and client (:5173) together
```

Open http://localhost:5173. The hero shows a live status line for the API and database. Everything works without MongoDB too — data routes just return 503 until it's up.

## Structure

```
├── client/                  Vite + React
│   └── src/
│       ├── api/client.js    fetch wrapper for /api
│       ├── components/      Layout (topbar, footer, ridge)
│       ├── pages/           Home, Items demo, StyleGuide, NotFound
│       ├── styles/
│       │   ├── theme.css    ← design tokens (the shared identity)
│       │   ├── base.css     reusable classes: .btn, .card, .badge, .input…
│       │   └── app.css      app shell styles
│       └── assets/logo/     official ISC SVGs
├── server/                  Express + Mongoose
│   └── src/
│       ├── index.js         app entry, /api/health
│       ├── config/db.js     Mongo connection (non-fatal in dev)
│       ├── models/          Item.js (example)
│       ├── controllers/     itemController.js (example)
│       ├── routes/          items.js (example)
│       └── middleware/      errorHandler, requireDB
├── docker-compose.yml       local MongoDB
└── .env.example             server configuration
```

The client dev server proxies `/api/*` to the Express server (see `client/vite.config.js`), so the client only ever uses relative URLs.

## Starting a new app from the template

1. Copy the repo (or click *Use this template* on GitHub) and rename it.
2. Change `APP_NAME` in `client/src/components/Layout.jsx` and `<title>` in `client/index.html`.
3. Set `MONGODB_URI` in `server/.env` to a database name for the new app.
4. Add your resources: for each entity, copy the `Item` trio (`models/Item.js`, `controllers/itemController.js`, `routes/items.js`), mount the router in `server/src/index.js`, and build the page from the `Items.jsx` pattern.
5. Delete the demo (Items page + server files) when you no longer need the reference.

## The visual identity

All identity decisions live in **`client/src/styles/theme.css`** as CSS variables — change them once, the whole app follows. Visit **/style-guide** in the running app for a living reference.

- **Ink & paper** — charcoal `#383838` on white, from the inline logos.
- **Magenta** `#DD0069` — the wordmark accent; links and primary actions only.
- **Facet palette** — the five pastel gradient facets of the mountain symbol (`sun`, `sky`, `mint`, `lavender`, `rose`); use for badges, chart series, and card accents.
- **The ridge** — the facet gradient as a thin line across the top of every page and under section titles. This is the signature: keep it a line, never a background wash.
- **Type** — Space Grotesk (display), Inter (body), JetBrains Mono (labels/statuses — a nod to the repo's ANSI logo). Self-hosted via Fontsource, no CDN needed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | client + server together with hot reload |
| `npm run dev:client` / `dev:server` | one side only |
| `npm run build` | production client build to `client/dist` |
| `npm run start` | run the API (serve `client/dist` behind your reverse proxy, or add `express.static`) |
| `npm run db:up` / `db:down` | local MongoDB via Docker |

## Attribution

The ISC logos are © their authors, licensed [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) via [ISC-HEI/isc-logos](https://github.com/ISC-HEI/isc-logos). Keep the attribution (e.g. in the footer) in apps that use them, and note the non-commercial clause.
