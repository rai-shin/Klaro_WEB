import {
  NextResponse,
} from "next/server";

import {
  prisma,
} from "@/lib/prisma";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const {
      documentId,
      originalText,
      correctedText,
      confidence,
      status,
      processingMethod,
      correctedAt,
    } = body;

    /*
     * ------------------------------------------------
     * VALIDATION
     * ------------------------------------------------
     */

    if (
      !documentId ||
      Number.isNaN(
        Number(documentId)
      )
    ) {
      return NextResponse.json(
        {
          message:
            "A valid document ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof originalText !==
        "string" ||
      !originalText.trim()
    ) {
      return NextResponse.json(
        {
          message:
            "Original OCR text is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      typeof correctedText !==
        "string"
    ) {
      return NextResponse.json(
        {
          message:
            "Corrected OCR text is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ------------------------------------------------
     * CONVERT DOCUMENT ID
     * ------------------------------------------------
     */

    const parsedDocumentId =
      Number(documentId);

    /*
     * ------------------------------------------------
     * VALIDATE CONFIDENCE
     * ------------------------------------------------
     */

    let parsedConfidence:
      | number
      | null = null;

    if (
      confidence !==
        undefined &&
      confidence !==
        null &&
      confidence !==
        ""
    ) {
      parsedConfidence =
        Number(confidence);

      if (
        Number.isNaN(
          parsedConfidence
        )
      ) {
        return NextResponse.json(
          {
            message:
              "Confidence must be a valid number.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        parsedConfidence <
          0 ||
        parsedConfidence >
          100
      ) {
        return NextResponse.json(
          {
            message:
              "Confidence must be between 0 and 100.",
          },
          {
            status: 400,
          }
        );
      }
    }

    /*
     * ------------------------------------------------
     * CHECK DOCUMENT
     * ------------------------------------------------
     */

    const document =
      await prisma.document.findUnique(
        {
          where: {
            id:
              parsedDocumentId,
          },

          include: {
            patient: true,
            ocrResult: true,
          },
        }
      );

    if (!document) {
      return NextResponse.json(
        {
          message:
            "Document not found.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * ------------------------------------------------
     * PREVENT DUPLICATE OCR RESULT
     * ------------------------------------------------
     */

    if (
      document.ocrResult
    ) {
      return NextResponse.json(
        {
          message:
            "An OCR result already exists for this document.",
          ocrResult:
            document.ocrResult,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * ------------------------------------------------
     * DETERMINE STATUS
     * ------------------------------------------------
     */

    const hasCorrection =
      correctedText.trim() !==
      originalText.trim();

    const finalStatus =
      typeof status ===
        "string" &&
      status.trim()
        ? status.trim()
        : hasCorrection
          ? "CORRECTED"
          : "REVIEWED";

    /*
     * ------------------------------------------------
     * PROCESSING METHOD
     * ------------------------------------------------
     */

    const finalProcessingMethod =
      typeof processingMethod ===
        "string" &&
      processingMethod.trim()
        ? processingMethod.trim()
        : "Tesseract OCR";

    /*
     * ------------------------------------------------
     * CORRECTED DATE
     * ------------------------------------------------
     */

    let finalCorrectedAt:
      | Date
      | null = null;

    if (
      correctedAt
    ) {
      const date =
        new Date(
          correctedAt
        );

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {
        return NextResponse.json(
          {
            message:
              "Invalid correctedAt date.",
          },
          {
            status: 400,
          }
        );
      }

      finalCorrectedAt =
        date;
    } else if (
      hasCorrection
    ) {
      finalCorrectedAt =
        new Date();
    }

    /*
     * ------------------------------------------------
     * CREATE OCR RESULT
     * ------------------------------------------------
     */

    const ocrResult =
      await prisma.oCRResult.create(
        {
          data: {
            documentId:
              parsedDocumentId,

            originalText:
              originalText.trim(),

            correctedText:
              correctedText.trim(),

            confidence:
              parsedConfidence,

            status:
              finalStatus,

            processingMethod:
              finalProcessingMethod,

            correctedAt:
              finalCorrectedAt,
          },

          include: {
            document: {
              include: {
                patient: true,
              },
            },
          },
        }
      );

    /*
     * ------------------------------------------------
     * RESPONSE
     * ------------------------------------------------
     */

    return NextResponse.json(
      {
        message:
          "OCR result saved successfully.",

        ocrResult,
      },
      {
        status: 201,
      }
    );
  } catch (
    error
  ) {
    console.error(
      "Create OCR result error:",
      error
    );

    /*
     * Handle Prisma unique constraint.
     *
     * documentId is @unique in OCRResult.
     */

    if (
      typeof error ===
        "object" &&
      error !== null &&
      "code" in error &&
      (error as {
        code?: string;
      }).code ===
        "P2002"
    ) {
      return NextResponse.json(
        {
          message:
            "An OCR result already exists for this document.",
        },
        {
          status: 409,
        }
      );
    }

    return NextResponse.json(
      {
        message:
          "Failed to save OCR result.",
      },
      {
        status: 500,
      }
    );
  }
}