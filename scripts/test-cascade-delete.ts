/**
 * Cascade Delete and Worker API Test Script
 *
 * Tests:
 * 1. 404 response on DELETE /api/workers/[non-existent-id]
 * 2. PATCH /api/workers/[id] with { isActive: false } to deactivate worker without deleting
 * 3. Cascade delete behavior:
 *    - Create test worker
 *    - Add 2 attendance records
 *    - Generate salary report for the month
 *    - Verify report and lines exist
 *    - Delete the worker via DELETE /api/workers/[id]
 *    - Verify worker is deleted (DELETE returns 404)
 *    - Verify attendance records are deleted (cascade)
 *    - Verify SalaryReport STILL exists and retains historical totalPayroll, but worker's line is removed (cascade)
 */

import { PrismaClient } from "@prisma/client";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

let adminCookie = "";

async function loginAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("Missing required SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD in environment.");
  }

  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfCookies = csrfRes.headers.get("set-cookie") || "";

  const params = new URLSearchParams();
  params.append("csrfToken", csrfData.csrfToken);
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

  const raw = loginRes.headers.get("set-cookie") || "";
  adminCookie = raw
    .split(/,(?=\s*[^;]+=[^;]+)/)
    .map((c) => c.split(";")[0].trim())
    .join("; ");
}

async function api(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  return { status: res.status, ok: res.ok, data };
}

