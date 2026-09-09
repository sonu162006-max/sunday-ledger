/**
 * Load-testing Script for Sunday Ledger at Scale (1,000 Workers)
 *
 * 1. Reads admin credentials strictly from environment variables (SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD).
 * 2. Creates 1,000 dummy workers via Prisma createMany with LOADTEST_ prefix.
 * 3. Generates 30,000 attendance records for November 2026 with deterministic Sunday rule patterns.
 * 4. Sends attendance through POST /api/attendance via authenticated HTTP request.
 * 5. Measures timing, handles timeouts/errors.
 * 6. Generates November 2026 salary report via POST /api/reports/generate.
 * 7. Spot-checks 5 workers to verify Sunday rule math accuracy.
 */

import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

// First & Last names for realistic Indian name generation
const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Reyansh", "Muhammad", "Sai",
  "Aarush", "Krishna", "Ishaan", "Shaurya", "Atharva", "Aayush", "Dhruv", "Kabir",
  "Aadhya", "Ananya", "Diya", "Pari", "Saanvi", "Myra", "Anika", "Navya",
  "Avni", "Kavya", "Riya", "Prisha", "Ira", "Isha", "Tara", "Tanvi"
];

const LAST_NAMES = [
  "Sharma", "Patel", "Verma", "Gupta", "Singh", "Kumar", "Rao", "Reddy",
  "Nair", "Joshi", "Mehta", "Bose", "Choudhury", "Das", "Deshmukh", "Ghosh",
  "Iyer", "Jain", "Khan", "Kulkarni", "Malhotra", "Mukherjee", "Naidu", "Pillai"
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// NextAuth Cookie Extraction Helper
async function loginAsAdmin(): Promise<string> {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      "Missing required environment variables: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set."
    );
  }

  console.log(`Authenticating as admin (${adminEmail})...`);

  // 1. CSRF Token
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  if (!csrfRes.ok) throw new Error(`Failed to fetch CSRF token: ${csrfRes.statusText}`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const csrfCookies = csrfRes.headers.get("set-cookie") || "";

  // 2. Credentials Callback
  const params = new URLSearchParams();
  params.append("csrfToken", csrfToken);
  params.append("email", adminEmail);
  params.append("password", adminPassword);
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
  const cookieHeader = rawSetCookie
    .split(/,(?=\s*[^;]+=[^;]+)/)
    .map((c) => c.split(";")[0].trim())
    .join("; ");

  if (!cookieHeader.includes("next-auth.session-token")) {
    throw new Error("Login failed: next-auth.session-token cookie not found in response.");
  }

  console.log("  ✅ Admin authentication successful.\n");
  return cookieHeader;
}

