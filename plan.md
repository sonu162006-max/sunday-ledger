# Sunday Ledger — Build Plan & Roadmap

A Next.js 14 (App Router) payroll and attendance ledger system with PostgreSQL and Prisma ORM, implementing strict Sunday pay rules.

---

## Architecture Overview

- **Framework**: Next.js 14 (App Router, Server Components & Server Actions)
- **Database**: PostgreSQL 18 with Prisma ORM
- **Authentication**: NextAuth.js (Credentials Provider + bcrypt)
- **Design System**: Tailwind CSS (light & dark mode compliant)
- **Salary Engine**: Pure deterministic domain function (`lib/salary.ts`)

---

## Domain Rules Summary

- **Daily rate** = `monthlySalary / 30`.
- **Holidays** (`Holiday` table is the sole source of truth): A holiday is a paid day regardless of attendance and is never counted as a "present day"; counted separately as `paidHolidays`.
- **Sundays** (not holidays): Paid ONLY IF there is a `PRESENT` record for the preceding Saturday OR the following Monday. If both are `ABSENT` or have no record at all, the Sunday is unpaid.
  - Exception: If a worker has no attendance records at all for the entire month, they default to fully present, all paid.
- **Mon-Sat** (not holidays): Explicit `ABSENT` record = unpaid. `PRESENT` or no record at all = paid `presentDays`.
- **Month Boundaries**: Preceding Saturday or following Monday in a different month is treated as "no record" (safe default).

---

## Build Phases

### Phase 1: Scaffolding & Foundation ✅ (Completed)
- [x] Next.js 14 + TypeScript + Tailwind CSS configured.
- [x] Simplified Prisma schema configured for PostgreSQL (`User`, `Worker`, `Attendance`, `Holiday`, `SalaryReport`, `SalaryReportLine`).
- [x] Initial database migration applied cleanly to PostgreSQL (`sunday_ledger`).
- [x] Pure salary calculation engine implemented in `lib/salary.ts`.
- [x] Comprehensive test suite in `lib/salary.test.ts` covering all 9 mandatory edge cases (100% passing).
- [x] Folder structure scaffolded for `workers`, `attendance`, `holidays`, `salary-reports`, and `auth`.

### Phase 2: Authentication & Access Control
- [ ] User seed script (initial ADMIN user creation with bcrypt hashed password).
- [ ] NextAuth configuration in `src/lib/auth.ts` and route handler `src/app/api/auth/[...nextauth]/route.ts`.
- [ ] Login screen (`src/app/(auth)/login/page.tsx`) with form validation and session feedback.
- [ ] Role-based authorization middleware protecting dashboard routes (`ADMIN` vs `VIEWER`).

### Phase 3: Worker Directory Module
- [ ] Worker schema queries & mutations (Server Actions):
  - Add new worker (Name, Monthly Salary, Join Date).
  - Edit worker details / Toggle active status.
  - Search and filter active/inactive workers.
- [ ] Workers UI:
  - Worker cards & searchable table with monthly wage display.
  - Add/Edit worker modal dialog.

### Phase 4: Attendance Tracking Module
- [ ] Attendance recording (Server Actions):
  - Bulk daily attendance marking (`PRESENT` vs `ABSENT`).
  - Single-worker date toggle.
- [ ] Attendance UI:
  - Interactive monthly attendance grid per worker.
  - Visual distinction between Present, Absent, Sunday, and Holiday dates.
  - Date navigator (month/year selector).

### Phase 5: Holidays Management Module
- [ ] Holiday registry (Server Actions):
  - Add holiday (Date, Name).
  - Delete holiday.
  - Unique constraint validation on date.
- [ ] Holiday UI:
  - Calendar/list view of all company holidays.
  - Indicator showing day of week and overlap with Sundays.

### Phase 6: Salary Calculation & Reports Engine
- [ ] Salary Report Generation:
  - Execute `computeWorkerSalary` for all active workers for a selected month (`YYYY-MM`).
  - Store summary in `SalaryReport` and line items in `SalaryReportLine`.
  - Re-generate / lock report functionality.
- [ ] Reports UI:
  - Summary table showing `presentDays`, `paidSundays`, `paidHolidays`, `totalPaidDays`, and `salaryAmount`.
  - Individual worker payslip modal (printable breakdown).
  - CSV / PDF export option.

### Phase 7: UI Polish, Dashboards & Metric Cards
- [ ] Real-time overview metrics: Active Workers, Today's Attendance %, Month-to-Date Payroll Expense.
- [ ] Responsive navigation sidebar and mobile drawer.
- [ ] End-to-end user acceptance testing and production build verification.
