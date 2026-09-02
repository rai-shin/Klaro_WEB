import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET clinic records
//
// GET /api/clinic-records
//     → returns all clinic records
//
// GET /api/clinic-records?patientId=1
//     → returns records for patient 1
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    let records;

    if (patientId) {
      const patientIdNumber = Number(patientId);

      if (!Number.isInteger(patientIdNumber) || patientIdNumber <= 0) {
        return NextResponse.json(
          {
            message: "Invalid patient ID.",
          },
          { status: 400 }
        );
      }

      const patient = await prisma.patient.findUnique({
        where: {
          id: patientIdNumber,
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

      records = await prisma.clinicRecord.findMany({
        where: {
          patientId: patientIdNumber,
        },
        orderBy: {
          visitDate: "desc",
        },
      });
    } else {
      records = await prisma.clinicRecord.findMany({
        orderBy: {
          visitDate: "desc",
        },
      });
    }

    return NextResponse.json(records, { status: 200 });
  } catch (error) {
    console.error("Get clinic records error:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch clinic records.",
      },
      { status: 500 }
    );
  }
}

// POST clinic record
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      patientId,
      visitDate,
      chiefComplaint,
      symptoms,
      temperature,
      bloodPressure,
      diagnosis,
      treatment,
      medication,
      remarks,
    } = body;

    if (!patientId || !visitDate) {
      return NextResponse.json(
        {
          message: "Patient and visit date are required.",
        },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: {
        id: Number(patientId),
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

    const record = await prisma.clinicRecord.create({
      data: {
        patientId: Number(patientId),
        visitDate: new Date(visitDate),
        chiefComplaint: chiefComplaint || null,
        symptoms: symptoms || null,
        temperature: temperature || null,
        bloodPressure: bloodPressure || null,
        diagnosis: diagnosis || null,
        treatment: treatment || null,
        medication: medication || null,
        remarks: remarks || null,
      },
    });

    return NextResponse.json(
      {
        message: "Clinic record created successfully.",
        record,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create clinic record error:", error);

    return NextResponse.json(
      {
        message: "Failed to create clinic record.",
      },
      { status: 500 }
    );
  }
}