async function main() {
  console.log("================================================================");
  console.log("SUNDAY LEDGER — 1,000 WORKERS REALISTIC LOAD-TEST BENCHMARK");
  console.log("================================================================\n");

  const sessionCookie = await loginAsAdmin();

  // -----------------------------------------------------------------
  // STEP 1: Create 1,000 Workers via direct Prisma createMany
  // -----------------------------------------------------------------
  console.log("STEP 1: Generating and creating 1,000 dummy workers in DB...");
  const workerCreationStart = performance.now();

  const dummyWorkersData: {
    name: string;
    monthlySalary: Prisma.Decimal;
    joinDate: Date;
    isActive: boolean;
  }[] = [];

  for (let i = 1; i <= 1000; i++) {
    const firstName = getRandomItem(FIRST_NAMES);
    const lastName = getRandomItem(LAST_NAMES);
    // Salary between ₹15,000 and ₹80,000 rounded to nearest 500
    const salaryNum = getRandomInt(30, 160) * 500;
    // Join date between Jan 2024 and Oct 2026
    const joinYear = getRandomInt(2024, 2026);
    const joinMonth = getRandomInt(0, 9);
    const joinDay = getRandomInt(1, 28);
    const joinDate = new Date(Date.UTC(joinYear, joinMonth, joinDay));

    let tag = `LOADTEST_${String(i).padStart(4, "0")}_${firstName}_${lastName}`;
    if (i <= 20) {
      tag = `LOADTEST_P1_Worker_${String(i).padStart(2, "0")}_${firstName}_${lastName}`;
    } else if (i <= 40) {
      tag = `LOADTEST_P2_Worker_${String(i - 20).padStart(2, "0")}_${firstName}_${lastName}`;
    }

    dummyWorkersData.push({
      name: tag,
      monthlySalary: new Prisma.Decimal(salaryNum),
      joinDate,
      isActive: true,
    });
  }

  const createWorkersResult = await prisma.worker.createMany({
    data: dummyWorkersData,
  });

  const workerCreationTime = ((performance.now() - workerCreationStart) / 1000).toFixed(3);
  console.log(`  ✅ Created ${createWorkersResult.count} workers in ${workerCreationTime}s\n`);

  // Fetch all created workers to get their IDs
  const workers = await prisma.worker.findMany({
    where: { name: { startsWith: "LOADTEST_" } },
    orderBy: { name: "asc" },
  });

  if (workers.length < 1000) {
    throw new Error(`Expected at least 1,000 workers, found ${workers.length}`);
  }

  // -----------------------------------------------------------------
  // STEP 2: Generate ~30,000 Attendance Records for November 2026
  // -----------------------------------------------------------------
  console.log("STEP 2: Building 30,000 attendance records for November 2026...");
  const year = 2026;
  const month = 11;
  const daysInMonth = 30;

  // Track expected patterns for spot-checking
  // Pattern 1 (Workers 0 to 19): Nov 7 Sat = ABSENT, Nov 9 Mon = PRESENT -> Nov 8 Sun should be PAID
  // Pattern 2 (Workers 20 to 39): Nov 7 Sat = ABSENT, Nov 9 Mon = ABSENT -> Nov 8 Sun should be UNPAID
  const attendancePayload: {
    workerId: string;
    date: string;
    status: "PRESENT" | "ABSENT";
  }[] = [];

  const spotCheckTargets: {
    workerId: string;
    name: string;
    monthlySalary: number;
    pattern: string;
    expectedSundaysPaid: number;
    absentDaysCount: number;
  }[] = [];

  for (let wIdx = 0; wIdx < workers.length; wIdx++) {
    const worker = workers[wIdx];
    const isPattern1 = wIdx < 20;
    const isPattern2 = wIdx >= 20 && wIdx < 40;

    let absentCount = 0;
    let expectedSundays = 5; // Default 5 Sundays in Nov 2026 (Nov 1, 8, 15, 22, 29)

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay(); // 0 = Sunday, 6 = Saturday

      let status: "PRESENT" | "ABSENT" = "PRESENT";

      if (dayOfWeek === 0) {
        // Sunday: not marked in attendancePayload, defaults to Sunday adjudication
        continue;
      }

      if (isPattern1) {
        // Sat Nov 7 is ABSENT, Mon Nov 9 is PRESENT. All other days PRESENT.
        if (d === 7) {
          status = "ABSENT";
          absentCount++;
        } else {
          status = "PRESENT";
        }
      } else if (isPattern2) {
        // Sat Nov 7 is ABSENT, Mon Nov 9 is ABSENT. All other days PRESENT.
        if (d === 7 || d === 9) {
          status = "ABSENT";
          absentCount++;
        } else {
          status = "PRESENT";
        }
        if (d === 9) {
          expectedSundays = 4; // Sunday Nov 8 will be UNPAID!
        }
      } else {
        // Rest of workers: ~5% random ABSENT on workdays
        if (Math.random() < 0.05) {
          status = "ABSENT";
          absentCount++;
        }
      }

      attendancePayload.push({
        workerId: worker.id,
        date: dateStr,
        status,
      });
    }

    // For general workers, dynamically compute expected Sundays based on their generated attendance
    if (!isPattern1 && !isPattern2) {
      const wMap = new Map<string, "PRESENT" | "ABSENT">();
      attendancePayload
        .filter((r) => r.workerId === worker.id)
        .forEach((r) => wMap.set(r.date, r.status));

      let dynSundays = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(year, month - 1, d).getDay() === 0) {
          const prevSatStr = d - 1 >= 1 ? `${year}-11-${String(d - 1).padStart(2, "0")}` : null;
          const nextMonStr = d + 1 <= daysInMonth ? `${year}-11-${String(d + 1).padStart(2, "0")}` : null;
          const prevSatPresent = prevSatStr !== null && wMap.get(prevSatStr) !== "ABSENT";
          const nextMonPresent = nextMonStr !== null && wMap.get(nextMonStr) !== "ABSENT";
          if (prevSatPresent || nextMonPresent) {
            dynSundays++;
          }
        }
      }
      expectedSundays = dynSundays;
    }

    // Pick spot-check targets: Worker 0, 1 (Pattern 1), Worker 20, 21 (Pattern 2), Worker 50 (General)
    if (wIdx === 0 || wIdx === 1 || wIdx === 20 || wIdx === 21 || wIdx === 50) {
      spotCheckTargets.push({
        workerId: worker.id,
        name: worker.name,
        monthlySalary: Number(worker.monthlySalary),
        pattern: isPattern1
          ? "Pattern 1 (Sat Nov 7 Absent + Mon Nov 9 Present -> Sun Nov 8 PAID)"
          : isPattern2
          ? "Pattern 2 (Sat Nov 7 Absent + Mon Nov 9 Absent -> Sun Nov 8 UNPAID)"
          : "General Worker (~5% random absent)",
        expectedSundaysPaid: expectedSundays,
        absentDaysCount: absentCount,
      });
    }
  }

  console.log(`  Total generated attendance records: ${attendancePayload.length.toLocaleString()}`);

  // -----------------------------------------------------------------
  // STEP 3: POST attendance data through real /api/attendance endpoint
  // -----------------------------------------------------------------
  console.log("\nSTEP 3: POSTing attendance data to /api/attendance endpoint...");
  console.log("  Testing current implementation with 30,000 records payload...");

  const postAttendanceStart = performance.now();
  let postSuccess = false;
  let postDuration = 0;
  let postError = "";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const res = await fetch(`${BASE_URL}/api/attendance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ records: attendancePayload }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    postDuration = (performance.now() - postAttendanceStart) / 1000;

    if (res.ok) {
      const data = await res.json();
      console.log(`  ✅ POST /api/attendance succeeded in ${postDuration.toFixed(3)}s! Count: ${data.count}`);
      postSuccess = true;
    } else {
      const err = await res.json().catch(() => ({}));
      postError = `HTTP ${res.status}: ${JSON.stringify(err)}`;
      console.log(`  ❌ POST /api/attendance failed in ${postDuration.toFixed(3)}s: ${postError}`);
    }
  } catch (err: unknown) {
    postDuration = (performance.now() - postAttendanceStart) / 1000;
    postError = (err as Error).message;
    console.log(`  ❌ POST /api/attendance error/timeout after ${postDuration.toFixed(3)}s: ${postError}`);
  }

  // -----------------------------------------------------------------
  // STEP 4: If timed out or > 5s, report diagnosis
  // -----------------------------------------------------------------
  if (!postSuccess || postDuration > 5) {
    console.log("\nSTEP 4 ANALYSIS: Attendance POST was too slow or failed.");
    console.log("  The unbatched $transaction(30,000) creates 30,000 queries in a single transaction.");
    console.log("  Proceeding to optimize /api/attendance with chunked bulk processing...\n");
  }

  // -----------------------------------------------------------------
  // STEP 5: Generate Salary Report for November 2026
  // -----------------------------------------------------------------
  console.log("\nSTEP 5: Generating Salary Report for November 2026 (1,000 workers)...");
  const reportGenStart = performance.now();

  const reportRes = await fetch(`${BASE_URL}/api/reports/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({ year: 2026, month: 11 }),
  });

  const reportGenTime = ((performance.now() - reportGenStart) / 1000).toFixed(3);

  if (!reportRes.ok) {
    const err = await reportRes.json().catch(() => ({}));
    throw new Error(`Failed to generate report (HTTP ${reportRes.status}): ${JSON.stringify(err)}`);
  }

  const reportData = await reportRes.json();
  console.log(`  ✅ Generated report for ${reportData.lines.length} workers in ${reportGenTime}s.`);
  console.log(`  Total Disbursed Payroll: ₹${Number(reportData.totalPayroll).toLocaleString("en-IN")}\n`);

  // -----------------------------------------------------------------
  // STEP 6: Spot-check 5 workers
  // -----------------------------------------------------------------
  console.log("STEP 6: Spot-checking 5 workers against expected Sunday rule mathematics:\n");

  const linesMap = new Map<string, any>();
  for (const line of reportData.lines) {
    linesMap.set(line.workerId, line);
  }

  let allSpotChecksPassed = true;

  for (const target of spotCheckTargets) {
    const line = linesMap.get(target.workerId);
    if (!line) {
      console.log(`  ❌ Worker ${target.name} not found in report lines!`);
      allSpotChecksPassed = false;
      continue;
    }

    const presentDays = line.presentDays;
    const paidSundays = line.paidSundays;
    const paidHolidays = line.paidHolidays;
    const totalPaidDays = line.totalPaidDays;
    const salaryAmount = Number(line.salaryAmount);

    const dailyRate = target.monthlySalary / 30;
    const expectedSalary = Math.round(totalPaidDays * dailyRate * 100) / 100;

    const sundaysMatch = paidSundays === target.expectedSundaysPaid;
    const salaryMatch = Math.abs(salaryAmount - expectedSalary) < 0.01;

    console.log(`  Worker: ${target.name}`);
    console.log(`    Role/Pattern: ${target.pattern}`);
    console.log(`    Monthly Salary: ₹${target.monthlySalary.toLocaleString()} (Daily: ₹${dailyRate.toFixed(2)})`);
    console.log(`    Present Workdays: ${presentDays}, Paid Sundays: ${paidSundays} (Expected: ${target.expectedSundaysPaid}), Holidays: ${paidHolidays}`);
    console.log(`    Total Paid Days: ${totalPaidDays} / 30`);
    console.log(`    Computed Salary: ₹${salaryAmount.toFixed(2)} (Expected: ₹${expectedSalary.toFixed(2)})`);

    if (sundaysMatch && salaryMatch) {
      console.log(`    Result: ✅ PASS (Sunday rule verified)\n`);
    } else {
      console.log(`    Result: ❌ FAIL (Mismatch in expected days or salary)\n`);
      allSpotChecksPassed = false;
    }
  }

  console.log("================================================================");
  console.log("BENCHMARK SUMMARY:");
  console.log(`  1. 1,000 Workers Creation (DB direct): ${workerCreationTime}s`);
  console.log(`  2. Attendance Bulk POST (30,000 records): ${postDuration.toFixed(3)}s (${postSuccess ? "SUCCESS" : "FAILED/TIMEOUT"})`);
  console.log(`  3. Report Generation (1,000 workers): ${reportGenTime}s`);
  console.log(`  4. Spot-check verification: ${allSpotChecksPassed ? "ALL 5 PASSED" : "FAILED"}`);
  console.log("================================================================");
}

main()
  .catch((e) => {
    console.error("Benchmark failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
