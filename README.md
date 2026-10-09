# Astro Local

A local astrology web app with a **from-scratch calculation core**, a **zero-dependency Node.js MVC backend** (JWT auth, routing, Stripe payments), and a **Vue 3 + Vue Router** frontend. Docker-ready.

No Swiss Ephemeris, no backend npm packages. Just Node 18+.

- Ephemerides computed from orbital-element tables (planets) and Meeus series (Moon)
- Natal charts: planet positions, retrogrades, Ascendant, MC, houses, aspects
- Time zone handling with historical DST via the built-in ICU database
- Major Arcana calculation from a birth date
- Homemade RAG (BM25) over a built-in knowledge base plus your own Markdown files
- JSON HTTP API and a small single-page frontend with an SVG chart wheel

## Quick start

### Local (Node)

```bash
git clone https://github.com/sohodolly/astro-local.git
cd astro-local
node server.js                # backend + legacy page at http://127.0.0.1:8000
```

### With the Vue frontend

```bash
cd frontend && npm install && cd ..
npm run web:build             # builds the SPA into public/app, served by the backend
node server.js                # open http://127.0.0.1:8000
# or, for hot reload: terminal 1 `npm run dev`, terminal 2 `npm run web:dev` (proxies /api to :8000)
```

### Docker

```bash
cp .env.example .env          # set JWT_SECRET at minimum
docker compose up --build     # http://localhost:8000, data persisted in the `astro-data` volume
```

The backend needs **Node.js 18+** and has **zero npm dependencies**. Only the frontend uses npm (Vue 3, Vue Router, Vite).

## Architecture (MVC)

```
astro-local/
├── server.js                 # entry point
├── src/
│   ├── app.js                # HTTP server + static/SPA serving
│   ├── router.js             # router: params, middleware chains, error handling
│   ├── routes.js             # route table (single place to see the whole API)
│   ├── middleware.js         # requireAuth
│   ├── config.js, db.js      # env config, JSON-file collections
│   ├── controllers/          # auth, chart, payment: request handling and business rules
│   ├── models/               # User, Chart, Payment: data access
│   ├── views/presenters.js   # JSON serializers, so internals like password hashes never leak
│   ├── services/             # rag.js (BM25), stripe.js (Stripe over fetch)
│   ├── lib/auth.js           # scrypt password hashing, HS256 JWT
│   └── core/astro.js         # the calculation core (no I/O)
├── frontend/                 # Vue 3 + Vue Router + Vite SPA
├── public/legacy.html        # the original v1 single page, still served at /legacy
├── kb/                       # your own *.md knowledge files for RAG
├── test/                     # node:test suite
├── Dockerfile, docker-compose.yml, .env.example
```

Request flow: `router` → middleware (`requireAuth`) → controller → model/service → presenter → JSON.

## Authentication

- Passwords are hashed with **scrypt** (per-user random salt).
- Sessions are **JWT (HS256)** signed with `JWT_SECRET`, valid 7 days, sent as `Authorization: Bearer <token>`.
- Set a strong `JWT_SECRET`. In `NODE_ENV=production` the server refuses to start with the default.

## Payments

Free users can save up to 3 charts. Premium removes the limit (`402` is returned when the limit is hit).

