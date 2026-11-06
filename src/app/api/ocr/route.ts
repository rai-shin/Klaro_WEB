
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiSession } from "@/lib/auth-guard";

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
  decision?: "ACCEPTED" | "IGNORED" | "PENDING";
};

const ALLOWED_PROCESSING_METHODS = [
  "OCR_IMAGE",
  "OCR_PDF",
  "TEXT_EXTRACTION",
] as const;

const ALLOWED_REVIEW_DECISIONS = [
  "ACCEPTED",
  "IGNORED",
  "PENDING",
] as const;

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
// VALIDATE REQUEST BODY
// --------------------------------------------------

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isRawOCRWord(
  value: unknown
): value is RawOCRWordInput {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.text === "string" &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 100
  );
}

function isReviewWord(
  value: unknown
): value is ReviewWordInput {
  if (!isObject(value)) {
    return false;
  }

  const validDecision =
    value.decision === undefined ||
    ALLOWED_REVIEW_DECISIONS.includes(
      value.decision as (typeof ALLOWED_REVIEW_DECISIONS)[number]
    );

  const validSuggestion =
    value.suggestion === undefined ||
    value.suggestion === null ||
    typeof value.suggestion === "string";

  const validFlag =
    value.isFlagged === undefined ||
    typeof value.isFlagged === "boolean";

  return (
    typeof value.normalized === "string" &&
    typeof value.displayWord === "string" &&
    typeof value.confidence === "number" &&
    Number.isFinite(value.confidence) &&
    value.confidence >= 0 &&
    value.confidence <= 100 &&
    typeof value.occurrences === "number" &&
    Number.isSafeInteger(value.occurrences) &&
    value.occurrences > 0 &&
    validDecision &&
    validSuggestion &&
    validFlag
  );
}

// --------------------------------------------------
// POST
// --------------------------------------------------

