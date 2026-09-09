import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { computeWorkerSalary } from "@/lib/salary";
import { Prisma } from "@prisma/client";
import { requireAdminSession } from "@/src/lib/auth";

function toDateString(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// POST /api/reports/generate — accept { year, month }
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireAdminSession();
    if (authError) return authError;

    const body = await req.json();
    const { year, month } = body;

    const yearNum = parseInt(year, 10);
    const monthNum = parseInt(month, 10);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json(
        { error: "Valid 'year' and 'month' (1-12) are required" },
        { status: 400 }
      );
    }

    const monthStr = `${yearNum}-${String(monthNum).padStart(2, "0")}`;

    // 1. Fetch all workers (active or all workers created before or during this month)
    const workers = await prisma.worker.findMany({
      where: {
        isActive: true,
      },
      orderBy: { name: "asc" },
    });

    // 2. Fetch all holidays
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: "asc" },
    });
    const formattedHolidays = holidays.map((h) => ({
      date: toDateString(h.date),
    }));

    // 3. Fetch all attendance for this month
    const startDate = new Date(Date.UTC(yearNum, monthNum - 1, 1));
    const endDate = new Date(Date.UTC(yearNum, monthNum, 0, 23, 59, 59, 999));

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Group attendance records by workerId
    const attendanceByWorker = new Map<string, { date: string; status: "PRESENT" | "ABSENT" }[]>();
    for (const rec of attendanceRecords) {
      const list = attendanceByWorker.get(rec.workerId) || [];
      list.push({
        date: toDateString(rec.date),
        status: rec.status,
      });
      attendanceByWorker.set(rec.workerId, list);
    }

    // 4. Run each worker through computeWorkerSalary
    let totalPayroll = 0;
    const reportLinesData: {
      workerId: string;
      presentDays: number;
      paidSundays: number;
      paidHolidays: number;
      totalPaidDays: number;
      salaryAmount: Prisma.Decimal;
    }[] = [];

    for (const worker of workers) {
      const workerRecords = attendanceByWorker.get(worker.id) || [];
      const salaryResult = computeWorkerSalary(
        { monthlySalary: Number(worker.monthlySalary) },
        yearNum,
        monthNum,
        workerRecords,
        formattedHolidays
      );

      totalPayroll += salaryResult.salary;
      reportLinesData.push({
        workerId: worker.id,
        presentDays: salaryResult.presentDays,
        paidSundays: salaryResult.paidSundays,
        paidHolidays: salaryResult.paidHolidays,
        totalPaidDays: salaryResult.totalPaidDays,
        salaryAmount: new Prisma.Decimal(salaryResult.salary),
      });
    }

    // 5. Save report atomically in transaction (delete prior report for month if exists)
    const report = await prisma.$transaction(async (tx) => {
      await tx.salaryReport.deleteMany({
        where: { month: monthStr },
      });

      return tx.salaryReport.create({
        data: {
          month: monthStr,
          totalPayroll: new Prisma.Decimal(Math.round(totalPayroll * 100) / 100),
          lines: {
            create: reportLinesData,
          },
        },
        include: {
          lines: {
            include: {
              worker: true,
            },
          },
        },
      });
    });

    return NextResponse.json(report, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to generate salary report", details: err.message },
      { status: 500 }
    );
  }
}
