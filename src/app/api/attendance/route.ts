import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { AttendanceStatus, Prisma } from "@prisma/client";
import { requireAdminSession } from "@/src/lib/auth";
import { randomUUID } from "crypto";

interface AttendanceItemInput {
  workerId: string;
  date: string; // "YYYY-MM-DD"
  status: AttendanceStatus;
}

// POST /api/attendance — bulk upsert attendance for a given month
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireAdminSession();
    if (authError) return authError;

    const body = await req.json();
    const records: AttendanceItemInput[] = Array.isArray(body) ? body : body.records;

    if (!records || !Array.isArray(records)) {
      return NextResponse.json(
        { error: "Request body must be an array of attendance records or contain a 'records' array" },
        { status: 400 }
      );
    }

    if (records.length === 0) {
      return NextResponse.json({ success: true, count: 0, records: [] });
    }

    // Validate entries
    for (const record of records) {
      if (!record.workerId || !record.date || !record.status) {
        return NextResponse.json(
          { error: "Each record must have workerId, date, and status ('PRESENT' | 'ABSENT')" },
          { status: 400 }
        );
      }
      if (record.status !== "PRESENT" && record.status !== "ABSENT") {
        return NextResponse.json(
          { error: `Invalid status '${record.status}'. Allowed values are 'PRESENT' or 'ABSENT'` },
          { status: 400 }
        );
      }
    }

    // High-performance chunked raw SQL bulk upsert (1,000 records per chunk)
    // Uses Prisma.sql tagged template literals and Prisma.join for parameterized execution
    const CHUNK_SIZE = 1000;
    let totalUpserted = 0;

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE);
      const rows = chunk.map(
        (rec) =>
          Prisma.sql`(${randomUUID()}, ${rec.workerId}, ${rec.date}::date, ${rec.status}::"AttendanceStatus")`
      );

      await prisma.$executeRaw`
        INSERT INTO "Attendance" ("id", "workerId", "date", "status")
        VALUES ${Prisma.join(rows)}
        ON CONFLICT ("workerId", "date")
        DO UPDATE SET "status" = EXCLUDED."status";
      `;

      totalUpserted += chunk.length;
    }

    return NextResponse.json({
      success: true,
      count: totalUpserted,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to bulk upsert attendance", details: err.message },
      { status: 500 }
    );
  }
}

// GET /api/attendance?year=YYYY&month=MM — return all attendance records for that month
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const yearStr = searchParams.get("year");
    const monthStr = searchParams.get("month");

    if (!yearStr || !monthStr) {
      return NextResponse.json(
        { error: "Query parameters 'year' and 'month' are required (e.g. ?year=2026&month=9)" },
        { status: 400 }
      );
    }

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid year or month format. Month must be between 1 and 12" },
        { status: 400 }
      );
    }

    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const records = await prisma.attendance.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json(records);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to fetch attendance records", details: err.message },
      { status: 500 }
    );
  }
}
