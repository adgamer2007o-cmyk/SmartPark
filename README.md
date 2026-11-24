# SmartPark

Campus parking management system: scan an entrance QR, get the best available spot, pay for a time slot, and manage bookings. Admins manage lots, pricing, occupancy, and QR codes.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS (Vercel)
- Backend: Node.js + Express + Prisma (Railway / Render)
- Database: PostgreSQL (local Docker, or Neon / Supabase)

## Local setup

1. Start PostgreSQL:

```bash
docker compose up -d
```

2. Backend:

```bash
cd backend
cp .env.example .env   # already includes local defaults
npm install
npx prisma db push
npm run db:seed
npm run dev
```

API: http://localhost:4000  
API docs: http://localhost:4000/api/docs  
Postman collection: `backend/postman/SmartPark.postman_collection.json`

3. Frontend:

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@smartpark.com | admin123 |
| Student | student@smartpark.com | student123 |
| Faculty | faculty@smartpark.com | student123 |

## Environment

Backend (see `backend/.env.example`):

- `DATABASE_URL`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `CLIENT_URL` (frontend origin)
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (optional; mock payments if empty)
- `GOOGLE_CLIENT_ID` (optional)
- SMTP vars (optional; emails log to console if unset)

Frontend (`frontend/.env.example`):

- `VITE_API_URL` (empty in local dev — Vite proxies `/api`)
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_GOOGLE_CLIENT_ID`

## Deployment

**Backend + database (Render):** `render.yaml` is a Render Blueprint that provisions the API
and a managed PostgreSQL database. In Render: *New → Blueprint*, connect this repo, apply.
Set `CLIENT_URL` to the deployed frontend origin (e.g. `https://smartpark.vercel.app`).
The blueprint runs `prisma db push` before each deploy and serves `GET /api/health`.

**Frontend (Vercel):** import the repo, set *Root Directory* to `frontend`, and add
`VITE_API_URL=https://<your-api>.onrender.com`. `frontend/vercel.json` handles SPA rewrites.

**Seed demo data** (once, after the API is live):

```bash
cd backend
DATABASE_URL="<production connection string>" npm run db:seed
```

## Production notes

- Serve the API over HTTPS and set `COOKIE_SECURE=true`.
- Point `CLIENT_URL` at the frontend origin and configure CORS.
- Verify Stripe webhooks at `POST /api/payments/webhook`.
- Frontend SPA rewrites are in `frontend/vercel.json`.
