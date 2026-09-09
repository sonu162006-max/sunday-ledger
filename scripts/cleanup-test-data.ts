/**
 * Cleanup script to remove all load-test dummy workers, attendance, and reports.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning up load-test data...");

  // 1. Delete November 2026 Salary Report
  const deletedReports = await prisma.salaryReport.deleteMany({
    where: { month: "2026-11" },
  });
  console.log(`  Deleted ${deletedReports.count} November 2026 salary reports.`);

  // 2. Delete all workers starting with "LOADTEST_"
  // Because of onDelete: Cascade on Attendance and SalaryReportLine,
  // this automatically cascades all related attendance records and line items!
  const deletedWorkers = await prisma.worker.deleteMany({
    where: { name: { startsWith: "LOADTEST_" } },
  });
  console.log(`  Deleted ${deletedWorkers.count} dummy workers (and cascaded all attendance records).`);

  // Count remaining
  const remainingWorkers = await prisma.worker.count();
  const remainingAttendance = await prisma.attendance.count();
  console.log(`  Remaining workers in DB: ${remainingWorkers}`);
  console.log(`  Remaining attendance in DB: ${remainingAttendance}`);
  console.log("Cleanup complete.");
}

main()
  .catch((e) => {
    console.error("Cleanup error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