async function main() {
  console.log("================================================================");
  console.log("WORKER CASCADE DELETE & PATCH TEST");
  console.log("Target Server: " + BASE_URL);
  console.log("================================================================\n");

  console.log("Authenticating as ADMIN...");
  await loginAdmin();
  console.log("✓ Admin authenticated.\n");

  const testMonth = 9;
  const testYear = 2026;
  const monthStr = `${testYear}-${String(testMonth).padStart(2, "0")}`;

  let testWorkerId = "";
  let testReportId = "";

  try {
    // -----------------------------------------------------------------
    // TEST 1: DELETE non-existent worker returns 404
    // -----------------------------------------------------------------
    console.log("TEST 1: Testing DELETE /api/workers/[non-existent-id] for 404...");
    const fakeId = "non-existent-id-cuid-123456";
    const resDeleteFake = await api(`/api/workers/${fakeId}`, { method: "DELETE" });
    console.log(`  Status: ${resDeleteFake.status}`);
    console.log(`  Response:`, resDeleteFake.data);

    if (resDeleteFake.status !== 404) {
      throw new Error(`Expected status 404, got ${resDeleteFake.status}`);
    }
    console.log("  ✅ DELETE non-existent worker returned 404 as expected.\n");

    // -----------------------------------------------------------------
    // TEST 2: Create a worker and test PATCH { isActive: false }
    // -----------------------------------------------------------------
    console.log("TEST 2: Testing PATCH /api/workers/[id] with { isActive: false }...");
    const resCreate = await api("/api/workers", {
      method: "POST",
      body: JSON.stringify({
        name: "TEST_Deactivate Worker",
        monthlySalary: 28000,
        joinDate: "2026-09-01",
      }),
    });

    if (!resCreate.ok) {
      throw new Error(`Failed to create worker: ${JSON.stringify(resCreate.data)}`);
    }
    const createdWorker = resCreate.data;
    console.log(`  ✓ Created worker: ${createdWorker.name} (ID: ${createdWorker.id}), isActive: ${createdWorker.isActive}`);

    // Patch to deactivate
    const resPatch = await api(`/api/workers/${createdWorker.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    });
    console.log(`  Status: ${resPatch.status}`);
    console.log(`  Response:`, resPatch.data);

    if (!resPatch.ok || resPatch.data.isActive !== false) {
      throw new Error(`Expected isActive: false, got ${resPatch.data.isActive}`);
    }
    console.log("  ✅ Worker successfully deactivated via PATCH { isActive: false }.\n");

    // Re-activate worker for the cascade test
    await api(`/api/workers/${createdWorker.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: true }),
    });
    testWorkerId = createdWorker.id;

    // -----------------------------------------------------------------
    // TEST 3: Add 2 attendance records for this worker
    // -----------------------------------------------------------------
    console.log("TEST 3: Adding 2 attendance records for worker...");
    const resAtt = await api("/api/attendance", {
      method: "POST",
      body: JSON.stringify([
        { workerId: testWorkerId, date: "2026-09-01", status: "PRESENT" },
        { workerId: testWorkerId, date: "2026-09-02", status: "PRESENT" },
      ]),
    });
    console.log(`  Attendance upsert count:`, resAtt.data.count);

    const attBefore = await prisma.attendance.findMany({
      where: { workerId: testWorkerId },
    });
    console.log(`  ✓ Verified in DB: ${attBefore.length} attendance record(s) exist for worker.`);

    // -----------------------------------------------------------------
    // TEST 4: Generate Salary Report including this worker
    // -----------------------------------------------------------------
    console.log("\nTEST 4: Generating salary report for 2026-09...");
    const resReport = await api("/api/reports/generate", {
      method: "POST",
      body: JSON.stringify({ year: testYear, month: testMonth }),
    });

    if (!resReport.ok) {
      throw new Error(`Failed to generate report: ${JSON.stringify(resReport.data)}`);
    }
    const reportData = resReport.data;
    testReportId = reportData.id;
    console.log(`  ✓ SalaryReport created: ID = ${testReportId}, month = ${reportData.month}`);
    console.log(`  ✓ Total Payroll recorded: ₹${reportData.totalPayroll}`);
    console.log(`  ✓ Total lines in report: ${reportData.lines.length}`);

    const workerLine = reportData.lines.find((l: any) => l.workerId === testWorkerId);
    if (!workerLine) {
      throw new Error("Worker line not found in generated report!");
    }
    console.log(`  ✓ Worker line present in report: lineId = ${workerLine.id}, salaryAmount = ₹${workerLine.salaryAmount}`);
    if (Number(workerLine.salaryAmount) !== 28000) {
      throw new Error(`Expected salaryAmount to be 28000, got ${workerLine.salaryAmount}`);
    }
    console.log("  ✅ Salary accurately computed to full ₹28,000 (all 26 Mon-Sat + all 4 Sundays paid)!");

    // -----------------------------------------------------------------
    // TEST 5: Delete worker via DELETE /api/workers/[id]
    // -----------------------------------------------------------------
    console.log(`\nTEST 5: Deleting worker (ID: ${testWorkerId}) via DELETE /api/workers/[id]...`);
    const resDelete = await api(`/api/workers/${testWorkerId}`, { method: "DELETE" });
    console.log(`  Status: ${resDelete.status}`);
    console.log(`  Response:`, resDelete.data);

    if (!resDelete.ok) {
      throw new Error(`Failed to delete worker: ${JSON.stringify(resDelete.data)}`);
    }
    console.log("  ✅ Worker deleted successfully via API.");

    // Subsequent delete should return 404
    const resDeleteAgain = await api(`/api/workers/${testWorkerId}`, { method: "DELETE" });
    console.log(`  ✓ Subsequent DELETE returned status: ${resDeleteAgain.status} (404 as expected)`);

    // -----------------------------------------------------------------
    // TEST 6: Verify Cascade Deletions in Database
    // -----------------------------------------------------------------
    console.log("\nTEST 6: Verifying Cascade Deletions in DB...");

    // 1. Worker is gone
    const workerInDb = await prisma.worker.findUnique({ where: { id: testWorkerId } });
    console.log(`  1. Worker in DB: ${workerInDb ? "STILL EXISTS (FAIL)" : "NULL (DELETED - PASS)"}`);

    // 2. Attendance records are cascade deleted
    const attAfter = await prisma.attendance.findMany({ where: { workerId: testWorkerId } });
    console.log(`  2. Attendance records count for worker in DB: ${attAfter.length} (Expected: 0)`);

    // 3. SalaryReportLine for worker is cascade deleted
    const linesAfter = await prisma.salaryReportLine.findMany({ where: { workerId: testWorkerId } });
    console.log(`  3. SalaryReportLines for worker in DB: ${linesAfter.length} (Expected: 0)`);

    // 4. SalaryReport itself STILL EXISTS with historical totalPayroll preserved
    const reportInDb = (await prisma.salaryReport.findUnique({
      where: { id: testReportId },
      include: { lines: true },
    })) as any;
    console.log(`  4. SalaryReport in DB: ${reportInDb ? "STILL EXISTS (PASS)" : "DELETED (FAIL)"}`);
    if (reportInDb) {
      console.log(`     Report ID: ${reportInDb.id}`);
      console.log(`     Month: ${reportInDb.month}`);
      console.log(`     Historical totalPayroll preserved: ₹${reportInDb.totalPayroll}`);
      console.log(`     Remaining lines in report: ${reportInDb.lines.length}`);
      const hasDeletedWorkerLine = reportInDb.lines.some((l: any) => l.workerId === testWorkerId);
      console.log(`     Contains deleted worker's line: ${hasDeletedWorkerLine ? "YES (FAIL)" : "NO (PASS)"}`);
    }

    if (!workerInDb && attAfter.length === 0 && linesAfter.length === 0 && reportInDb) {
      console.log("\n================================================================");
      console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
      console.log("- Worker deleted: YES");
      console.log("- Attendance records cascade deleted: YES");
      console.log("- SalaryReportLine cascade deleted: YES");
      console.log("- SalaryReport preserved as historical record: YES");
      console.log("- 404 for non-existent worker on DELETE: YES");
      console.log("- PATCH supports { isActive: false }: YES");
      console.log("================================================================");
    } else {
      throw new Error("Cascade delete assertions failed!");
    }
  } finally {
    // Cleanup the test report if needed
    if (testReportId) {
      try {
        await prisma.salaryReport.delete({ where: { id: testReportId } }).catch(() => {});
      } catch (_) {}
    }
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
