import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const authError = await requireApiAdmin();

  if (authError) {
    return authError;
  }

  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Failed to retrieve user accounts:", error);

    return NextResponse.json(
      { error: "Failed to retrieve user accounts." },
      { status: 500 }
    );
  }
}