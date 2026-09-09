import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireAdminSession } from "@/src/lib/auth";

// POST /api/holidays — create a holiday (date, name)
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireAdminSession();
    if (authError) return authError;

    const body = await req.json();
    const { date, name } = body;

    if (!date || !name) {
      return NextResponse.json(
        { error: "date and name are required fields" },
        { status: 400 }
      );
    }

    const dateParts = date.split("-").map(Number);
    const parsedDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));

    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Expected YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const holiday = await prisma.holiday.create({
      data: {
        date: parsedDate,
        name: String(name).trim(),
      },
    });

    return NextResponse.json(holiday, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error & { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "A holiday already exists for this date" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create holiday", details: err.message },
      { status: 500 }
    );
  }
}

// GET /api/holidays — list all holidays
export async function GET() {
  try {
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: "asc" },
    });
    return NextResponse.json(holidays);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to fetch holidays", details: err.message },
      { status: 500 }
    );
  }
}
