import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      documentId,
      originalText,
      correctedText,
      confidence,
      processingMethod,
    } = body;

    // Validate required fields
    if (
      !documentId ||
      originalText === undefined ||
      correctedText === undefined ||
      !processingMethod
    ) {
      return NextResponse.json(
        {
          message:
            "Document, OCR text, corrected text, and processing method are required.",
        },
        { status: 400 }
      );
    }

    // Convert document ID
    const numericDocumentId = Number(
      documentId
    );

    if (Number.isNaN(numericDocumentId)) {
      return NextResponse.json(
        {
          message: "Invalid document ID.",
        },
        { status: 400 }
      );
    }

    // Find existing document
    const document =
      await prisma.document.findUnique({
        where: {
          id: numericDocumentId,
        },
      });

    if (!document) {
      return NextResponse.json(
        {
          message: "Document not found.",
        },
        { status: 404 }
      );
    }

    // Confidence can be null for DOCX
    let numericConfidence:
      | number
      | null = null;

    if (
      confidence !== null &&
      confidence !== undefined
    ) {
      numericConfidence = Number(
        confidence
      );

      if (
        Number.isNaN(numericConfidence) ||
        numericConfidence < 0 ||
        numericConfidence > 100
      ) {
        return NextResponse.json(
          {
            message:
              "Confidence must be between 0 and 100.",
          },
          { status: 400 }
        );
      }
    }

    // Determine whether corrections were made
    const hasCorrections =
      originalText !== correctedText;

    // Determine status
    let recordStatus = "REVIEW";

    if (
      processingMethod ===
      "TEXT_EXTRACTION"
    ) {
      recordStatus = "EXTRACTED";
    } else if (hasCorrections) {
      recordStatus = "CORRECTED";
    }

    // Create or update OCR result
    const result =
      await prisma.oCRResult.upsert({
        where: {
          documentId:
            numericDocumentId,
        },

        create: {
          documentId:
            numericDocumentId,

          originalText,

          correctedText,

          confidence:
            numericConfidence,

          status: recordStatus,

          processingMethod,

          correctedAt:
            hasCorrections
              ? new Date()
              : null,
        },

        update: {
          originalText,

          correctedText,

          confidence:
            numericConfidence,

          status: recordStatus,

          processingMethod,

          correctedAt:
            hasCorrections
              ? new Date()
              : null,
        },
      });

    // Update the document's processing method
    await prisma.document.update({
      where: {
        id: numericDocumentId,
      },

      data: {
        processingMethod,
      },
    });

    return NextResponse.json(
      {
        message:
          "OCR result saved successfully.",

        result,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Save OCR result error:",
      error
    );

    return NextResponse.json(
      {
        message:
          "Failed to save OCR result.",
      },
      { status: 500 }
    );
  }
}