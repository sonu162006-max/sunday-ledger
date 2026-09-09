/**
 * Security Verification Script:
 * 1. Confirms unauthenticated request to POST /api/workers/bulk returns 401.
 * 2. Confirms VIEWER request to POST /api/workers/bulk returns 403.
 * 3. Confirms ADMIN request to POST /api/workers/bulk succeeds with 201.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

async function getSessionCookie(email: string, pass: string): Promise<string> {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const csrfCookies = csrfRes.headers.get("set-cookie") || "";

  const params = new URLSearchParams();
  params.append("csrfToken", csrfToken);
  params.append("email", email);
  params.append("password", pass);
  params.append("redirect", "false");
  params.append("json", "true");

  const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: csrfCookies,
    },
    body: params.toString(),
    redirect: "manual",
  });

  const rawSetCookie = loginRes.headers.get("set-cookie") || "";
  return rawSetCookie
    .split(/,(?=\s*[^;]+=[^;]+)/)
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}

async function main() {
  console.log("================================================================");
  console.log("SECURITY VERIFICATION: POST /api/workers/bulk RBAC & AUTH TEST");
  console.log("================================================================\n");

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD in environment.");
  }

  // Ensure a test viewer exists
  const viewerEmail = "sec_viewer_test@sundayledger.com";
  const viewerPassword = "ViewerPassword123!";
  const viewerHash = await bcrypt.hash(viewerPassword, 10);

  await prisma.user.upsert({
    where: { email: viewerEmail },
    create: {
      name: "Security Viewer Test",
      email: viewerEmail,
      passwordHash: viewerHash,
      role: "VIEWER",
    },
    update: {
      passwordHash: viewerHash,
      role: "VIEWER",
    },
  });

  // TEST 1: Unauthenticated request to POST /api/workers/bulk
  console.log("TEST 1: Calling POST /api/workers/bulk WITHOUT authentication...");
  const unauthRes = await fetch(`${BASE_URL}/api/workers/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workers: [
        { name: "Unauth Worker", monthlySalary: 30000, joinDate: "2026-01-01" },
      ],
    }),
  });

  console.log(`  Response status: ${unauthRes.status}`);
  const unauthBody = await unauthRes.json().catch(() => ({}));
  console.log(`  Response body:`, unauthBody);

  if (unauthRes.status !== 401) {
    throw new Error(`FAIL: Expected 401 Unauthorized, received ${unauthRes.status}`);
  }
  console.log("  ✅ PASS: Unauthenticated request returned 401 Unauthorized.\n");

  // TEST 2: VIEWER request to POST /api/workers/bulk
  console.log("TEST 2: Calling POST /api/workers/bulk with VIEWER role session...");
  const viewerCookie = await getSessionCookie(viewerEmail, viewerPassword);
  const viewerRes = await fetch(`${BASE_URL}/api/workers/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: viewerCookie,
    },
    body: JSON.stringify({
      workers: [
        { name: "Viewer Worker", monthlySalary: 30000, joinDate: "2026-01-01" },
      ],
    }),
  });

  console.log(`  Response status: ${viewerRes.status}`);
  const viewerBody = await viewerRes.json().catch(() => ({}));
  console.log(`  Response body:`, viewerBody);

  if (viewerRes.status !== 403) {
    throw new Error(`FAIL: Expected 403 Forbidden, received ${viewerRes.status}`);
  }
  console.log("  ✅ PASS: Non-admin (VIEWER) request returned 403 Forbidden.\n");

  // TEST 3: ADMIN request to POST /api/workers/bulk
  console.log("TEST 3: Calling POST /api/workers/bulk with ADMIN role session...");
  const adminCookie = await getSessionCookie(adminEmail, adminPassword);
  const adminRes = await fetch(`${BASE_URL}/api/workers/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      workers: [
        { name: "SEC_TEST_Admin_Worker", monthlySalary: 35000, joinDate: "2026-01-01" },
      ],
    }),
  });

  console.log(`  Response status: ${adminRes.status}`);
  const adminBody = await adminRes.json().catch(() => ({}));
  console.log(`  Response body:`, adminBody);

  if (adminRes.status !== 201 || !adminBody.success) {
    throw new Error(`FAIL: Expected 201 Created with success: true, received ${adminRes.status}`);
  }
  console.log("  ✅ PASS: Admin request succeeded with 201 Created.\n");

  // Cleanup test records
  await prisma.worker.deleteMany({
    where: { name: "SEC_TEST_Admin_Worker" },
  });
  await prisma.user.deleteMany({
    where: { email: viewerEmail },
  });

  console.log("All security verification tests PASSED.");
}

main()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
