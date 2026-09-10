import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type RawOCRWordInput = {
  text: string;
  confidence: number;
};

type ReviewWordInput = {
  normalized: string;
  displayWord: string;
  confidence: number;
  occurrences: number;
  suggestion?: string | null;
  isFlagged?: boolean;
  decision?: string;
};

// --------------------------------------------------
// NORMALIZE WORD
// --------------------------------------------------

function normalizeWord(word: string) {
  return word
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim();
}

// --------------------------------------------------
// VALIDATE REVIEW DECISION
// --------------------------------------------------

function getReviewDecision(
  decision?: string
) {
  if (
    decision === "ACCEPTED" ||
    decision === "IGNORED" ||
    decision === "PENDING"
  ) {
    return decision;
  }

  return "PENDING";
}

// --------------------------------------------------
// POST
// --------------------------------------------------

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
      processingMethod,
      words,
      reviewWords,
    } = body;

    // ----------------------------------------
    // VALIDATE REQUIRED FIELDS
    // ----------------------------------------

    if (
      !documentId ||
      originalText === undefined ||
      correctedText === undefined ||
      !processingMethod
    ) {
      return NextResponse.json(
        {
          message:
            "Document, original text, corrected text, and processing method are required.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // VALIDATE TEXT
    // ----------------------------------------

    if (
      typeof originalText !== "string" ||
      typeof correctedText !== "string"
    ) {
      return NextResponse.json(
        {
          message:
            "Original text and corrected text must be strings.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // CONVERT DOCUMENT ID
    // ----------------------------------------

    const numericDocumentId =
      Number(documentId);

    if (
      !Number.isInteger(
        numericDocumentId
      ) ||
      numericDocumentId <= 0
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid document ID.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // VALIDATE PROCESSING METHOD
    // ----------------------------------------

    const allowedProcessingMethods = [
      "OCR_IMAGE",
      "OCR_PDF",
      "TEXT_EXTRACTION",
    ];

    if (
      !allowedProcessingMethods.includes(
        processingMethod
      )
    ) {
      return NextResponse.json(
        {
          message:
            "Invalid processing method.",
        },
        {
          status: 400,
        }
      );
    }

    // ----------------------------------------
    // CHECK DOCUMENT
    // ----------------------------------------

    const document =
      await prisma.document.findUnique({
        where: {
          id: numericDocumentId,
        },
      });

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

    // ----------------------------------------
    // VALIDATE CONFIDENCE
    // ----------------------------------------

    let numericConfidence:
      | number
      | null = null;

    if (
      confidence !== null &&
      confidence !== undefined
    ) {
      numericConfidence =
        Number(confidence);

      if (
        !Number.isFinite(
          numericConfidence
        ) ||
        numericConfidence < 0 ||
        numericConfidence > 100
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

    // ----------------------------------------
    // DETERMINE CORRECTIONS
    // ----------------------------------------

    const hasCorrections =
      originalText.trim() !==
      correctedText.trim();

    // ----------------------------------------
    // DETERMINE STATUS
    // ----------------------------------------

    let recordStatus = "REVIEW";

    if (
      processingMethod ===
      "TEXT_EXTRACTION"
    ) {
      recordStatus = "EXTRACTED";
    } else if (hasCorrections) {
      recordStatus = "CORRECTED";
    }

    // ----------------------------------------
    // PREPARE RAW OCR WORDS
    // ----------------------------------------

    const rawWords:
      RawOCRWordInput[] =
      Array.isArray(words)
        ? words
        : [];

    // ----------------------------------------
    // PREPARE REVIEW WORDS
    // ----------------------------------------

    const reviewWordList:
      ReviewWordInput[] =
      Array.isArray(reviewWords)
        ? reviewWords
        : [];

    // ----------------------------------------
    // CREATE REVIEW LOOKUP
    // ----------------------------------------

    const reviewLookup =
      new Map<
        string,
        ReviewWordInput
      >();

    for (
      const reviewWord of reviewWordList
    ) {
      if (
        !reviewWord ||
        typeof reviewWord.normalized !==
          "string"
      ) {
        continue;
      }

      const normalized =
        normalizeWord(
          reviewWord.normalized
        );

      if (!normalized) {
        continue;
      }

      reviewLookup.set(
        normalized,
        {
          ...reviewWord,
          normalized,
        }
      );
    }

    // ----------------------------------------
    // GROUP RAW WORDS
    //
    // This prevents duplicate OCR words
    // from being stored as separate records.
    // ----------------------------------------

    const groupedWords =
      new Map<
        string,
        {
          originalWord: string;
          confidence: number;
          occurrences: number;
        }
      >();

    for (
      const word of rawWords
    ) {
      if (
        !word ||
        typeof word.text !== "string"
      ) {
        continue;
      }

      const originalWord =
        word.text.trim();

      const normalized =
        normalizeWord(
          originalWord
        );

      if (!normalized) {
        continue;
      }

      const numericWordConfidence =
        Number(
          word.confidence
        );

      const validConfidence =
        Number.isFinite(
          numericWordConfidence
        )
          ? Math.max(
              0,
              Math.min(
                100,
                numericWordConfidence
              )
            )
          : 0;

      const existing =
        groupedWords.get(
          normalized
        );

      if (existing) {
        existing.occurrences += 1;

        existing.confidence =
          Math.min(
            existing.confidence,
            validConfidence
          );
      } else {
        groupedWords.set(
          normalized,
          {
            originalWord,
            confidence:
              validConfidence,
            occurrences: 1,
          }
        );
      }
    }

    // ----------------------------------------
    // PREPARE DATABASE WORD DATA
    // ----------------------------------------

    const preparedWords =
      Array.from(
        groupedWords.entries()
      ).map(
        ([
          normalized,
          wordData,
        ]) => {
          const reviewData =
            reviewLookup.get(
              normalized
            );

          const reviewOccurrences =
            Number(
              reviewData?.occurrences
            );

          const validOccurrences =
            Number.isFinite(
              reviewOccurrences
            ) &&
            reviewOccurrences > 0
              ? Math.floor(
                  reviewOccurrences
                )
              : wordData.occurrences;

          const isFlagged =
            reviewData?.isFlagged ??
            wordData.confidence < 70;

          const suggestedWord =
            reviewData?.suggestion
              ?.trim() || null;

          const reviewDecision =
            getReviewDecision(
              reviewData?.decision
            );

          return {
            originalWord:
              reviewData?.displayWord?.trim() ||
              wordData.originalWord,

            confidence:
              wordData.confidence,

            isFlagged,

            suggestedWord,

            reviewDecision,

            occurrences:
              validOccurrences,
          };
        }
      );

    // ----------------------------------------
    // CREATE OR UPDATE OCR RESULT
    // ----------------------------------------

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

          status:
            recordStatus,

          processingMethod,

          correctedAt:
            hasCorrections
              ? new Date()
              : null,

          words:
            preparedWords.length > 0
              ? {
                  create:
                    preparedWords,
                }
              : undefined,
        },

        update: {
          originalText,

          correctedText,

          confidence:
            numericConfidence,

          status:
            recordStatus,

          processingMethod,

          correctedAt:
            hasCorrections
              ? new Date()
              : null,

          words: {
            deleteMany: {},

            create:
              preparedWords,
          },
        },

        include: {
          words: true,
        },
      });

    // ----------------------------------------
    // UPDATE DOCUMENT
    // ----------------------------------------

    await prisma.document.update({
      where: {
        id: numericDocumentId,
      },

      data: {
        processingMethod,
      },
    });

    // ----------------------------------------
    // SUCCESS
    // ----------------------------------------

    return NextResponse.json(
      {
        message:
          "OCR result saved successfully.",

        result,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Save OCR result error:",
      error
    );

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Failed to save OCR result.",
      },
      {
        status: 500,
      }
    );
  }
}