# Suqafuran Somalia

**Suqafuran** is an online marketplace for Somalia. Buyers browse products and shops, chat with sellers, and pay with mobile money. Sellers run shops, post listings, and promote them. The app is Somali-first, with an English option, and ships as a website plus Android and iOS apps.

This repository holds the whole platform:

| Folder | What it is |
|---|---|
| [`backend/`](backend/) | REST + WebSocket API — FastAPI, PostgreSQL, Redis, Celery, Kafka |
| [`shops-app/`](shops-app/) | Web storefront, built with React + Vite, and the Android/iOS apps (Capacitor wraps the same code) |

---

## Features

**Buyers**
- Browse listings and shops by category, search with filters, save favorites and searches, get price alerts
- Chat with sellers in real time, make offers, leave reviews
- Cart and checkout, with delivery zones and mobile-money payment
- AI support assistant that answers in Somali (or English) and can find products

**Sellers**
- Seller dashboard: shop profile, products, bulk upload, orders, analytics
- Paid promotions and featured listings (boosts), plus subscriptions
- Verification that builds buyer trust

**Admins and agents**
- Moderation, user and seller verification, trust and safety tools, audit logs
- Homepage banner ads, marketing campaigns, email templates, customer segments
- Support-ticket inbox for the AI chat's human handoff

**Platform**
- Somali / English interface (Somali is the default)
- Payments: M-Pesa, Lipana, generic mobile-money webhook
- SMS codes via Africa's Talking, email via SMTP/Resend/Brevo, images on Cloudinary, AI features via Groq

---

## Tech stack

| Layer | Technology |
|---|---|
| API | Python 3.12, FastAPI, SQLModel/SQLAlchemy, Pydantic |
| Database | PostgreSQL |
| Cache, rate limits, codes | Redis |
| Background jobs / events | Celery, Kafka |
| Web app | React 18, TypeScript, Vite, Tailwind CSS, Storefront UI, Zustand |
| Mobile apps | Capacitor 8 (Android + iOS) |
| Deployment | Docker, Kubernetes manifests in `backend/k8s/`, nginx in front of the API |

---

## Getting started

### Prerequisites

