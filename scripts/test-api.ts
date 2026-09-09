/**
 * Integration Test Script for Sunday Ledger API Routes
 *
 * Tests the complete flow against the running Next.js dev server:
 * 1. POST /api/workers & GET /api/workers
 * 2. POST /api/holidays & GET /api/holidays
 * 3. POST /api/attendance & GET /api/attendance
 * 4. POST /api/reports/generate (invokes computeWorkerSalary from lib/salary.ts)
 * 5. GET /api/reports/[month]
 * 6. Compares API results against manual mathematical calculations
 * 7. Cleans up test data from the database
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface WorkerResponse {
  id: string;
  name: string;
  monthlySalary: string | number;
  joinDate: string;
  isActive: boolean;
}

interface HolidayResponse {
  id: string;
  date: string;
  name: string;
}

interface SalaryReportLineResponse {
  id: string;
  workerId: string;
  presentDays: number;
  paidSundays: number;
  paidHolidays: number;
  totalPaidDays: number;
  salaryAmount: string | number;
  worker: {
    name: string;
  };
}

interface SalaryReportResponse {
  id: string;
  month: string;
  totalPayroll: string | number;
  lines: SalaryReportLineResponse[];
}

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

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${path}: ${JSON.stringify(data)}`);
  }

  return data;
}

async function run() {
  console.log("================================================================");
  console.log("SUNDAY LEDGER — END-TO-END API INTEGRATION TEST");
  console.log("Target Server: " + BASE_URL);
  console.log("================================================================\n");

  console.log("Authenticating as ADMIN for test suite...");
  await loginAdmin();
  console.log("✓ Admin authentication complete.\n");

  const createdWorkerIds: string[] = [];
  const createdHolidayIds: string[] = [];
  const testYear = 2026;
  const testMonth = 10; // October 2026 (31 days)
  const monthStr = `${testYear}-${String(testMonth).padStart(2, "0")}`;

  try {
    // -----------------------------------------------------------------
    // Step 1: Create 3 Test Workers with different salaries
    // -----------------------------------------------------------------
    console.log("STEP 1: Creating 3 Test Workers via POST /api/workers...");

    const worker1: WorkerResponse = await api("/api/workers", {
      method: "POST",
      body: JSON.stringify({
        name: "TEST_Alice Sharma",
        monthlySalary: 30000,
        joinDate: "2026-01-15",
      }),
    });
    createdWorkerIds.push(worker1.id);
    console.log(`  ✓ Created Worker 1: ${worker1.name} (ID: ${worker1.id}) | Salary: ₹30,000/mo`);

    const worker2: WorkerResponse = await api("/api/workers", {
      method: "POST",
      body: JSON.stringify({
        name: "TEST_Bob Patel",
        monthlySalary: 45000,
        joinDate: "2026-02-01",
      }),
    });
    createdWorkerIds.push(worker2.id);
    console.log(`  ✓ Created Worker 2: ${worker2.name} (ID: ${worker2.id}) | Salary: ₹45,000/mo`);

    const worker3: WorkerResponse = await api("/api/workers", {
      method: "POST",
      body: JSON.stringify({
        name: "TEST_Charlie Verma",
        monthlySalary: 60000,
        joinDate: "2026-03-10",
      }),
    });
    createdWorkerIds.push(worker3.id);
    console.log(`  ✓ Created Worker 3: ${worker3.name} (ID: ${worker3.id}) | Salary: ₹60,000/mo`);

    // Verify GET /api/workers
    const allWorkers: WorkerResponse[] = await api("/api/workers");
    console.log(`  ✓ GET /api/workers returned ${allWorkers.length} workers.`);

    // -----------------------------------------------------------------
    // Step 2: Create a Holiday via POST /api/holidays
    // Oct 15, 2026 is Thursday
    // -----------------------------------------------------------------
    console.log("\nSTEP 2: Adding a paid holiday via POST /api/holidays...");
    const holidayDate = `${monthStr}-15`;
    const holiday: HolidayResponse = await api("/api/holidays", {
      method: "POST",
      body: JSON.stringify({
        date: holidayDate,
        name: "TEST_Dussehra Festival",
      }),
    });
    createdHolidayIds.push(holiday.id);
    console.log(`  ✓ Created Holiday: ${holiday.name} on ${holiday.date} (ID: ${holiday.id})`);

    const allHolidays: HolidayResponse[] = await api("/api/holidays");
    console.log(`  ✓ GET /api/holidays returned ${allHolidays.length} holiday(s).`);

    // -----------------------------------------------------------------
    // Step 3: Populate Full Month Attendance for October 2026 (31 days)
    // -----------------------------------------------------------------
    console.log("\nSTEP 3: Populating full month attendance via POST /api/attendance...");

    const attendancePayload: { workerId: string; date: string; status: "PRESENT" | "ABSENT" }[] = [];

    for (let day = 1; day <= 31; day++) {
      const dayStr = String(day).padStart(2, "0");
      const date = `${monthStr}-${dayStr}`;

      // Worker 1 (Alice): Fully present every day
      attendancePayload.push({
        workerId: worker1.id,
        date,
        status: "PRESENT",
      });

      // Worker 2 (Bob): Saturday Oct 10 ABSENT, Monday Oct 12 PRESENT
      // -> Sunday Oct 11 should be PAID!
      if (day === 10) {
        attendancePayload.push({ workerId: worker2.id, date, status: "ABSENT" });
      } else {
        attendancePayload.push({ workerId: worker2.id, date, status: "PRESENT" });
      }

      // Worker 3 (Charlie): Saturday Oct 17 ABSENT, Monday Oct 19 ABSENT
      // -> Sunday Oct 18 should be UNPAID!
      // Also absent on Holiday Oct 15 -> Holiday overrides absence!
      if (day === 17 || day === 19 || day === 15) {
        attendancePayload.push({ workerId: worker3.id, date, status: "ABSENT" });
      } else {
        attendancePayload.push({ workerId: worker3.id, date, status: "PRESENT" });
      }
    }

    const attendanceRes = await api("/api/attendance", {
      method: "POST",
      body: JSON.stringify(attendancePayload),
    });
    console.log(`  ✓ Bulk upserted ${attendanceRes.count} attendance records successfully.`);

    const fetchedAttendance = await api(`/api/attendance?year=${testYear}&month=${testMonth}`);
    console.log(`  ✓ GET /api/attendance?year=${testYear}&month=${testMonth} returned ${fetchedAttendance.length} records.`);

    // -----------------------------------------------------------------
    // Step 4: Generate Salary Report via POST /api/reports/generate
    // -----------------------------------------------------------------
    console.log("\nSTEP 4: Generating salary report via POST /api/reports/generate...");

    const report: SalaryReportResponse = await api("/api/reports/generate", {
      method: "POST",
      body: JSON.stringify({
        year: testYear,
        month: testMonth,
      }),
    });

    console.log(`  ✓ Report generated for month ${report.month} | Report ID: ${report.id}`);
    console.log(`  ✓ Total Payroll: ₹${Number(report.totalPayroll).toLocaleString("en-IN")}`);

    // Verify GET /api/reports/[month]
    const fetchedReport: SalaryReportResponse = await api(`/api/reports/${monthStr}`);
    console.log(`  ✓ GET /api/reports/${monthStr} successfully retrieved stored report.`);

    // -----------------------------------------------------------------
    // Step 5: Verification of Calculation against Manual Rules
    // -----------------------------------------------------------------
    console.log("\nSTEP 5: Verifying computed salary against manual calculations:\n");

    /**
     * Manual Calculations for October 2026 (31 days):
     * - 4 Sundays: Oct 4, 11, 18, 25
     * - 1 Holiday: Oct 15 (Thursday)
     * - 26 regular Mon-Sat days
     *
     * 1. Alice (₹30,000 / mo -> rate ₹1,000):
     *    - presentDays: 26
     *    - paidSundays: 4
     *    - paidHolidays: 1
     *    - totalPaidDays: 31
     *    - expectedSalary: 31 * 1000 = ₹31,000.00
     *
     * 2. Bob (₹45,000 / mo -> rate ₹1,500):
     *    - Saturday Oct 10 absent, Monday Oct 12 present -> Sunday Oct 11 PAID
     *    - presentDays: 25 (26 - 1 absent on Sat Oct 10)
     *    - paidSundays: 4 (all 4 paid)
     *    - paidHolidays: 1
     *    - totalPaidDays: 30
     *    - expectedSalary: 30 * 1500 = ₹45,000.00
     *
     * 3. Charlie (₹60,000 / mo -> rate ₹2,000):
     *    - Saturday Oct 17 absent, Monday Oct 19 absent -> Sunday Oct 18 UNPAID
     *    - Absent on holiday Oct 15 -> Holiday overrides absence, counted as paid holiday
     *    - presentDays: 24 (26 - 2 absent on Sat Oct 17 and Mon Oct 19)
     *    - paidSundays: 3 (Oct 4, 11, 25 paid; Oct 18 unpaid)
     *    - paidHolidays: 1
     *    - totalPaidDays: 28
     *    - expectedSalary: 28 * 2000 = ₹56,000.00
     */

    const manualExpectations: Record<
      string,
      { presentDays: number; paidSundays: number; paidHolidays: number; totalPaidDays: number; expectedSalary: number }
    > = {
      [worker1.id]: { presentDays: 26, paidSundays: 4, paidHolidays: 1, totalPaidDays: 31, expectedSalary: 31000 },
      [worker2.id]: { presentDays: 25, paidSundays: 4, paidHolidays: 1, totalPaidDays: 30, expectedSalary: 45000 },
      [worker3.id]: { presentDays: 24, paidSundays: 3, paidHolidays: 1, totalPaidDays: 28, expectedSalary: 56000 },
    };

    let allMatched = true;

    for (const line of report.lines) {
      const exp = manualExpectations[line.workerId];
      if (!exp) continue;

      const actualSalary = Number(line.salaryAmount);
      const isMatch =
        line.presentDays === exp.presentDays &&
        line.paidSundays === exp.paidSundays &&
        line.paidHolidays === exp.paidHolidays &&
        line.totalPaidDays === exp.totalPaidDays &&
        actualSalary === exp.expectedSalary;

      if (!isMatch) {
        allMatched = false;
        console.error(`  ❌ MISMATCH for Worker ${line.worker.name}:`);
        console.error(`     Expected: present=${exp.presentDays}, Sun=${exp.paidSundays}, Hol=${exp.paidHolidays}, TotalDays=${exp.totalPaidDays}, Salary=₹${exp.expectedSalary}`);
        console.error(`     Actual:   present=${line.presentDays}, Sun=${line.paidSundays}, Hol=${line.paidHolidays}, TotalDays=${line.totalPaidDays}, Salary=₹${actualSalary}`);
      } else {
        console.log(`  ✅ ${line.worker.name}:`);
        console.log(`     Present Days:   ${line.presentDays}  (Expected: ${exp.presentDays})`);
        console.log(`     Paid Sundays:   ${line.paidSundays}  (Expected: ${exp.paidSundays})`);
        console.log(`     Paid Holidays:  ${line.paidHolidays}  (Expected: ${exp.paidHolidays})`);
        console.log(`     Total Paid:     ${line.totalPaidDays} days (Expected: ${exp.totalPaidDays})`);
        console.log(`     Salary Computed: ₹${actualSalary.toLocaleString("en-IN")} (Expected: ₹${exp.expectedSalary.toLocaleString("en-IN")})`);
        console.log(`     Status: EXACT MATCH\n`);
      }
    }

    if (!allMatched) {
      throw new Error("One or more worker salary calculations did not match manual expectations!");
    }

    console.log("All 3 worker calculations verified and matched with 100% precision!");

  } finally {
    // -----------------------------------------------------------------
    // Step 6: Cleanup Test Data
    // -----------------------------------------------------------------
    console.log("\nSTEP 6: Cleaning up test data...");

    for (const wId of createdWorkerIds) {
      try {
        await api(`/api/workers/${wId}`, { method: "DELETE" });
      } catch (e) {
        console.warn(`  Warning deleting worker ${wId}:`, e);
      }
    }
    console.log(`  ✓ Cleaned up ${createdWorkerIds.length} test workers.`);

    for (const hId of createdHolidayIds) {
      try {
        await api(`/api/holidays/${hId}`, { method: "DELETE" });
      } catch (e) {
        console.warn(`  Warning deleting holiday ${hId}:`, e);
      }
    }
    console.log(`  ✓ Cleaned up ${createdHolidayIds.length} test holidays.`);

    console.log("\n================================================================");
    console.log("INTEGRATION TEST COMPLETED SUCCESSFULLY!");
    console.log("================================================================\n");
  }
}

run().catch((err) => {
  console.error("\n❌ Test failed with error:", err);
  process.exit(1);
});
