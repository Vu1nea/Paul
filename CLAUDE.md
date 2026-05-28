# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Paul is a self-hosted personal dashboard with drag-and-drop widgets. It is a monorepo with a React frontend (`client/`) and an Express backend (`server/`). The canonical task list and implementation spec is in `TASKS.md` — always read the relevant task block before implementing anything.

## Commands

### Running the full stack
```
docker compose up --build
```

### Client (from `client/`)
```
npm run dev       # Vite dev server on port 5173
npm run build     # Production build
npm run lint      # ESLint
```

### Server (from `server/`)
```
npm run dev       # nodemon + ts-node, port 3001
```

There are no tests configured.

## Architecture

### Data flow
Data fetching lives in `App.tsx`, not inside widgets. `App.tsx` fetches weather data and passes it down as the `data` prop. Widgets are purely presentational.

### Widget contract
Every widget component must accept exactly two props: `config` (user settings) and `data` (server-fetched data, or `null` while loading). The shared interface is `WidgetProps<C, D>` in `client/src/widgets/WidgetBase.tsx`. New widgets go in `client/src/widgets/` and must be exported from `client/src/widgets/index.ts`.

### Layout + config persistence
Layout and widget configs are saved together in a single `POST /api/layout` call with shape `{ layout: { lg: LayoutItem[] }, configs: Record<id, { type, config }> }`. The server stores layout in the `layouts` table (one row, `id = 'main'`) and replaces all widget rows in the `widgets` table inside a transaction. All layout saves from `App.tsx` are debounced 1000 ms.

### Database (`server/src/db.ts`)
SQLite via `better-sqlite3`. All DB calls are synchronous — never use `async/await` with better-sqlite3. The DB file is `server/paul.db`. Tables are created on startup in `db.ts`.

Current schema:
- `layouts(id TEXT PK, layout_json TEXT)` — single row `id='main'`, stores `{ lg: [...] }` as JSON
- `widgets(id TEXT PK, type TEXT, config_json TEXT)` — one row per widget instance

### Server (`server/src/index.ts`)
Express 5 + CORS. Routes: `GET /health`, `GET /api/layout`, `POST /api/layout`, `GET /api/weather` (proxies Open-Meteo, no API key required).

### Environment
Client reads `VITE_API_URL` from `.env` (see `client/.env`). Never hardcode URLs in components.

## Non-Negotiable Rules

These apply to every task in this project:

- **No external UI library.** Plain HTML and CSS only — no component libraries.
- **No state management library.** `useState` and `useEffect` only — no Redux, Zustand, etc.
- **No Axios.** Use the native `fetch` API only.
- **All better-sqlite3 calls are synchronous.** No async/await with the DB.
- **Widgets never fetch their own data.** Data is always passed via the `data` prop.
- **Hard deletes only.** No soft delete or archive.
- **File extensions:** frontend components use `.tsx`, frontend utilities use `.ts`, all backend files use `.ts`.