- **Stripe Checkout** is called directly over `fetch` (no SDK). Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` and `STRIPE_WEBHOOK_SECRET`.
- Point a Stripe webhook for `checkout.session.completed` at `POST /api/payments/webhook`. The signature is verified with HMAC-SHA256 and a 5-minute tolerance, and handling is idempotent.
- Without `STRIPE_SECRET_KEY` the app runs in **mock mode**: checkout redirects to your own `/account` page and `POST /api/payments/mock-complete` upgrades the user. Use it for local development and tests only. It is disabled once Stripe is configured.
- Local webhook testing: `stripe listen --forward-to localhost:8000/api/payments/webhook`.

Adding another provider (LiqPay, WayForPay, etc.) means a new file in `services/` with a "create checkout" function and a webhook verifier, plus a branch in `controllers/payment.js`.

## API

All endpoints are served from the same origin. CORS is open (`*`), so you can call the API from other local apps.

### `POST /api/chart`

Compute a natal chart.

Request body (JSON):

| Field | Type | Description |
|---|---|---|
| `date` | string | Birth date, `YYYY-MM-DD` (required) |
| `time` | string | Local birth time, `HH:MM` (default `12:00`) |
| `city` | string | A city from the built-in table (see `GET /api/cities`) |
| `lat`, `lon` | number | Latitude / longitude in degrees (east is positive) |
| `tz` | string | IANA time zone, e.g. `Europe/Kyiv` |
| `house_system` | string | `whole` (whole sign, default) or `equal` |

Provide either `city`, or all of `lat` + `lon` + `tz`.

```bash
curl -X POST http://127.0.0.1:8000/api/chart \
  -H "Content-Type: application/json" \
  -d '{"date":"1990-05-15","time":"14:30","lat":51.5074,"lon":-0.1278,"tz":"Europe/London"}'
