
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/documents
// GET /api/documents?patientId=1
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientIdValue = searchParams.get("patientId");

    let documents;

    // If patientId is provided, return documents for that patient
    if (patientIdValue) {
      const patientId = Number(patientIdValue);

      if (!Number.isInteger(patientId) || patientId <= 0) {
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
      });

      if (!patient) {
        return NextResponse.json(
          {
            message: "Patient not found.",
          },
          { status: 404 }
        );
      }

      documents = await prisma.document.findMany({
        where: {
          patientId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } else {
      // Return all documents
      documents = await prisma.document.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    return NextResponse.json(documents, {
      status: 200,
    });
  } catch (error) {
    console.error("Get documents error:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch documents.",
      },
      { status: 500 }
    );
  }
}