- Python **3.12** (the version the production Docker image uses; the pinned packages don't build on 3.14)
- Node.js **18+** and npm
- PostgreSQL and Redis running locally
- For mobile builds: Android Studio (Android), Xcode on macOS (iOS)

### 1. Backend

```bash
cd backend
python3.12 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env        # then fill in the values, see "Configuration" below
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Interactive docs are at `http://localhost:8000/docs`, and all routes live under `/api/v1`.

Background worker (emails, alerts):

```bash
celery -A app.tasks.celery_app worker --loglevel=info
```

> **Database schema:** the Alembic history in `backend/alembic/versions` has diverged into several heads. For that reason, recent schema additions are applied automatically and safely at startup in `app/main.py`, using `CREATE TABLE` / `ADD COLUMN IF NOT EXISTS`. Consolidating the migrations is a known to-do.

### 2. Web app

```bash
cd shops-app
npm install
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local
npm run dev
```

It opens at `http://localhost:5173`.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |

### 3. Android and iOS apps

The apps are the web build wrapped with Capacitor (`appId: com.suqafuran.app`). After any web change:

```bash
cd shops-app
npm run build
npx cap sync            # copies dist/ into android/ and ios/
npx cap open android    # or: npx cap open ios
```

Then build and run from Android Studio or Xcode. For a quick Android debug build:

```bash
cd shops-app/android && ./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk
```

---

## Configuration

### Backend (`backend/.env`)

`.env.example` lists every setting. The server **won't start** without these:

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Signs login tokens. Use a long random value; changing it signs everyone out |
| `POSTGRES_SERVER`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Database connection (or set `DATABASE_URL`) |
| `SMTP_USER`, `SMTP_PASSWORD` | Outgoing email |

Needed for the matching feature:

| Variable | Feature |
|---|---|
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Codes, caching, shared rate limits (strongly recommended) |
| `LIPANA_WEBHOOK_SECRET` | Lipana payments. **Required**: webhooks without a valid signature are rejected |
| `MOBILE_MONEY_WEBHOOK_SECRET` | `POST /mobile-money/webhook`; callers must send it as `X-Webhook-Secret`. Empty = webhook disabled |
| `MPESA_*` | M-Pesa STK push |
| `AFRICASTALKING_*` | SMS verification codes |
| `CLOUDINARY_*` | Image uploads |
| `GROQ_API_KEY` | AI features (support chat, translation, listing help) |
| `CORS_ORIGINS` | Allowed web origins |
| `ENVIRONMENT` | `development` / `production`. In development, a fixed test code works when Redis is down |

### Web app (`shops-app/.env.local`)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL, e.g. `https://app.suqafuran.com/api/v1` |
| `VITE_GOOGLE_MAPS_API_KEY` | Location picker / maps |
| `VITE_CLOUDFLARE_TURNSTILE_SITE_KEY` | Bot protection on forms (optional) |

---

## Security notes

Things to know before changing auth or payments:

- **Login sessions** last until the user logs out. Each login creates a `user_session` row, and the token carries its id. `POST /auth/logout` ends one device, and `POST /auth/logout-all` ends them all. Changing a password signs out all *other* devices, and a password reset signs out every device.
- **Rate limits** are counted in Redis (see `app/core/limiter.py`). The client IP is taken from the *rightmost* `X-Forwarded-For` entry, which is the one our nginx adds. **If a CDN such as Cloudflare is added in front of nginx, update `client_ip()` to use the CDN's client-IP header.**
- **Brute-force caps:** SMS/email codes and password-reset codes are burned after 5 wrong guesses. Password login locks an account for 15 minutes after 10 failures.
- **Payment webhooks** must be verified. Lipana needs a valid HMAC signature, the generic mobile-money webhook needs a shared secret, and manual "mark as paid" endpoints are admin-only.
- **Guest support tickets** can only be read or continued with the secret token returned when the ticket was created, never by id alone.
- **Never commit secrets.** That includes `.env` files, signing keys (`*.p12`, `*.pem`, `*.mobileprovision`, keystores), and database dumps. See `.gitignore`.

---

## Project layout

```
backend/
  app/
    main.py              FastAPI app, middleware, startup schema checks
    api/api_v1/          Routers, one file per area (auth, listings, payments, ...)
    api/deps.py          Auth dependencies (current user, admin/agent checks, sessions)
    core/                Settings, security (hashing, tokens), rate limiter
    models/              SQLModel tables
    services/            Payments, SMS, email, AI, cache, Kafka, storage
    tasks/               Celery tasks
  alembic/               Database migrations
  k8s/                   Kubernetes manifests
  Dockerfile             API image (uvicorn behind nginx)
  Dockerfile.worker      Celery worker image

shops-app/
  src/
    pages/               Route pages (home, shops, search, seller dashboard, admin, ...)
    components/          UI: home sections, storefront, shared (header, nav, AI chat), ads
    services/            API clients (axios)
    store/               Zustand stores (auth, cart, language, location)
    lib/i18n.ts          Translation helper; locales/so.json holds the Somali strings
  android/  ios/         Capacitor native projects
  capacitor.config.ts
```

---

## Translations

The interface defaults to **Somali**. English strings in the code pass through `t('...')` (from `useT()` in `src/lib/i18n.ts`), and their Somali versions live in `shops-app/src/locales/so.json`. When you add UI text, wrap it in `t()` and add the Somali translation to `so.json`. Otherwise it shows in English for Somali users.

The AI support chat replies in the user's selected language. The backend receives `language` with each message.

---

## Known gaps / roadmap

- Consolidate the diverged Alembic migration heads into one chain
- Add automated tests; today there are only a few, under `backend/tests/`
- Clean up the one-off maintenance scripts and logs in `backend/`
- CI pipeline with dependency scanning
- Remove the unused, non-importable `backend/app/api/api_v1/endpoints/listings_complete.py`
