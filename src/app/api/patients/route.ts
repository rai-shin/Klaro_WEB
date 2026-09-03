import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get("search")?.trim() || "";

    const patients = await prisma.patient.findMany({
      where: search
        ? {
            OR: [
              {
                studentId: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                firstName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                middleName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            ],
          }
        : undefined,

      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(patients);
  } catch (error) {
    console.error("Get patients error:", error);

    return NextResponse.json(
      {
        message: "Failed to fetch patients.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      studentId,
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      age,
      sex,
      grade,
      section,
      contactNumber,
      address,
    } = body;

    if (!studentId || !firstName || !lastName) {
      return NextResponse.json(
        {
          message:
            "Student ID, first name, and last name are required.",
        },
        { status: 400 }
      );
    }

    const existingPatient = await prisma.patient.findUnique({
      where: {
        studentId,
      },
    });

    if (existingPatient) {
      return NextResponse.json(
        {
          message:
            "A patient with this Student ID already exists.",
        },
        { status: 409 }
      );
    }

    const patient = await prisma.patient.create({
      data: {
        studentId,
        firstName,
        middleName: middleName || null,
        lastName,
        dateOfBirth: dateOfBirth
          ? new Date(dateOfBirth)
          : null,
        age: age ? Number(age) : null,
        sex: sex || null,
        grade: grade || null,
        section: section || null,
        contactNumber: contactNumber || null,
        address: address || null,
      },
    });

    return NextResponse.json(
      {
        message: "Patient created successfully.",
        patient,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create patient error:", error);

    return NextResponse.json(
      {
        message: "Failed to create patient.",
      },
      { status: 500 }
    );
  }
}