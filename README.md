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

## Auth Modes

- Native:
  - `requireAuth` verifies JWT using `JWT_SECRET`
  - `/auth/*` routes support register/login for users and admins
  - Seed creates `admin@local.dev` with password `Admin@123`
- Clerk:
  - `requireAuth` verifies Clerk JWT via JWKS and upserts users
  - `/auth/*` routes respond `405` with `{error:"Use Clerk"}`
  - No change to production Clerk flow