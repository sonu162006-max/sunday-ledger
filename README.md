# Sunday Ledger — Industrial Payroll & Attendance Management

A high-performance, ledger-styled payroll and attendance management platform built with Next.js 14 App Router, PostgreSQL, Prisma ORM, NextAuth, and Tailwind CSS. Designed specifically for industrial workforces with complex Indian payroll regulations and automated Sunday wage eligibility calculations.

---

## Architecture Overview

- **Framework**: Next.js 14 (App Router, Server Components & Route Handlers)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication & RBAC**: NextAuth (JWT session strategy, bcrypt hashing, ADMIN / VIEWER roles)
- **Styling**: Tailwind CSS with custom ledger aesthetic (sharp borders, gold accents, tabular typography)
- **Performance**: High-throughput parameterized raw SQL bulk upserts, chunked batching, composite indexing tested with 1,000+ workers and 30,000+ monthly records.

---

## Quick Navigation

1. [Local Development Setup](#local-development-setup)
2. [Environment Variables Reference](#environment-variables-reference)
3. [Database Migrations & Seeding](#database-migrations--seeding)
4. [Neon PostgreSQL vs. Supabase (Why Neon?)](#neon-postgresql-vs-supabase-why-neon)
5. [Serverless Connection Pooling Architecture](#serverless-connection-pooling-architecture)
6. [Data Retention & Backup Considerations (Neon Free Tier)](#data-retention--backup-considerations-neon-free-tier)
7. [Step-by-Step Production Deployment Checklist (Vercel + Neon)](#step-by-step-production-deployment-checklist-vercel--neon)
8. [Testing & Verification](#testing--verification)

---

## Local Development Setup

### Prerequisites

- **Node.js**: v18.18.0 or v20.x+
- **PostgreSQL**: v14+ running locally or in Docker
- **Git**

### Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url> sunday-ledger
   cd sunday-ledger
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
   *(Note: The `postinstall` script will automatically trigger `prisma generate`).*

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your local database credentials and desired seed admin credentials.

4. **Run Migrations & Seed Database**:
   ```bash
   npx prisma migrate deploy
   npm run seed
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables Reference

Sunday Ledger requires the following environment variables:

| Variable | Description | Example (Local Dev) | Example (Production / Neon) |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Pooled connection string used by Prisma Client for all runtime queries. In production, use Neon's `-pooler` host with `?pgbouncer=true`. | `postgresql://postgres:password@localhost:5432/sunday_ledger?schema=public` | `postgresql://user:pass@ep-xyz-pooler.region.neon.tech/neondb?sslmode=require&pgbouncer=true&connect_timeout=15` |
| `DIRECT_URL` | Direct unpooled connection string used exclusively by Prisma CLI for DDL migrations (`prisma migrate deploy`). | `postgresql://postgres:password@localhost:5432/sunday_ledger?schema=public` | `postgresql://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require` |
| `NEXTAUTH_SECRET` | Cryptographically random secret used to sign and encrypt JWT session cookies. | Generated random 32-byte string | Generated via `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical public URL of the application. | `http://localhost:3000` | `https://your-app.vercel.app` |
| `SEED_ADMIN_EMAIL` | Email address for the initial bootstrapped administrator user. | `admin@sundayledger.com` | `admin@yourcompany.com` |
| `SEED_ADMIN_PASSWORD` | Initial password for the bootstrapped administrator user. | `YourSecurePassword123!` | Strong random secret (keep confidential) |

> [!CAUTION]
> Never commit `.env` or `.env.local` to Git. Ensure `.gitignore` is active before committing any code.

---

## Database Migrations & Seeding

The database schema is managed via Prisma migrations located in `prisma/migrations/`:
- `20260907000000_init_simplified_schema`: Core tables (`User`, `Worker`, `Attendance`, `Holiday`, `SalaryReport`, `SalaryReportLine`).
- `20260909081702_add_perf_indexes`: Performance composite and single-column indexes for high-throughput filtering.

### Commands

- **Apply pending migrations in production or CI/CD**:
  ```bash
  npx prisma migrate deploy
  ```
- **Seed initial admin user**:
  ```bash
  npm run seed
  ```
  *(Note: The seed script requires both `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in your environment. It exits with a non-zero error if either is omitted, preventing deployment with insecure default credentials).*

---

## Neon PostgreSQL vs. Supabase (Why Neon?)

For deploying Sunday Ledger to Vercel, **Neon Serverless PostgreSQL** is selected over Supabase for the following key reasons:

1. **No Inactivity Pausing**:
   - **Supabase Free Tier** automatically pauses projects after 7 days of inactivity. An internal office payroll application accessed primarily at month-end would be paused repeatedly, resulting in 500 errors until an administrator manually logs into Supabase to unpause.
   - **Neon Free Tier** never pauses. Instead, it scales compute to zero when idle and seamlessly wakes up in ~500ms upon receiving an incoming query.
2. **Native Built-in PgBouncer Connection Pooling**:
   - Neon provides a dedicated pooled endpoint (`-pooler` hostname) out of the box. In Vercel's serverless environment where hundreds of transient functions may run concurrently, this prevents PostgreSQL connection exhaustion.
3. **Dual-Endpoint Architecture for Prisma**:
   - Neon provides both a pooled URL (`DATABASE_URL`) and a direct URL (`DIRECT_URL`) side by side, allowing Prisma to execute DDL migrations requiring advisory locks while routing runtime queries through PgBouncer.
4. **Clean Focus**:
   - Sunday Ledger implements its own authentication (NextAuth), RBAC, and business logic. Neon provides pure, standard PostgreSQL without unnecessary bundled services.

---

## Serverless Connection Pooling Architecture

In a standard Node.js server, a single database connection pool is shared across all requests. However, in **Vercel's Serverless Function environment**, every API request can spawn a distinct isolated container. If 50 concurrent requests arrive, 50 distinct instances could attempt to open direct database connections, quickly exceeding standard PostgreSQL connection limits (typically 20–100 connections on standard tiers).

```
+------------------------+      +------------------------+
| Vercel Function (Warm) |      | Vercel Function (Cold) |
+------------------------+      +------------------------+
            \                               /
             \                             /
              v                           v
     +---------------------------------------------+
     |   Neon Built-in PgBouncer Connection Pool   |
     |            (-pooler endpoint)               |
     +---------------------------------------------+
                            |
                     (Reused Pipes)
                            v
     +---------------------------------------------+
     |         Neon PostgreSQL Engine Core         |
     +---------------------------------------------+
```

### How Sunday Ledger Solves This:
1. **Prisma Client Singleton (`src/lib/prisma.ts`)**: Reuses the Prisma client instance across function invocations within the same container lifecycle.
2. **Neon PgBouncer Connection Pooler (`DATABASE_URL`)**: Application queries connect through Neon's PgBouncer pooler endpoint, which multiplexes serverless connections over a small set of persistent database sessions.
3. **Dedicated Migration Channel (`DIRECT_URL`)**: Prisma migrations (`prisma migrate deploy`) bypass the connection pooler and connect directly to PostgreSQL, ensuring compatibility with PostgreSQL transaction advisory locks.

---

## Data Retention & Backup Considerations (Neon Free Tier)

> [!IMPORTANT]
> **Payroll Data Protection Notice**:
> - **Neon Free Tier Point-in-Time Restore (PITR)**: Neon's free tier provides point-in-time restore (time travel) with a retention window of **24 hours**.
> - **Monthly Payroll Cycles**: Because payroll records and monthly reports are critical financial records that span months and years, relying solely on a 24-hour PITR window carries risk if accidental deletions or schema changes go unnoticed for more than a day.
> - **Recommendations**:
>   1. **Export Monthly Reports**: Use Sunday Ledger's built-in CSV export features at the end of each payroll run to keep external offline backups.
>   2. **Automate Logical Dumps**: For automated disaster recovery, schedule regular `pg_dump` backups (e.g. to AWS S3 or Google Cloud Storage via GitHub Actions or cron).
>   3. **Evaluate Neon Pro Tier**: If automated 30-day point-in-time restore and higher storage limits are required as the workforce scales, consider upgrading to Neon Pro.

---

## Step-by-Step Production Deployment Checklist (Vercel + Neon)

Follow this precise checklist to deploy Sunday Ledger to production.

### Phase 1: Set Up Neon Managed PostgreSQL

1. **Sign Up / Log In**:
   - Go to [neon.tech](https://neon.tech) and create a free account (you can sign in with GitHub).
2. **Create a Project**:
   - Click **"Create Project"**.
   - Name your project (e.g. `sunday-ledger-prod`).
   - Select your database region (choose the region closest to your Vercel deployment region, e.g., `AWS us-east-1` or `AWS us-east-2`).
   - Click **"Create Project"**.
3. **Obtain Connection Strings**:
   - On the Neon Dashboard, locate the **Connection Details** card.
   - Ensure the toggle for **"Pooled connection"** is enabled.
   - Copy the pooled connection string. This is your **`DATABASE_URL`**.
     *(Tip: Append `&pgbouncer=true&connect_timeout=15` to the end of the query parameters if not already present).*
   - Toggle off **"Pooled connection"** or check the **"Direct connection"** tab to copy the unpooled connection string. This is your **`DIRECT_URL`**.

---

### Phase 2: Push Repository to GitHub

1. **Initialize Git (if not already done)**:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit with production configuration"
   ```
2. **Confirm `.gitignore` Protection**:
   - Ensure `.env` is NOT tracked:
     ```bash
     git status
     ```
     Confirm that `.env` does not appear in tracked files.
3. **Push to your GitHub repository**:
   ```bash
   git remote add origin https://github.com/<your-username>/sunday-ledger.git
   git branch -M main
   git push -u origin main
   ```

---

### Phase 3: Run Initial Migrations & Seed Admin on Neon

Before deploying to Vercel, initialize the tables and the first administrator on your Neon database from your local machine:

1. **Temporarily apply Neon credentials to run migrations**:
   Run the migration command pointing to your Neon `DIRECT_URL`:
   ```bash
   DIRECT_URL="postgresql://neondb_owner:YOUR_NEON_PASSWORD@ep-sample.region.neon.tech/neondb?sslmode=require" npx prisma migrate deploy
   ```
2. **Seed the initial admin user**:
   Run the seed script pointing to your Neon database:
   ```bash
   DATABASE_URL="postgresql://neondb_owner:YOUR_NEON_PASSWORD@ep-sample-pooler.region.neon.tech/neondb?sslmode=require&pgbouncer=true" SEED_ADMIN_EMAIL="admin@yourcompany.com" SEED_ADMIN_PASSWORD="YourStrongAdminPassword123!" npm run seed
   ```
   *(Verify you see: `✅ Admin user seeded successfully!`)*.

---

### Phase 4: Deploy on Vercel

1. **Log in to Vercel**:
   - Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
2. **Import Project**:
   - Click **"Add New..."** -> **"Project"**.
   - Select the `sunday-ledger` repository and click **"Import"**.
3. **Configure Project Settings**:
   - **Framework Preset**: Next.js (detected automatically).
   - **Root Directory**: `./` (default).
   - **Build Command**: `npm run build` (or leave default; Vercel automatically runs `prisma generate && next build` via package.json).
   - **Install Command**: `npm install` (runs `postinstall: prisma generate`).
4. **Add Environment Variables**:
   In the **Environment Variables** section, enter the following:

   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `DATABASE_URL` | *Your Neon Pooled Connection String* | Includes `-pooler` hostname + `?sslmode=require&pgbouncer=true&connect_timeout=15` |
   | `DIRECT_URL` | *Your Neon Direct Connection String* | Non-pooled hostname for migrations |
   | `NEXTAUTH_SECRET` | *32-character random string* | Generated via `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | `https://your-project.vercel.app` | Use your assigned Vercel URL (or update after first deploy) |
   | `SEED_ADMIN_EMAIL` | `admin@yourcompany.com` | Used for bootstrap consistency |
   | `SEED_ADMIN_PASSWORD` | `YourStrongAdminPassword123!` | Used for bootstrap consistency |

5. **Deploy**:
   - Click **"Deploy"**.
   - Vercel will build the project and deploy the application.

---

### Phase 5: Post-Deployment Verification & Security Notice

1. **Verify Deployment**:
   - Navigate to your production URL (`https://your-project.vercel.app`).
   - You should be automatically redirected to `/login`.
2. **Log In with Admin Account**:
   - Sign in using `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.
   - Confirm access to the Overview dashboard, Workers, Attendance, Holidays, and Salary Reports pages.

> [!CAUTION]
> **Admin Password Security Notice**:
> Immediately upon logging into production, note that because Sunday Ledger currently does not have a self-service in-app "Change Password" UI, your admin account password remains the value supplied in `SEED_ADMIN_PASSWORD`.
> - Treat the password in `SEED_ADMIN_PASSWORD` as highly sensitive. Store it securely in your company password manager.
> - Do NOT share admin credentials over unencrypted channels.
> - A dedicated user management / self-service password update screen is recommended for a future release.

---

## Testing & Verification

Sunday Ledger includes an automated test suite and strict type checking:

- **Run TypeScript Typecheck**:
  ```bash
  npx tsc --noEmit
  ```
- **Run Sunday Adjacency Rule Unit Tests**:
  ```bash
  npm test
  ```
  *(Verifies all 11 core payroll calculation scenarios, including holiday overrides, Saturday/Monday adjacency, mid-month joining, and edge cases).*
- **Validate Prisma Schema**:
  ```bash
  npx prisma validate
  ```
- **Test Production Build Locally**:
  ```bash
  npm run build
  ```

---

## License

Private & Confidential — Malani Industrial Enterprises.
