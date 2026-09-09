import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

// GET /api/reports/[month] — return a previously saved report (e.g. "2026-09")
export async function GET(
  _req: NextRequest,
  { params }: { params: { month: string } }
) {
  try {
    const { month } = params;

    const report = await prisma.salaryReport.findFirst({
      where: { month },
      orderBy: { generatedAt: "desc" },
      include: {
        lines: {
          include: {
            worker: true,
          },
        },
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: `Salary report not found for month: ${month}` },
        { status: 404 }
      );
    }

    return NextResponse.json(report);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to fetch salary report", details: err.message },
      { status: 500 }
    );
  }
}
