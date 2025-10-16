# Icon Backend

A production-grade Node.js/Express API with TypeScript, Prisma, and PostgreSQL for Icon Computers service management system.

## Features

- **TypeScript** - Type-safe development
- **Express.js** - Web framework with security middleware
- **Prisma** - Database ORM with PostgreSQL
- **Pino** - Structured logging
- **Zod** - Environment validation
- **Health checks** - Database connectivity monitoring
- **CMS endpoints** - Content management for banners, offers, products

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- PostgreSQL database running locally
- npm or yarn package manager

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL
   ```

3. **Start PostgreSQL (password: 1234)**
   - Docker (recommended):
     ```bash
     docker compose up -d
     ```
   - Windows (no Docker):
     1. Install PostgreSQL 16 from the official installer.
     2. Set password to `1234` and create a database named `icon_backend`.
     3. Ensure PostgreSQL is listening on `localhost:5432`.

4. **Set up database**
   - macOS/Linux:
     ```bash
     npm run migrate && npm run seed
     ```
   - Windows (PowerShell):
     ```powershell
     ./scripts/migrate-seed.ps1
     ```

5. **Start development server**
   ```bash
   npm run dev
   ```

5. **Test the API**
   ```bash
   # Health check
   curl http://localhost:8080/healthz
   # Expected: {"ok":true,"db":true}

   # CMS data
   curl http://localhost:8080/cms
   # Expected: {"banners":[...],"offers":[...],"products":[...]}
   ```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with sample data
- `npm run reset` - Reset database (destructive)
- `npm test` - Run tests

## Project Structure

```
src/
├── config/          # Configuration files
│   ├── env.ts       # Environment validation
│   └── logger.ts    # Logging setup
├── db/              # Database configuration
│   └── prisma.ts    # Prisma client
├── routes/          # API routes
│   ├── health.ts    # Health check endpoint
│   └── cms.ts       # CMS endpoints
└── server.ts        # Express app setup

prisma/
├── schema.prisma    # Database schema
└── seed.ts          # Sample data

scripts/
└── migrate-seed.sh  # Database setup script
```

## API Endpoints

### Health Check
- `GET /healthz` - Returns server and database status

### CMS
- `GET /cms` - Returns active banners, offers, and products with date filtering

### Admin CMS
- Auth: `requireAuth` + `requireRole('ADMIN')`
- Error format: `{ error: { code, message, details? } }`

- Hero Banners
  - `GET /admin/hero-banners` — filters: `status?`, `q?` (case-insensitive in `title`), supports `limit`/`offset`. Sorting fixed: `sortOrder ASC`, `id DESC`. Returns `{ items, total, limit, offset }`.
  - `GET /admin/hero-banners/:id` — returns 404 if missing.
  - `POST /admin/hero-banners` — body `{ title:string(min1), imageUrl:httpsUrl, status:'ACTIVE'|'INACTIVE', sort?:int>=0 }`.
    - Validations: `title` required, `imageUrl` must be `https://`, `status` defaults `ACTIVE`, `sort` defaults `0`.
  - `PATCH /admin/hero-banners/:id` — body fields optional; same constraints. `sort` maps to `sortOrder`.
  - `DELETE /admin/hero-banners/:id` — hard delete; returns `204`.

### Public
- `GET /hero-banners` — `status='ACTIVE'`, sorting `sortOrder ASC`, `id DESC`, supports `limit/offset`, returns array only.

- Special Offers
  - `GET /admin/special-offers` — filter by `status`, supports `limit`/`offset` and sorting.
  - `POST /admin/special-offers` — body `{ imageUrl, productName, priceCents, discountedCents, discountPercent?, status?, sortOrder?, validFrom?, validTo? }`.
    - Validations: `imageUrl`, `productName`, `priceCents`, `discountedCents` required; `discountedCents ≤ priceCents`.
    - `discountPercent`:
      - If absent → computed as `((price - discounted)/price) * 100` and stored.
      - If present → cross-checked against computed value with ±1% tolerance; otherwise `400`.
  - `PATCH /admin/special-offers/:id` — partial update; when only `discountPercent` provided, cross-check against current `priceCents/discountedCents` with ±1% tolerance.
  - `DELETE /admin/special-offers/:id` — soft delete.

- Laptop Offers
  - Same rules as Special Offers under `/admin/laptop-offers`.

### Home Aggregator
- `GET /home`
- Returns:
  ```json
  { "heroBanners": [...], "specialOffers": [...], "laptopOffers": [...] }
  ```
