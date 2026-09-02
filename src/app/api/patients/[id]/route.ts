import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { id } = await params;

    const patientId = Number(id);

    if (Number.isNaN(patientId)) {
      return NextResponse.json(
        {
          message: "Invalid patient ID.",
        },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: {
        id: patientId,
      },
      include: {
        clinicRecords: {
          orderBy: {
            visitDate: "desc",
          },
        },
        documents: {
          orderBy: {
            createdAt: "desc",
          },
          include: {
            ocrResult: true,
          },
        },
      },
    });

    if (!patient) {
      return NextResponse.json(
        {
          message: "Patient not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(patient);
  } catch (error) {
    console.error("Get patient error:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch patient.",
      },
      { status: 500 }
    );
  }
}