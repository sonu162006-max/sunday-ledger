import { NextRequest, NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";
import { requireAdminSession } from "@/src/lib/auth";

// DELETE /api/holidays/[id] — delete a holiday
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error: authError } = await requireAdminSession();
    if (authError) return authError;

    const { id } = params;
    await prisma.holiday.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Holiday deleted successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to delete holiday", details: err.message },
      { status: 500 }
    );
  }
}