export async function POST(request: Request) {
  try {
    // ----------------------------------------
    // AUTHENTICATION
    // ----------------------------------------

    const authError = await requireApiSession();

    if (authError) {
      return authError;
    }

    // ----------------------------------------
    // PARSE REQUEST BODY
    // ----------------------------------------

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          message: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    if (!isObject(body)) {
      return NextResponse.json(
        {
          message: "Invalid request body.",
        },
        { status: 400 }
      );
    }

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
      documentId === undefined ||
      documentId === null ||
      originalText === undefined ||
      correctedText === undefined ||
      !processingMethod
    ) {
      return NextResponse.json(
        {
          message:
            "Document, original text, corrected text, and processing method are required.",
        },
        { status: 400 }
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
        { status: 400 }
      );
    }

    // ----------------------------------------
    // CONVERT AND VALIDATE DOCUMENT ID
    // ----------------------------------------

    const numericDocumentId = Number(documentId);

    if (
      !Number.isSafeInteger(numericDocumentId) ||
      numericDocumentId <= 0
    ) {
      return NextResponse.json(
        {
          message: "Invalid document ID.",
        },
        { status: 400 }
      );
    }

    // ----------------------------------------
    // VALIDATE PROCESSING METHOD
    // ----------------------------------------

    if (
      typeof processingMethod !== "string" ||
      !ALLOWED_PROCESSING_METHODS.includes(
        processingMethod as (typeof ALLOWED_PROCESSING_METHODS)[number]
      )
    ) {
      return NextResponse.json(
        {
          message: "Invalid processing method.",
        },
        { status: 400 }
      );
    }

    // ----------------------------------------
    // VALIDATE CONFIDENCE
    // ----------------------------------------

    let numericConfidence: number | null = null;

    if (confidence !== null && confidence !== undefined) {
      if (
        typeof confidence !== "number" ||
        !Number.isFinite(confidence) ||
        confidence < 0 ||
        confidence > 100
      ) {
        return NextResponse.json(
          {
            message: "Confidence must be between 0 and 100.",
          },
          { status: 400 }
        );
      }

      numericConfidence = confidence;
    }

    // ----------------------------------------
    // VALIDATE WORD ARRAYS
    // ----------------------------------------

    if (
      words !== undefined &&
      !Array.isArray(words)
    ) {
      return NextResponse.json(
        {
          message: "OCR words must be an array.",
        },
        { status: 400 }
      );
    }

    if (
      reviewWords !== undefined &&
      !Array.isArray(reviewWords)
    ) {
      return NextResponse.json(
        {
          message: "Review words must be an array.",
        },
        { status: 400 }
      );
    }

    const rawWords: RawOCRWordInput[] =
      words ?? [];

    const reviewWordList: ReviewWordInput[] =
      reviewWords ?? [];

    if (!rawWords.every(isRawOCRWord)) {
      return NextResponse.json(
        {
          message: "One or more OCR words contain invalid data.",
        },
        { status: 400 }
      );
    }

    if (!reviewWordList.every(isReviewWord)) {
      return NextResponse.json(
        {
          message: "One or more review words contain invalid data.",
        },
        { status: 400 }
      );
    }

    // ----------------------------------------
    // CHECK DOCUMENT
    // ----------------------------------------

    const document = await prisma.document.findUnique({
      where: {
        id: numericDocumentId,
      },
      select: {
        id: true,
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

    // ----------------------------------------
    // DETERMINE CORRECTIONS AND STATUS
    // ----------------------------------------

    const hasCorrections =
      originalText.trim() !== correctedText.trim();

    let recordStatus = "REVIEW";

    if (processingMethod === "TEXT_EXTRACTION") {
      recordStatus = "EXTRACTED";
    } else if (hasCorrections) {
      recordStatus = "CORRECTED";
    }

    // ----------------------------------------
    // PREPARE REVIEW WORD LOOKUP
    // ----------------------------------------

    const reviewLookup = new Map<
      string,
      ReviewWordInput
    >();

    for (const reviewWord of reviewWordList) {
      const normalized = normalizeWord(
        reviewWord.normalized
      );

      if (!normalized) {
        continue;
      }

      reviewLookup.set(normalized, {
        ...reviewWord,
        normalized,
      });
    }

    // ----------------------------------------
    // GROUP DUPLICATE OCR WORDS
    // ----------------------------------------

    const groupedWords = new Map<
      string,
      {
        originalWord: string;
        confidence: number;
        occurrences: number;
      }
    >();

    for (const word of rawWords) {
      const originalWord = word.text.trim();

      const normalized = normalizeWord(
        originalWord
      );

      if (!normalized) {
        continue;
      }

      const validConfidence = Math.max(
        0,
        Math.min(100, word.confidence)
      );

      const existing = groupedWords.get(normalized);

      if (existing) {
        existing.occurrences += 1;

        existing.confidence = Math.min(
          existing.confidence,
          validConfidence
        );
      } else {
        groupedWords.set(normalized, {
          originalWord,
          confidence: validConfidence,
          occurrences: 1,
        });
      }
    }

    // ----------------------------------------
    // PREPARE DATABASE WORD DATA
    // ----------------------------------------

    const preparedWords = Array.from(
      groupedWords.entries()
    ).map(([normalized, wordData]) => {
      const reviewData = reviewLookup.get(normalized);

      const validOccurrences =
        reviewData?.occurrences ??
        wordData.occurrences;

      const isFlagged =
        reviewData?.isFlagged ??
        wordData.confidence < 70;

      const suggestedWord =
        reviewData?.suggestion?.trim() || null;

      const reviewDecision =
        reviewData?.decision ?? "PENDING";

      return {
        originalWord:
          reviewData?.displayWord.trim() ||
          wordData.originalWord,

        confidence: wordData.confidence,

        isFlagged,

        suggestedWord,

        reviewDecision,

        occurrences: validOccurrences,
      };
    });

    // ----------------------------------------
    // SAVE OCR RESULT AND UPDATE DOCUMENT
    // ATOMICALLY USING A TRANSACTION
    // ----------------------------------------

    const result = await prisma.$transaction(
      async (tx) => {
        const savedResult = await tx.oCRResult.upsert({
          where: {
            documentId: numericDocumentId,
          },

          create: {
            documentId: numericDocumentId,
            originalText,
            correctedText,
            confidence: numericConfidence,
            status: recordStatus,
            processingMethod,

            correctedAt: hasCorrections
              ? new Date()
              : null,

            words:
              preparedWords.length > 0
                ? {
                    create: preparedWords,
                  }
                : undefined,
          },

          update: {
            originalText,
            correctedText,
            confidence: numericConfidence,
            status: recordStatus,
            processingMethod,

            correctedAt: hasCorrections
              ? new Date()
              : null,

            words: {
              deleteMany: {},
              create: preparedWords,
            },
          },

          include: {
            words: true,
          },
        });

        await tx.document.update({
          where: {
            id: numericDocumentId,
          },

          data: {
            processingMethod,
          },
        });

        return savedResult;
      }
    );

    // ----------------------------------------
    // SUCCESS
    // ----------------------------------------

    return NextResponse.json(
      {
        message: "OCR result saved successfully.",
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
        message: "Failed to save OCR result.",
      },
      { status: 500 }
    );
  }
}
