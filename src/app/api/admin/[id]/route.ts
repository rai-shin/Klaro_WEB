
import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin, getCurrentSession } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type UserRole = "ADMIN" | "USER";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const authError = await requireApiAdmin();

  if (authError) {
    return authError;
  }

  try {
    const session = await getCurrentSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const data = body as Record<string, unknown>;

    const hasRole = Object.prototype.hasOwnProperty.call(data, "role");
    const hasActive = Object.prototype.hasOwnProperty.call(
      data,
      "isActive"
    );

    if (!hasRole && !hasActive) {
      return NextResponse.json(
        { error: "Provide a role or account status to update." },
        { status: 400 }
      );
    }

    if (
      hasRole &&
      data.role !== "ADMIN" &&
      data.role !== "USER"
    ) {
      return NextResponse.json(
        { error: "Role must be ADMIN or USER." },
        { status: 400 }
      );
    }

    if (hasActive && typeof data.isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be true or false." },
        { status: 400 }
      );
    }

    const nextRole = hasRole ? (data.role as UserRole) : undefined;
    const nextActive = hasActive ? (data.isActive as boolean) : undefined;

    // Prevent administrators from removing their own admin access.
    if (
      id === session.user.id &&
      (nextRole === "USER" || nextActive === false)
    ) {
      return NextResponse.json(
        {
          error: "You cannot deactivate your own account or remove your administrator role.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const targetUser = await tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });

        if (!targetUser) {
          return { kind: "not_found" as const };
        }

        const removingAdminAccess =
          targetUser.role === "ADMIN" &&
          targetUser.isActive &&
          (nextRole === "USER" || nextActive === false);

        // Never allow the last active administrator to lose access.
        if (removingAdminAccess) {
          const activeAdminCount = await tx.user.count({
            where: {
              role: "ADMIN",
              isActive: true,
            },
          });

          if (activeAdminCount <= 1) {
            return { kind: "last_admin" as const };
          }
        }

        const updatedUser = await tx.user.update({
          where: { id },
          data: {
            ...(nextRole !== undefined && { role: nextRole }),
            ...(nextActive !== undefined && { isActive: nextActive }),
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });

        return {
          kind: "success" as const,
          user: updatedUser,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    if (result.kind === "not_found") {
      return NextResponse.json(
        { error: "User account not found." },
        { status: 404 }
      );
    }

    if (result.kind === "last_admin") {
      return NextResponse.json(
        {
          error: "You cannot deactivate or demote the last active administrator.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "User account updated successfully.",
      user: result.user,
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        {
          error: "The account was modified concurrently. Please try again.",
        },
        { status: 409 }
      );
    }

    console.error("Failed to update user account:", error);

    return NextResponse.json(
      { error: "Failed to update user account." },
      { status: 500 }
    );
  }
}