- Filters:
  - `heroBanners`: `status='ACTIVE'`
  - `specialOffers`: `status='ACTIVE'` + current validity window
  - `laptopOffers`: `status='ACTIVE'`
- Sorting: `sortOrder ASC`, `id DESC` across all three sections.
- Limits: fixed `limit=10` for each section.
- Logging: emits `req.log.info({ counts }, 'home:ok')` with section counts.

## Media uploads (S3)

Endpoint: `POST /uploads/presign` (ADMIN only)

Body:

```
{ "section":"hero|special|laptop", "filename":"banner.png", "contentType":"image/png" }
```

Response:

```
{
  "uploadUrl":"https://s3/...signed...",
  "publicUrl":"https://.../hero/2025/10/15/<uuid>-banner.png",
  "key":"hero/2025/10/15/<uuid>-banner.png",
  "expiresIn":300
}
```

Client flow:
- Call `/uploads/presign` to receive `uploadUrl`, `publicUrl`, and `key`.
- PUT the file to `uploadUrl` with header `Content-Type: <contentType>`.
- Use the returned `publicUrl` in subsequent Create/Update CMS calls.

Notes:
- Allowed content types: `image/png`, `image/jpeg`, `image/webp`.
- Max size: choose a client-side limit (e.g., 5MB) and enforce in UI.
- Keys are immutable; delete/replace via new upload if needed.

Environment variables required:
- `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE`.

Admin CMS endpoints accept `imageUrl`:
- `/admin/hero-banners` → `imageUrl` (string)
- `/admin/special-offers` → `imageUrl`, pricing fields
- `/admin/laptop-offers` → `imageUrl`, pricing fields

Client usage:
- Call `POST /uploads/presign` (ADMIN), then `PUT` the file to `uploadUrl`.
- Use returned `publicUrl` in `imageUrl` for create/update payloads.

### Route Map & Startup
- Routers mounted:
  - Protected: `/admin` with sub-routes: `/admin/hero-banners`, `/admin/special-offers`, `/admin/laptop-offers` (behind `requireAuth` + `requireAdmin`).
  - Public: `/hero-banners`, `/special-offers`, `/laptop-offers`, `/home`, `/cms`, `/healthz`.
- Startup prints route list via `express-list-endpoints` and `/__debug/routes` helper.


## Database Models

- **User** - System users (admin, agent, customer)
- **Shop** - Service locations
- **Agent** - Technicians linked to shops
- **Address** - Customer addresses
- **Request** - Service requests with status tracking
- **RequestEvent** - Request activity log
- **Timer** - Work time tracking
- **Feedback** - Customer feedback
- **Device** - Push notification devices
- **Banner** - Homepage banners with scheduling
- **Offer** - Promotional offers
- **Product** - Product catalog
- **SectionsConfig** - CMS display configuration