```

Response (abridged):

```json
{
  "utc": "1990-05-15T13:30:00.000Z",
  "jd": 2448027.0625,
  "tz": "Europe/London",
  "asc": { "lon": 190.2, "sign": "Весы", "deg": 10, "min": 12, "text": "10°12' Весы" },
  "mc": { "...": "..." },
  "cusps": [180, 210, "..."],
  "planets": {
    "Солнце": { "lon": 54.3, "speed": 0.96, "retro": false, "sign": "Телец", "house": 10, "text": "24°18' Телец" }
  },
  "aspects": [{ "a": "Солнце", "b": "Луна", "aspect": "трин", "orb": 2.1 }],
  "arcana": { "day": { "n": 15, "name": "Дьявол" }, "...": "..." },
  "interpretations": { "Солнце": [{ "title": "...", "text": "...", "score": 7.9 }] }
}
```

Bodies: Sun, Moon, Mercury through Pluto, North Node, South Node. Names are returned in Russian (see [Localization](#localization)).

### `GET /api/arcana?date=YYYY-MM-DD`

Major Arcana for a birth date.

```bash
curl "http://127.0.0.1:8000/api/arcana?date=1990-05-15"
```

### `GET /api/rag?q=<query>&k=<n>`

Search the knowledge base with BM25. `k` is the number of results (default 5).

```bash
curl -G http://127.0.0.1:8000/api/rag --data-urlencode "q=Луна в Раке" --data-urlencode "k=3"
```

### Auth, saved charts and payments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | no | `{email, password}` returns `{token, user}` (201) |
| POST | `/api/auth/login` | no | `{email, password}` returns `{token, user}` |
| GET | `/api/auth/me` | yes | Current user |
| GET | `/api/charts` | yes | Saved charts |
| POST | `/api/charts` | yes | Save a chart: same body as `/api/chart` plus `name`. Free plan: max 3 (`402` after) |
| DELETE | `/api/charts/:id` | yes | Delete a saved chart (204) |
| POST | `/api/payments/checkout` | yes | Returns `{provider, url}` to redirect the user to |
| POST | `/api/payments/mock-complete` | yes | Dev only, when Stripe is not configured |
| POST | `/api/payments/webhook` | Stripe signature | Stripe webhook |
| GET | `/api/health` | no | Health check (used by Docker) |

### `GET /api/cities`

Returns the built-in city table with `lat`, `lon` and `tz` for each entry.

## How it works

### Ephemerides

- **Planets**: heliocentric positions from a table of Keplerian elements with secular rates (E. M. Standish, valid for 1800–2050 AD). Kepler's equation is solved by Newton iteration, positions are converted to geocentric ecliptic longitude, and general precession is applied to get the equinox of date.
- **Sun**: derived from the Earth's heliocentric position.
- **Moon**: longitude from the ten largest terms of Meeus' lunar series.
- **Nodes**: mean lunar node.
- **Retrograde** flags and daily speed come from finite differences over 1.2 hours.

### Angles and houses

Sidereal time is computed from the Julian date, then the Ascendant and Midheaven are derived from the local sidereal time, obliquity and latitude. Two house systems are available: whole sign and equal.

### Time zones

Local birth time is converted to UTC using `Intl.DateTimeFormat` with the IANA zone, which includes historical offset and DST changes. The conversion is refined twice to behave correctly near DST boundaries.

### Arcana

With `d`, `m`, `y` as day, month and year:

1. `A` = day, `B` = month, `C` = sum of digits of the year
2. `D` = `A + B + C`, center = `A + B + C + D`
3. Any value above 22 is reduced (subtract 22 up to 44, otherwise sum the digits). 22 is The Fool.

There are many arcana schemes in circulation. This is one common variant, and the logic lives in one small function (`arcanaFor` in `astro.js`) that is easy to change.

### RAG

A small BM25 index is built at startup from:

1. Generated entries for every planet in every sign and house
2. Arcana descriptions
3. Your own files in `kb/*.md`, split into chunks by blank lines

Tokens are lowercased and lightly stemmed by stripping common Russian case endings. `/api/chart` uses the index to attach interpretations for each placement.

To add your own material, drop Markdown files into `kb/` and restart the server.

## Accuracy

Spot check for 2000-01-01 12:00 UTC:

| Body | Result |
|---|---|
| Sun | 10°22' Capricorn |
| Moon | 13°16' Scorpio |
| Saturn | 10°14' Taurus |

Expect planet positions within a few arcminutes and the Moon within roughly 0.1°. That is fine for natal charts but not for professional or research use.

## Limitations

- Only whole sign and equal houses. No Placidus, Koch or others yet.
- No ΔT (TT − UT), nutation or lunar latitude.
- Planet elements are valid for 1800–2050. Outside that range accuracy degrades.
- Mean node only, no true node. No Chiron, Lilith or asteroids.
- The city table is small. For other places pass `lat`, `lon` and `tz`.
- Built-in interpretations are template-based. For depth, add your own texts to `kb/`.
- This is an entertainment and educational tool.

## Localization

Sign, planet and arcana names, as well as the built-in knowledge base, are in Russian. To localize, edit these in `astro.js` and `server.js`: `SIGNS`, `ELEMENTS` keys, `ARCANA`, `ASPECTS`, `PLANET_KEY`, `SIGN_KEY`, `HOUSE_KEY`, `ARC_KEY`. The stemmer in `server.js` (`tok`) is tuned for Russian and should be replaced for other languages.

## Testing and maintenance

```bash
npm test        # node:test: core math, DST conversion, auth flow, limits, mock payment
```

- **Backward compatibility:** the v1 endpoints (`/api/chart`, `/api/arcana`, `/api/rag`, `/api/cities`) and their response shapes are unchanged and stay public. The old UI remains at `/legacy`. A test guards this.
- **Data:** stored as JSON files in `DATA_DIR` (`./data`, or `/data` in Docker). Back up that directory. The `Collection` class in `src/db.js` is the only place that touches storage, so moving to SQLite or Postgres means reimplementing it.
- **Core changes:** `src/core/astro.js` has no I/O. Add a test with reference values before changing any calculation.
- **Upgrading from v1:** move `astro.js` to `src/core/` and `index.html` to `public/legacy.html`. Nothing else is required, and the API is a superset.
- **Production checklist:** set `JWT_SECRET`, serve behind HTTPS (a reverse proxy such as Caddy or nginx), restrict CORS (currently `*`), and add rate limiting on `/api/auth/*`.

## Roadmap

- Placidus and Koch houses
- Transits, progressions and synastry
- True node, Chiron, Lilith
- Optional LLM layer on top of the RAG retrieval
- SQL storage, rate limiting, password reset by email
- Geocoding for arbitrary cities
- Unit tests against reference ephemeris data

## Contributing

Issues and pull requests are welcome. If you report a calculation error, please include the input data and the reference values you compared against.

## Credits

- Planetary elements: E. M. Standish, *Keplerian Elements for Approximate Positions of the Major Planets* (JPL)
- Lunar series and general algorithms: Jean Meeus, *Astronomical Algorithms*

## License

MIT. Add a `LICENSE` file before publishing.
