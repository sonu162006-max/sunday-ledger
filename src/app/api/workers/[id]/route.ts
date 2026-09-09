import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminSession } from "@/src/lib/auth";

// PATCH /api/workers/[id] — update a worker
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error: authError } = await requireAdminSession();
    if (authError) return authError;

    const { id } = params;

    const existingWorker = await prisma.worker.findUnique({
      where: { id },
    });

    if (!existingWorker) {
      return NextResponse.json(
        { error: "Worker not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, monthlySalary, joinDate, isActive } = body;

    const dataToUpdate: Prisma.WorkerUpdateInput = {};

    if (name !== undefined) {
      dataToUpdate.name = String(name);
    }

    if (monthlySalary !== undefined) {
      const salaryNum = Number(monthlySalary);
      if (isNaN(salaryNum) || salaryNum < 0) {
        return NextResponse.json(
          { error: "monthlySalary must be a positive number" },
          { status: 400 }
        );
      }
      dataToUpdate.monthlySalary = new Prisma.Decimal(salaryNum);
    }

    if (joinDate !== undefined) {
      const parsedDate = new Date(joinDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid joinDate format" },
          { status: 400 }
        );
      }
      dataToUpdate.joinDate = parsedDate;
    }

    if (isActive !== undefined) {
      dataToUpdate.isActive = Boolean(isActive);
    }

    const updatedWorker = await prisma.worker.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedWorker);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to update worker", details: err.message },
      { status: 500 }
    );
  }
}

// DELETE /api/workers/[id] — delete a worker
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error: authError } = await requireAdminSession();
    if (authError) return authError;

    const { id } = params;

    const worker = await prisma.worker.findUnique({
      where: { id },
    });

    if (!worker) {
      return NextResponse.json(
        { error: "Worker not found" },
        { status: 404 }
      );
    }

    await prisma.worker.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Worker deleted successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to delete worker", details: err.message },
      { status: 500 }
    );
  }
}