## Environment Variables

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/icon_backend?schema=public
PORT=8080
CORS_ORIGINS=*
```

## Development Notes

- Uses Pino for structured logging
- CORS configured for development
- Helmet for security headers
- Graceful shutdown handling
- Database connection pooling via Prisma

## Next Steps

This is a base setup with health checks and CMS endpoints. Additional features like authentication, business logic, and worker queues can be added as needed.
- Manual verification
  - Get an ADMIN token (Clerk or native JWT).
  - Presign:
    ```bash
    curl -X POST http://localhost:8080/uploads/presign \
      -H "Authorization: Bearer <ADMIN_JWT>" \
      -H "Content-Type: application/json" \
      -d '{"section":"hero","filename":"summer Sale.png","contentType":"image/png"}'
    ```
  - Upload:
    ```bash
    curl -X PUT "<uploadUrl from presign>" \
      -H "Content-Type: image/png" \
      --data-binary @./banner.png
    ```
  - Open the returned `publicUrl` in the browser; image should load.

## Environment Setup (dotenv-flow)

- Layered env files are loaded using `dotenv-flow`:
  - `.env` – common settings (DB, S3 region/bucket/public base, etc.)
  - `.env.development` – development defaults (not sensitive)
  - `.env.local` – developer overrides; do not commit

- Example `.env.development` defaults:
  - `NODE_ENV=development`
  - `PORT=8080`
  - `AUTH_MODE=native`
  - `JWT_SECRET=dev_secret_123`
  - `ADMIN_BOOTSTRAP_SECRET=bootstrap_123`

## Postman Testing (Native JWT)

- Ensure `.env.development` has `AUTH_MODE=native` and `JWT_SECRET` set. Optionally override in `.env.local`.
- Seed local admin (runs only in native mode): `npm run seed`
- Steps:
  - `POST /auth/admin/login` with body `{ "email":"admin@local.dev", "password":"Admin@123" }` → copy `token`
  - In Postman, set header `Authorization: Bearer <token>`
  - Call `GET /me` → should return admin profile
  - Call protected endpoints: `POST /uploads/presign`, `GET/POST /admin/*`, `GET /home`

## Tests

- Uses `supertest` to verify admin CRUD and aggregator behavior.
- Coverage:
  - Admin access control: non-admin (`x-role: USER`) → `403`.
  - Hero banners: invalid window (`validFrom ≥ validTo`) → `400`.
  - Special offers: `discountPercent` checked against computed value with ±1% tolerance on create and patch.
  - Home: enforces section limits via `take` and returns `200`.


## Auth Modes

- Native:
  - `requireAuth` verifies JWT using `JWT_SECRET`
  - `/auth/*` routes support register/login for users and admins
  - Seed creates `admin@local.dev` with password `Admin@123`
- Clerk:
  - `requireAuth` verifies Clerk JWT via JWKS and upserts users
  - `/auth/*` routes respond `405` with `{error:"Use Clerk"}`
  - No change to production Clerk flow

### Frontend Authentication Flow

For frontend teams integrating with this backend:

#### Clerk Mode (Production)
1. **Client Authentication**: Use Clerk's client SDK to authenticate users and obtain a JWT token
2. **Handshake**: Call `POST /auth/handshake` with `Authorization: Bearer <clerk_jwt>` to:
   - Verify the Clerk JWT
   - Perform idempotent user upsert in the database
   - Set default role as `USER` for new users
   - Update email/name on subsequent calls without changing role
   - Returns: `{ user: { id, email, role, name } }`
3. **User Profile**: Call `GET /me` with the same JWT to get the current user's database profile
4. **Protected Routes**: Include `Authorization: Bearer <clerk_jwt>` header for all protected API calls

#### Native Mode (Development)
1. **Registration/Login**: Use `/auth/user/register` or `/auth/user/login` to get a JWT token
2. **Handshake**: Call `POST /auth/handshake` with `Authorization: Bearer <native_jwt>` to verify token and get user info
3. **User Profile**: Call `GET /me` with the same JWT to get the current user's database profile
4. **Protected Routes**: Include `Authorization: Bearer <native_jwt>` header for all protected API calls

#### Admin Authorization
- Admin routes (`/admin/*`) require `ADMIN` role in addition to valid authentication
- Role changes can only be performed by existing admins via role management endpoints
- The `/auth/handshake` endpoint never changes existing user roles
## Database Setup (Local)

- Put `DATABASE_URL` in `icon-backend/.env` (Prisma CLI reads this file only). Do not change runtime layered envs (`.env.local`, `.env.development`). Example:
  - `DATABASE_URL=postgres://<user>:<pass>@<host>:<port>/<db_name>`
- Verify connectivity and migration status:
  - `npx prisma migrate status`
- Apply migrations and seed (non-destructive):
  - `npx prisma migrate dev`
  - `npx prisma db seed`
- Or do a clean reset (dev only, drops DB then re-applies and seeds):
  - `npx prisma migrate reset`
- Seeded admin (native auth):
  - `admin@local.dev` / `Admin@123`
  - In Clerk mode, the admin user row is still created with role `ADMIN` but without a password hash.
- Note: Prisma CLI loads from `.env`; your server runtime continues to use layered envs.

### Quick Verification (SQL)

- Run in your SQL tool against the same DB:
  - `SELECT current_database();`
  - `SELECT COUNT(*) AS users FROM users;`
  - `SELECT COUNT(*) AS heroes FROM hero_banners;`
  - `SELECT COUNT(*) AS specials FROM special_offers;`
  - `SELECT COUNT(*) AS laptops FROM laptop_offers;`
  - `SELECT id,email,role FROM users WHERE email='admin@local.dev';`
- Expect at least one `ADMIN` user and demo CMS rows if seeds are enabled.

### Health Check

- A basic health endpoint is available:
  - `GET /healthz` → `{"ok":true,"db":true}`
- It performs a trivial DB query via Prisma to confirm connectivity.