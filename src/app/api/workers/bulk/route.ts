import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminSession } from "@/src/lib/auth";

interface WorkerInput {
  name: string;
  monthlySalary: number | string;
  joinDate: string;
  isActive?: boolean;
}

// POST /api/workers/bulk — create multiple workers in a single batch
export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireAdminSession();
    if (authError) return authError;

    const body = await req.json();
    const workers: WorkerInput[] = Array.isArray(body) ? body : body.workers;

    if (!workers || !Array.isArray(workers) || workers.length === 0) {
      return NextResponse.json(
        { error: "Request body must be a non-empty array of workers or contain a 'workers' array" },
        { status: 400 }
      );
    }

    const dataToCreate: {
      name: string;
      monthlySalary: Prisma.Decimal;
      joinDate: Date;
      isActive: boolean;
    }[] = [];

    for (let i = 0; i < workers.length; i++) {
      const w = workers[i];
      if (!w.name || w.monthlySalary === undefined || w.monthlySalary === null || !w.joinDate) {
        return NextResponse.json(
          { error: `Row ${i + 1}: name, monthlySalary, and joinDate are required fields` },
          { status: 400 }
        );
      }

      const salaryNum = Number(w.monthlySalary);
      if (isNaN(salaryNum) || salaryNum < 0) {
        return NextResponse.json(
          { error: `Row ${i + 1}: monthlySalary must be a positive number` },
          { status: 400 }
        );
      }

      const parsedDate = new Date(w.joinDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: `Row ${i + 1}: Invalid joinDate format` },
          { status: 400 }
        );
      }

      dataToCreate.push({
        name: String(w.name).trim(),
        monthlySalary: new Prisma.Decimal(salaryNum),
        joinDate: parsedDate,
        isActive: w.isActive !== undefined ? Boolean(w.isActive) : true,
      });
    }

    const result = await prisma.worker.createMany({
      data: dataToCreate,
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Successfully created ${result.count} workers`,
    }, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to bulk create workers", details: err.message },
      { status: 500 }
    );
  }
}
