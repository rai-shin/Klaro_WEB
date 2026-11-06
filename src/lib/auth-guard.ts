
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentSession() {
  const requestHeaders = await headers();

  return auth.api.getSession({
    headers: requestHeaders,
  });
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });

  if (!user?.isActive) {
    redirect("/auth?error=account_inactive");
  }

  return session;
}

export async function requireApiSession() {
  const session = await getCurrentSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });

  if (!user?.isActive) {
    return Response.json(
      { error: "Your account is inactive. Contact the system administrator." },
      { status: 403 }
    );
  }

  return null;
}

export async function requireAdmin() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/auth");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      isActive: true,
    },
  });

  if (!user?.isActive || user.role !== "ADMIN") {
    redirect("/auth?error=unauthorized");
  }

  return session;
}

export async function requireApiAdmin() {
  const session = await getCurrentSession();

  if (!session) {
    return Response.json(
      { error: "Unauthorized. Please log in." },
      { status: 401 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      isActive: true,
    },
  });

  if (!user?.isActive || user.role !== "ADMIN") {
    return Response.json(
      { error: "Forbidden. Administrator access is required." },
      { status: 403 }
    );
  }

  return null;
}
