
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth-guard";

export async function GET(request: Request) {
  const authError = await requireApiSession();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const patientIdParam = searchParams.get("patientId");

    const patientId = patientIdParam
      ? Number(patientIdParam)
      : undefined;

    if (
      patientIdParam &&
      (!Number.isInteger(patientId) || patientId! <= 0)
    ) {
      return NextResponse.json(
        { message: "Invalid patient ID." },
        { status: 400 }
      );
    }

    const visitationLogs = await prisma.visitationLog.findMany({
      where: patientId ? { patientId } : undefined,
      include: {
        patient: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            middleName: true,
            lastName: true,
            grade: true,
            section: true,
          },
        },
      },
      orderBy: [
        { visitDate: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(visitationLogs);
  } catch (error) {
    console.error("Get visitation logs error:", error);

    return NextResponse.json(
      { message: "Failed to fetch visitation records." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const authError = await requireApiSession();
  if (authError) return authError;

  try {
    const body = await request.json();

    const patientId = Number(body.patientId);
    const visitDate = String(body.visitDate ?? "").trim();
    const timeIn = String(body.timeIn ?? "").trim();

    if (
      !Number.isInteger(patientId) ||
      patientId <= 0
    ) {
      return NextResponse.json(
        { message: "A valid patient is required." },
        { status: 400 }
      );
    }

    if (!visitDate || !timeIn) {
      return NextResponse.json(
        { message: "Visit date and time in are required." },
        { status: 400 }
      );
    }

    // Store the calendar date without shifting it across time zones.
    const parsedDate = new Date(`${visitDate}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== visitDate
    ) {
      return NextResponse.json(
        { message: "Invalid visit date." },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });

    if (!patient) {
      return NextResponse.json(
        { message: "Patient not found." },
        { status: 404 }
      );
    }

    const visitationLog = await prisma.visitationLog.create({
      data: {
        patientId,
        visitDate: parsedDate,
        timeIn,
        courseYearBlock: body.courseYearBlock || null,
        complaint: body.complaint || null,
        signature: body.signature || null,
        medicineGiven: body.medicineGiven || null,
        quantity: body.quantity || null,
        adviserInformed: body.adviserInformed || "No",
        guardianInformed: body.guardianInformed || "No",
        finalEvaluation: body.finalEvaluation || null,
        timeOut: body.timeOut || null,
        nod: body.nod || null,
      },
      include: {
        patient: {
          select: {
            id: true,
            studentId: true,
            firstName: true,
            middleName: true,
            lastName: true,
            grade: true,
            section: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "Visitation record saved successfully.",
        visitationLog,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create visitation log error:", error);

    return NextResponse.json(
      { message: "Failed to save visitation record." },
      { status: 500 }
    );
  }
}
