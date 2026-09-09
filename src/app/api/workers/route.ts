import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminSession } from "@/src/lib/auth";

// POST /api/workers — create a worker (name, monthlySalary, joinDate)
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireAdminSession();
    if (authError) return authError;

    const body = await req.json();
    const { name, monthlySalary, joinDate, isActive } = body;

    if (!name || monthlySalary === undefined || monthlySalary === null || !joinDate) {
      return NextResponse.json(
        { error: "name, monthlySalary, and joinDate are required fields" },
        { status: 400 }
      );
    }

    const salaryNum = Number(monthlySalary);
    if (isNaN(salaryNum) || salaryNum < 0) {
      return NextResponse.json(
        { error: "monthlySalary must be a positive number" },
        { status: 400 }
      );
    }

    const parsedDate = new Date(joinDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid joinDate format" },
        { status: 400 }
      );
    }

    const worker = await prisma.worker.create({
      data: {
        name,
        monthlySalary: new Prisma.Decimal(salaryNum),
        joinDate: parsedDate,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    return NextResponse.json(worker, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to create worker", details: err.message },
      { status: 500 }
    );
  }
}

// GET /api/workers — list all workers
export async function GET() {
  try {
    const workers = await prisma.worker.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(workers);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to fetch workers", details: err.message },
      { status: 500 }
    );
  }
}
