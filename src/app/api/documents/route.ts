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
        include: {
          ocrResult: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } else {
      // Return all documents
      documents = await prisma.document.findMany({
        include: {
          ocrResult: true,
        },
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

// POST /api/documents
//
// Creates:
// Document
//   └── OCRResult
//
// This is used when saving an OCR-processed document.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      patientId,
      fileName,
      fileType,
      fileSize,
      filePath,
      documentType,
      processingMethod,
      originalText,
      correctedText,
      confidence,
      status,
      correctedAt,
    } = body;

    // -----------------------------
    // Validate patient ID
    // -----------------------------

    const patientIdNumber = Number(patientId);

    if (
      !Number.isInteger(patientIdNumber) ||
      patientIdNumber <= 0
    ) {
      return NextResponse.json(
        {
          message: "Invalid patient ID.",
        },
        { status: 400 }
      );
    }

    // -----------------------------
    // Validate OCR text
    // -----------------------------

    if (
      typeof originalText !== "string" ||
      !originalText.trim()
    ) {
      return NextResponse.json(
        {
          message: "Original OCR text is required.",
        },
        { status: 400 }
      );
    }

    if (
      typeof correctedText !== "string"
    ) {
      return NextResponse.json(
        {
          message: "Corrected OCR text is required.",
        },
        { status: 400 }
      );
    }

    // -----------------------------
    // Check patient exists
    // -----------------------------

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

    // -----------------------------
    // Validate confidence
    // -----------------------------

    let confidenceValue: number | null = null;

    if (
      confidence !== undefined &&
      confidence !== null &&
      confidence !== ""
    ) {
      confidenceValue = Number(confidence);

      if (
        Number.isNaN(confidenceValue) ||
        confidenceValue < 0 ||
        confidenceValue > 100
      ) {
        return NextResponse.json(
          {
            message:
              "Confidence must be a number between 0 and 100.",
          },
          { status: 400 }
        );
      }
    }

    // -----------------------------
    // Determine OCR status
    // -----------------------------

    const ocrStatus =
      typeof status === "string" &&
      status.trim()
        ? status.trim()
        : "REVIEWED";

    // -----------------------------
    // Create Document + OCRResult
    // -----------------------------

    const document =
      await prisma.document.create({
        data: {
          patientId: patientIdNumber,

          fileName:
            typeof fileName === "string" &&
            fileName.trim()
              ? fileName.trim()
              : `ocr-scan-${Date.now()}.jpg`,

          fileType:
            typeof fileType === "string" &&
            fileType.trim()
              ? fileType.trim()
              : "image/jpeg",

          fileSize:
            fileSize !== undefined &&
            fileSize !== null &&
            fileSize !== ""
              ? Number(fileSize)
              : null,

          filePath:
            typeof filePath === "string" &&
            filePath.trim()
              ? filePath.trim()
              : null,

          documentType:
            typeof documentType === "string" &&
            documentType.trim()
              ? documentType.trim()
              : "OCR Scan",

          processingMethod:
            typeof processingMethod === "string" &&
            processingMethod.trim()
              ? processingMethod.trim()
              : "Tesseract OCR",

          ocrResult: {
            create: {
              originalText:
                originalText.trim(),

              correctedText:
                correctedText.trim(),

              confidence:
                confidenceValue,

              status:
                ocrStatus,

              processingMethod:
                typeof processingMethod ===
                  "string" &&
                processingMethod.trim()
                  ? processingMethod.trim()
                  : "Tesseract OCR",

              correctedAt:
                correctedAt
                  ? new Date(correctedAt)
                  : new Date(),
            },
          },
        },

        include: {
          ocrResult: true,
        },
      });

    // -----------------------------
    // Success
    // -----------------------------

    return NextResponse.json(
      {
        message:
          "Document and OCR result saved successfully.",
        document,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Create document/OCR result error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Failed to save document and OCR result.",
      },
      { status: 500 }
    );
  }
}