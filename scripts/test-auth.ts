/**
 * End-to-End Authentication and RBAC Test Script
 *
 * Tests:
 * 1. Unauthenticated requests to /api/workers return 401 Unauthorized
 * 2. Unauthenticated requests to / redirect to /login
 * 3. Logging in with seeded admin credentials returns a valid session with role: "ADMIN"
 * 4. Authenticated admin request to GET /api/workers succeeds (200)
 * 5. Authenticated admin request to POST /api/workers succeeds (201)
 * 6. Authenticated VIEWER request to GET /api/workers succeeds (200)
 * 7. Authenticated VIEWER request to POST /api/workers fails with 403 Forbidden
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

async function login(email: string, password: string): Promise<string> {
  // 1. Get CSRF token
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;

  const csrfCookies = csrfRes.headers.get("set-cookie") || "";

  // 2. Submit credentials to callback
  const params = new URLSearchParams();
  params.append("csrfToken", csrfToken);
  params.append("email", email);
  params.append("password", password);
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

  const setCookieHeader = loginRes.headers.get("set-cookie") || "";
  return setCookieHeader;
}

function extractCookieHeader(rawSetCookie: string): string {
  // Split multiple Set-Cookie headers and extract name=value
  return rawSetCookie
    .split(/,(?=\s*[^;]+=[^;]+)/)
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}

async function main() {
  console.log("================================================================");
  console.log("SUNDAY LEDGER — AUTHENTICATION & RBAC END-TO-END TEST");
  console.log("Target Server: " + BASE_URL);
  console.log("================================================================\n");

  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("Missing required SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD in environment.");
  }

  const viewerEmail = "test_viewer@sundayledger.com";
  const viewerPassword = "ViewerPassword123!";
  let testWorkerId: string | null = null;

  try {
    // -----------------------------------------------------------------
    // TEST 1: Unauthenticated requests return 401 on /api/*
    // -----------------------------------------------------------------
    console.log("TEST 1: Testing unauthenticated API access...");

    const unauthGet = await fetch(`${BASE_URL}/api/workers`);
    console.log(`  GET /api/workers -> Status: ${unauthGet.status}`);
    const unauthGetData = await unauthGet.json().catch(() => ({}));
    console.log(`  Response:`, unauthGetData);

    if (unauthGet.status !== 401) {
      throw new Error(`Expected status 401 for unauthenticated GET, got ${unauthGet.status}`);
    }

    const unauthPost = await fetch(`${BASE_URL}/api/workers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unauth Worker", monthlySalary: 30000, joinDate: "2026-09-01" }),
    });
    console.log(`  POST /api/workers -> Status: ${unauthPost.status}`);

    if (unauthPost.status !== 401) {
      throw new Error(`Expected status 401 for unauthenticated POST, got ${unauthPost.status}`);
    }
    console.log("  ✅ Unauthenticated API requests properly rejected with 401.\n");

    // -----------------------------------------------------------------
    // TEST 2: Unauthenticated web page request redirects to /login
    // -----------------------------------------------------------------
    console.log("TEST 2: Testing unauthenticated page access...");
    const unauthPage = await fetch(`${BASE_URL}/`, { redirect: "manual" });
    console.log(`  GET / -> Status: ${unauthPage.status}`);
    const location = unauthPage.headers.get("location") || "";
    console.log(`  Redirect Location: ${location}`);

    if (!location.includes("/login")) {
      throw new Error(`Expected redirect to /login, got location: ${location}`);
    }
    console.log("  ✅ Unauthenticated page access properly redirected to /login.\n");

    // -----------------------------------------------------------------
    // TEST 3: Login with Seeded Admin Credentials
    // -----------------------------------------------------------------
    console.log(`TEST 3: Logging in with seeded admin credentials (${adminEmail})...`);
    const adminSetCookie = await login(adminEmail, adminPassword);
    const adminCookie = extractCookieHeader(adminSetCookie);

    if (!adminCookie.includes("next-auth.session-token")) {
      throw new Error(`Failed to obtain next-auth.session-token from login response. Set-Cookie: ${adminSetCookie}`);
    }
    console.log("  ✓ Successfully authenticated and received session token cookie.");

    // Verify session via NextAuth endpoint
    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: adminCookie },
    });
    const sessionData = await sessionRes.json();
    console.log("  ✓ /api/auth/session returned:", sessionData);

    if (!sessionData.user || sessionData.user.role !== "ADMIN") {
      throw new Error(`Expected session user role to be ADMIN, got ${sessionData?.user?.role}`);
    }
    console.log("  ✅ Validated active session with role: ADMIN.\n");

    // -----------------------------------------------------------------
    // TEST 4: Admin Access to Protected Routes
    // -----------------------------------------------------------------
    console.log("TEST 4: Testing Admin access to GET and POST /api/workers...");

    const adminGet = await fetch(`${BASE_URL}/api/workers`, {
      headers: { Cookie: adminCookie },
    });
    console.log(`  GET /api/workers with admin session -> Status: ${adminGet.status}`);
    const workersList = await adminGet.json();
    console.log(`  ✓ Retrieved ${workersList.length} workers successfully.`);

    const adminPost = await fetch(`${BASE_URL}/api/workers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie,
      },
      body: JSON.stringify({
        name: "TEST_Auth_Admin_Worker",
        monthlySalary: 35000,
        joinDate: "2026-09-01",
      }),
    });
    console.log(`  POST /api/workers with admin session -> Status: ${adminPost.status}`);
    const createdWorker = await adminPost.json();
    console.log("  ✓ Created worker:", createdWorker);
    testWorkerId = createdWorker.id;

    if (adminPost.status !== 201) {
      throw new Error(`Expected status 201 for admin POST, got ${adminPost.status}`);
    }
    console.log("  ✅ Admin user successfully read and created worker data.\n");

    // -----------------------------------------------------------------
    // TEST 5: VIEWER Role Authorization (200 on GET, 403 on POST)
    // -----------------------------------------------------------------
    console.log("TEST 5: Testing VIEWER role permissions (Read OK, Write Forbidden)...");

    // Create a temporary VIEWER user
    const viewerHash = await bcrypt.hash(viewerPassword, 10);
    await prisma.user.upsert({
      where: { email: viewerEmail },
      update: { role: "VIEWER", passwordHash: viewerHash },
      create: {
        name: "Test Viewer",
        email: viewerEmail,
        passwordHash: viewerHash,
        role: "VIEWER",
      },
    });

    const viewerSetCookie = await login(viewerEmail, viewerPassword);
    const viewerCookie = extractCookieHeader(viewerSetCookie);

    // Verify viewer session
    const viewerSessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: viewerCookie },
    });
    const viewerSession = await viewerSessionRes.json();
    console.log("  ✓ VIEWER session verified:", viewerSession?.user);

    if (viewerSession?.user?.role !== "VIEWER") {
      throw new Error(`Expected role VIEWER, got ${viewerSession?.user?.role}`);
    }

    // 1. Viewer GET should SUCCEED (200)
    const viewerGet = await fetch(`${BASE_URL}/api/workers`, {
      headers: { Cookie: viewerCookie },
    });
    console.log(`  GET /api/workers as VIEWER -> Status: ${viewerGet.status}`);
    if (viewerGet.status !== 200) {
      throw new Error(`Expected status 200 for viewer GET, got ${viewerGet.status}`);
    }
    console.log("  ✓ VIEWER allowed to read data (200 OK).");

    // 2. Viewer POST should FAIL with 403 Forbidden
    const viewerPost = await fetch(`${BASE_URL}/api/workers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: viewerCookie,
      },
      body: JSON.stringify({
        name: "TEST_Forbidden_Worker",
        monthlySalary: 20000,
        joinDate: "2026-09-01",
      }),
    });
    console.log(`  POST /api/workers as VIEWER -> Status: ${viewerPost.status}`);
    const viewerPostData = await viewerPost.json();
    console.log(`  Response:`, viewerPostData);

    if (viewerPost.status !== 403) {
      throw new Error(`Expected status 403 for viewer POST, got ${viewerPost.status}`);
    }
    console.log("  ✅ Write access properly blocked for VIEWER with 403 Forbidden.\n");

    console.log("================================================================");
    console.log("🎉 ALL AUTHENTICATION & RBAC TESTS PASSED SUCCESSFULLY!");
    console.log("- Unauthenticated API returns 401: YES");
    console.log("- Unauthenticated page redirects to /login: YES");
    console.log("- Admin login & session role: ADMIN: YES");
    console.log("- Admin GET / POST success: YES");
    console.log("- Viewer GET allowed (200): YES");
    console.log("- Viewer POST forbidden (403): YES");
    console.log("================================================================");
  } finally {
    // Cleanup
    if (testWorkerId) {
      await prisma.worker.delete({ where: { id: testWorkerId } }).catch(() => {});
    }
    await prisma.user.delete({ where: { email: viewerEmail } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\n❌ Test failed with error:", err);
  process.exit(1);
});
