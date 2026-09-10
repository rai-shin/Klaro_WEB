import { NextRequest, NextResponse } from "next/server";
import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type OCRWord = {
  text: string;
  confidence: number;
  originalConfidence?: number;

  // Suggestion is now separate from OCR text.
  suggestion?: string | null;

  // False means OCR text has NOT been changed.
  corrected?: boolean;

  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
};

type OCRCandidate = {
  name: string;
  text: string;
  words: OCRWord[];

  tesseractConfidence: number;

  tokenCount: number;
  meaningfulWordCount: number;
  garbageRatio: number;

  bboxCoverage: number;
  horizontalCoverage: number;
  verticalCoverage: number;

  lineCount: number;

  quality: number;
  score: number;

  suspicious: boolean;
};

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const CONFIDENCE_THRESHOLD = 70;

// --------------------------------------------------
// BASIC HELPERS
// --------------------------------------------------

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}

function normalizeWhitespace(
  text: string
) {
  return text
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(
  text: string
) {
  return text
    .trim()
    .toLowerCase()
    .replace(
      /^[^a-z0-9]+|[^a-z0-9]+$/gi,
      ""
    );
}

function cleanOCRText(
  text: string
) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) =>
      normalizeWhitespace(line)
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

// --------------------------------------------------
// SHORT WORDS ALLOWED
// --------------------------------------------------

const ALLOW_SHORT_WORDS = new Set([
  "a",
  "i",
  "an",
  "am",
  "as",
  "at",
  "be",
  "by",
  "do",
  "go",
  "he",
  "if",
  "in",
  "is",
  "it",
  "me",
  "my",
  "no",
  "of",
  "on",
  "or",
  "so",
  "to",
  "up",
  "us",
  "we",

  "id",
  "nr",
  "mr",
  "mrs",
  "ms",
  "dr",
  "rn",
  "md",
  "er",
  "bp",
  "hr",
  "rr",
  "bmi",
  "o2",
  "temp",
  "dob",
  "age",
  "sex",
  "m",
  "f",
]);

// --------------------------------------------------
// GARBAGE DETECTION
// --------------------------------------------------

function isProbablyGarbage(
  text: string,
  confidence: number
): boolean {
  const normalized =
    normalizeToken(text);

  if (!normalized) {
    return true;
  }

  if (confidence < 15) {
    return true;
  }

  if (
    /^[^a-zA-Z0-9]+$/.test(text)
  ) {
    return true;
  }

  if (
    /[<>{}\[\]\\|]/.test(text)
  ) {
    return true;
  }

  if (
    /^(.)\1{3,}$/i.test(normalized)
  ) {
    return true;
  }

  if (
    normalized.length > 40
  ) {
    return true;
  }

  if (
    normalized.length >= 5 &&
    !/[aeiou]/i.test(normalized) &&
    !ALLOW_SHORT_WORDS.has(
      normalized
    )
  ) {
    return true;
  }

  const punctuationCount =
    text.match(
      /[^a-zA-Z0-9\s]/g
    )?.length ?? 0;

  if (
    text.length > 2 &&
    punctuationCount / text.length >
      0.6
  ) {
    return true;
  }

  return false;
}

// --------------------------------------------------
// PARSE HOCR
// IMPORTANT:
// Original OCR text is preserved.
// No automatic correction happens here.
// --------------------------------------------------

function parseHOCR(
  hocr: string
): OCRWord[] {
  if (!hocr) {
    return [];
  }

  const words: OCRWord[] = [];

  const wordRegex =
    /<span[^>]*class=['"][^'"]*(?:ocrx_word|ocr_word)[^'"]*['"][^>]*title=['"]([^'"]*)['"][^>]*>([\s\S]*?)<\/span>/gi;

  let match:
    | RegExpExecArray
    | null;

  while (
    (match =
      wordRegex.exec(hocr)) !== null
  ) {
    const title =
      match[1];

    const rawText =
      match[2]
        .replace(
          /<[^>]+>/g,
          ""
        )
        .trim();

    if (!rawText) {
      continue;
    }

    const bboxMatch =
      title.match(
        /bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i
      );

    const confidenceMatch =
      title.match(
        /x_wconf\s+(-?\d+(?:\.\d+)?)/i
      );

    const confidence =
      confidenceMatch
        ? Number(
            confidenceMatch[1]
          )
        : 0;

    const bbox =
      bboxMatch
        ? {
            x0: Number(
              bboxMatch[1]
            ),

            y0: Number(
              bboxMatch[2]
            ),

            x1: Number(
              bboxMatch[3]
            ),

            y1: Number(
              bboxMatch[4]
            ),
          }
        : undefined;

    // IMPORTANT:
    // Preserve exactly what OCR returned.
    words.push({
      text: rawText,

      confidence,

      originalConfidence:
        confidence,

      suggestion: null,

      corrected: false,

      bbox,
    });
  }

  return words;
}

// --------------------------------------------------
// PARSE TSV
// IMPORTANT:
// Original OCR text is preserved.
// --------------------------------------------------

function parseTSV(
  tsv: string
): OCRWord[] {
  if (!tsv) {
    return [];
  }

  const lines =
    tsv.split(/\r?\n/);

  if (lines.length < 2) {
    return [];
  }

  const words: OCRWord[] = [];

  for (
    let i = 1;
    i < lines.length;
    i++
  ) {
    const line =
      lines[i];

    if (!line.trim()) {
      continue;
    }

    const parts =
      line.split("\t");

    if (
      parts.length < 12
    ) {
      continue;
    }

    const level =
      Number(parts[0]);

    // Level 5 = word
    if (level !== 5) {
      continue;
    }

    const left =
      Number(parts[6]);

    const top =
      Number(parts[7]);

    const width =
      Number(parts[8]);

    const height =
      Number(parts[9]);

    const confidence =
      Number(parts[10]);

    const rawText =
      parts
        .slice(11)
        .join("\t")
        .trim();

    if (!rawText) {
      continue;
    }

    // IMPORTANT:
    // Do NOT automatically change rawText.
    words.push({
      text: rawText,

      confidence:
        Number.isFinite(confidence)
          ? confidence
          : 0,

      originalConfidence:
        Number.isFinite(confidence)
          ? confidence
          : 0,

      suggestion: null,

      corrected: false,

      bbox: {
        x0: left,

        y0: top,

        x1:
          left + width,

        y1:
          top + height,
      },
    });
  }

  return words;
}

// --------------------------------------------------
// REMOVE DUPLICATES
// --------------------------------------------------

function deduplicateWords(
  words: OCRWord[]
): OCRWord[] {
  const result: OCRWord[] = [];

  for (
    const word of words
  ) {
    if (!word.text.trim()) {
      continue;
    }

    const duplicate =
      result.find(
        (existing) => {
          if (
            existing.text.toLowerCase() !==
            word.text.toLowerCase()
          ) {
            return false;
          }

          if (
            !existing.bbox ||
            !word.bbox
          ) {
            return false;
          }

          const xDistance =
            Math.abs(
              existing.bbox.x0 -
                word.bbox.x0
            );

          const yDistance =
            Math.abs(
              existing.bbox.y0 -
                word.bbox.y0
            );

          return (
            xDistance < 5 &&
            yDistance < 5
          );
        }
      );

    if (!duplicate) {
      result.push(word);

      continue;
    }

    if (
      word.confidence >
      duplicate.confidence
    ) {
      duplicate.confidence =
        word.confidence;

      duplicate.originalConfidence =
        word.originalConfidence;

      duplicate.bbox =
        word.bbox;
    }
  }

  return result;
}

// --------------------------------------------------
// BUILD TEXT FROM WORD POSITIONS
// --------------------------------------------------

function buildTextFromWords(
  words: OCRWord[]
): string {
  if (
    words.length === 0
  ) {
    return "";
  }

  const wordsWithBbox =
    words.filter(
      (word) =>
        word.bbox
    );

  if (
    wordsWithBbox.length < 2
  ) {
    return cleanOCRText(
      words
        .map(
          (word) =>
            word.text
        )
        .join(" ")
    );
  }

  const sorted =
    [...wordsWithBbox].sort(
      (a, b) => {
        const ay =
          a.bbox!.y0;

        const by =
          b.bbox!.y0;

        if (
          Math.abs(
            ay - by
          ) > 12
        ) {
          return ay - by;
        }

        return (
          a.bbox!.x0 -
          b.bbox!.x0
        );
      }
    );

  const lines:
    OCRWord[][] = [];

  for (
    const word of sorted
  ) {
    const currentLine =
      lines[
        lines.length - 1
      ];

    if (!currentLine) {
      lines.push([
        word,
      ]);

      continue;
    }

    const currentY =
      currentLine.reduce(
        (sum, item) =>
          sum +
          item.bbox!.y0,
        0
      ) /
      currentLine.length;

    if (
      Math.abs(
        word.bbox!.y0 -
          currentY
      ) <= 12
    ) {
      currentLine.push(
        word
      );
    } else {
      lines.push([
        word,
      ]);
    }
  }

  return cleanOCRText(
    lines
      .map(
        (line) =>
          line
            .sort(
              (a, b) =>
                a.bbox!.x0 -
                b.bbox!.x0
            )
            .map(
              (word) =>
                word.text
            )
            .join(" ")
      )
      .join("\n")
  );
}

// --------------------------------------------------
// CALCULATE CANDIDATE METRICS
// --------------------------------------------------

function calculateCandidateMetrics(
  words: OCRWord[],
  rawText: string,
  tesseractConfidence: number,
  imageWidth: number,
  imageHeight: number
) {
  const tokenCount =
    words.length;

  const meaningfulWords =
    words.filter(
      (word) =>
        !isProbablyGarbage(
          word.text,
          word.confidence
        )
    );

  const meaningfulWordCount =
    meaningfulWords.length;

  const garbageCount =
    tokenCount -
    meaningfulWordCount;

  const garbageRatio =
    tokenCount > 0
      ? garbageCount /
        tokenCount
      : 1;

  // Average individual word confidence
  const wordConfidence =
    tokenCount > 0
      ? words.reduce(
          (sum, word) =>
            sum +
            word.confidence,
          0
        ) / tokenCount
      : 0;

  // Combine word confidence with
  // Tesseract's overall confidence.
  const combinedConfidence =
    wordConfidence * 0.65 +
    tesseractConfidence *
      0.35;

  const wordsWithBbox =
    words.filter(
      (word) =>
        word.bbox
    );

  let bboxCoverage = 0;

  let horizontalCoverage = 0;

  let verticalCoverage = 0;

  if (
    wordsWithBbox.length > 0 &&
    imageWidth > 0 &&
    imageHeight > 0
  ) {
    let minX =
      imageWidth;

    let minY =
      imageHeight;

    let maxX = 0;

    let maxY = 0;

    for (
      const word of wordsWithBbox
    ) {
      const bbox =
        word.bbox!;

      minX = Math.min(
        minX,
        bbox.x0
      );

      minY = Math.min(
        minY,
        bbox.y0
      );

      maxX = Math.max(
        maxX,
        bbox.x1
      );

      maxY = Math.max(
        maxY,
        bbox.y1
      );
    }

    const width =
      clamp(
        maxX - minX,
        0,
        imageWidth
      );

    const height =
      clamp(
        maxY - minY,
        0,
        imageHeight
      );

    horizontalCoverage =
      clamp(
        width / imageWidth,
        0,
        1
      );

    verticalCoverage =
      clamp(
        height /
          imageHeight,
        0,
        1
      );

    bboxCoverage =
      horizontalCoverage *
      verticalCoverage;
  }

  let lineCount = 0;

  if (
    wordsWithBbox.length > 0
  ) {
    const sorted =
      [...wordsWithBbox].sort(
        (a, b) =>
          a.bbox!.y0 -
          b.bbox!.y0
      );

    const lineYs:
      number[] = [];

    for (
      const word of sorted
    ) {
      const y =
        word.bbox!.y0;

      const existingLine =
        lineYs.find(
          (lineY) =>
            Math.abs(
              lineY - y
            ) <= 12
        );

      if (
        existingLine ===
        undefined
      ) {
        lineYs.push(y);
      }
    }

    lineCount =
      lineYs.length;
  } else {
    lineCount =
      rawText
        .split("\n")
        .filter(Boolean)
        .length;
  }

  const tokenScore =
    clamp(
      tokenCount / 5,
      0,
      1
    ) * 100;

  const meaningfulScore =
    tokenCount > 0
      ? (meaningfulWordCount /
          tokenCount) *
        100
      : 0;

  // OCR QUALITY FORMULA
  //
  // 55% Combined OCR confidence
  // 25% Meaningful word ratio
  // 15% Garbage detection quality
  //  5% Minimum token quality

  const quality =
    combinedConfidence * 0.55 +
    meaningfulScore * 0.25 +
    (100 -
      garbageRatio * 100) *
      0.15 +
    tokenScore * 0.05;

  const suspicious =
    combinedConfidence < 45 ||
    garbageRatio > 0.35 ||
    meaningfulWordCount === 0;

  const score =
    quality -
    garbageRatio * 25 +
    Math.min(
      lineCount,
      10
    ) *
      0.5;

  return {
    tokenCount,

    meaningfulWordCount,

    garbageRatio,

    bboxCoverage,

    horizontalCoverage,

    verticalCoverage,

    lineCount,

    quality:
      clamp(
        quality,
        0,
        100
      ),

    score,

    suspicious,
  };
}

// --------------------------------------------------
// SELECT BEST OCR CANDIDATE
// --------------------------------------------------

function selectBestCandidate(
  candidates: OCRCandidate[]
): OCRCandidate {
  if (
    candidates.length === 0
  ) {
    throw new Error(
      "No OCR candidates were produced."
    );
  }

  const strongCandidates =
    candidates.filter(
      (candidate) =>
        candidate.tesseractConfidence >=
          50 &&
        candidate.garbageRatio <=
          0.35 &&
        !candidate.suspicious
    );

  const pool =
    strongCandidates.length >
    0
      ? strongCandidates
      : candidates;

  const sorted =
    [...pool].sort(
      (a, b) =>
        b.score -
        a.score
    );

  return sorted[0];
}

// --------------------------------------------------
// CREATE IMAGE VARIANTS
// --------------------------------------------------

async function createImageVariants(
  inputPath: string,
  tempDir: string
) {
  const metadata =
    await sharp(
      inputPath
    ).metadata();

  const width =
    metadata.width ?? 0;

  const height =
    metadata.height ?? 0;

  let scale = 1;

  if (
    width > 0 &&
    width < 800
  ) {
    scale = 3;
  } else if (
    width > 0 &&
    width < 1400
  ) {
    scale = 2;
  }

  const originalPath =
    path.join(
      tempDir,
      "original.png"
    );

  const grayscalePath =
    path.join(
      tempDir,
      "grayscale.png"
    );

  let originalPipeline =
    sharp(inputPath);

  if (scale > 1) {
    originalPipeline =
      originalPipeline.resize({
        width:
          Math.round(
            width * scale
          ),

        height:
          Math.round(
            height * scale
          ),

        fit: "fill",
      });
  }

  await originalPipeline
    .png()
    .toFile(
      originalPath
    );

  let grayscalePipeline =
    sharp(inputPath);

  if (scale > 1) {
    grayscalePipeline =
      grayscalePipeline.resize({
        width:
          Math.round(
            width * scale
          ),

        height:
          Math.round(
            height * scale
          ),

        fit: "fill",
      });
  }

  await grayscalePipeline
    .grayscale()
    .png()
    .toFile(
      grayscalePath
    );

  return {
    variants: [
      {
        name: "ORIGINAL",

        path:
          originalPath,
      },

      {
        name: "GRAYSCALE",

        path:
          grayscalePath,
      },
    ],

    width:
      Math.round(
        width * scale
      ),

    height:
      Math.round(
        height * scale
      ),
  };
}

// --------------------------------------------------
// RECOGNIZE IMAGE
// --------------------------------------------------

async function recognizeImage(
  worker: Awaited<
    ReturnType<
      typeof createWorker
    >
  >,

  imagePath: string,

  psm: PSM,

  name: string,

  imageWidth: number,

  imageHeight: number
): Promise<OCRCandidate> {
  await worker.setParameters({
    tessedit_pageseg_mode:
      psm,

    preserve_interword_spaces:
      "1",

    user_defined_dpi:
      "300",
  });

  const result =
    await worker.recognize(
      imagePath,
      {},
      {
        text: true,

        hocr: true,

        tsv: true,
      }
    );

  const rawText =
    cleanOCRText(
      result.data.text ?? ""
    );

  const hocrWords =
    parseHOCR(
      result.data.hocr ?? ""
    );

  const tsvWords =
    parseTSV(
      result.data.tsv ?? ""
    );

  let words =
    hocrWords.length > 0
      ? hocrWords
      : tsvWords;

  words =
    deduplicateWords(
      words
    );

  // IMPORTANT:
  // Build text using ORIGINAL OCR words.
  // No corrections happen here.
  const originalText =
    words.length > 0
      ? buildTextFromWords(
          words
        )
      : rawText;

  const tesseractConfidence =
    Number.isFinite(
      result.data.confidence
    )
      ? result.data.confidence
      : 0;

  const metrics =
    calculateCandidateMetrics(
      words,
      originalText,
      tesseractConfidence,
      imageWidth,
      imageHeight
    );

  console.log(
    `[Klaro OCR] ${name}: ` +
      `quality=${metrics.quality.toFixed(
        2
      )}, ` +
      `tokens=${metrics.tokenCount}, ` +
      `meaningful=${metrics.meaningfulWordCount}, ` +
      `confidence=${tesseractConfidence}, ` +
      `garbage=${metrics.garbageRatio.toFixed(
        3
      )}, ` +
      `suspicious=${metrics.suspicious}`
  );

  return {
    name,

    text:
      originalText,

    words,

    tesseractConfidence,

    ...metrics,
  };
}

// --------------------------------------------------
// POST
// --------------------------------------------------

export async function POST(
  request: NextRequest
) {
  const requestStart =
    Date.now();

  let tempDir:
    | string
    | null = null;

  let worker:
    | Awaited<
        ReturnType<
          typeof createWorker
        >
      >
    | null = null;

  console.log(
    "[Klaro OCR] ===== OCR REQUEST START ====="
  );

  try {
    // ----------------------------------------------
    // RECEIVE FILE
    // ----------------------------------------------

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (
      !(file instanceof File)
    ) {
      return NextResponse.json(
        {
          success: false,

          message:
            "No image file was uploaded.",
        },

        {
          status: 400,
        }
      );
    }

    console.log(
      `[Klaro OCR] File received: ${file.name}`
    );

    console.log(
      `[Klaro OCR] File type: ${file.type}`
    );

    console.log(
      `[Klaro OCR] File size: ${file.size} bytes`
    );

    // ----------------------------------------------
    // TEMP DIRECTORY
    // ----------------------------------------------

    tempDir =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          "klaro-ocr-"
        )
      );

    const inputPath =
      path.join(
        tempDir,
        "input"
      );

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(
        arrayBuffer
      );

    await fs.writeFile(
      inputPath,
      buffer
    );

    // ----------------------------------------------
    // PREPROCESS IMAGE
    // ----------------------------------------------

    const {
      variants,
      width,
      height,
    } =
      await createImageVariants(
        inputPath,
        tempDir
      );

    console.log(
      `[Klaro OCR] Variants: ${variants
        .map(
          (variant) =>
            variant.name
        )
        .join(", ")}`
    );

    // ----------------------------------------------
    // CREATE TESSERACT WORKER
    // ----------------------------------------------

    worker =
      await createWorker(
        "eng",
        1
      );

    // ----------------------------------------------
    // OCR CANDIDATES
    // ----------------------------------------------

    const selectedVariants =
      variants.filter(
        (variant) =>
          variant.name ===
            "ORIGINAL" ||
          variant.name ===
            "GRAYSCALE"
      );

    const candidates:
      OCRCandidate[] = [];

    for (
      const variant of selectedVariants
    ) {
      try {
        const candidate =
          await recognizeImage(
            worker,
            variant.path,
            PSM.AUTO,
            `${variant.name} / AUTO`,
            width,
            height
          );

        candidates.push(
          candidate
        );
      } catch (error) {
        console.error(
          `[Klaro OCR] ${variant.name} failed:`,
          error
        );
      }
    }

    if (
      candidates.length === 0
    ) {
      throw new Error(
        "OCR failed. No candidate completed successfully."
      );
    }

    // ----------------------------------------------
    // SELECT BEST CANDIDATE
    // ----------------------------------------------

    const selected =
      selectBestCandidate(
        candidates
      );

    console.log(
      `[Klaro OCR] Selected: ${selected.name}`
    );

    // ----------------------------------------------
    // FINAL ORIGINAL WORDS
    // ----------------------------------------------

    const finalWords =
      selected.words.map(
        (word) => ({
          ...word,

          originalConfidence:
            word.originalConfidence ??
            word.confidence,

          // No correction yet.
          suggestion: null,

          corrected: false,
        })
      );

    // ----------------------------------------------
    // FLAG LOW CONFIDENCE WORDS
    // ----------------------------------------------

    const flaggedWords =
      finalWords.filter(
        (word) =>
          word.confidence <
          CONFIDENCE_THRESHOLD
      );

    // ----------------------------------------------
    // LAYER 1
    //
    // Original OCR text.
    // Completely untouched.
    // ----------------------------------------------

    const originalText =
      selected.text;

    // ----------------------------------------------
    // LAYER 2
    //
    // For now this is the same OCR text.
    //
    // The frontend will use:
    // - flaggedWords
    // - suggestions
    // - confidence
    //
    // Later we will add the
    // suggestion engine here.
    // ----------------------------------------------

    const reviewText =
      originalText;

    // ----------------------------------------------
    // RESPONSE
    // ----------------------------------------------

    const responseData = {
      success: true,

      // --------------------------------
      // THREE-LAYER DATA
      // --------------------------------

      originalText,

      reviewText,

      // Temporary compatibility fields
      // for your existing frontend.
      text:
        originalText,

      rawText:
        originalText,

      // --------------------------------
      // CONFIDENCE
      // --------------------------------

      confidence:
        selected.quality,

      tesseractConfidence:
        selected.tesseractConfidence,

      confidenceSource:
        "OCR quality is calculated from Tesseract confidence, average word confidence, meaningful word ratio, garbage detection, and candidate quality.",

      recognitionQuality:
        selected.quality,

      // --------------------------------
      // CANDIDATE
      // --------------------------------

      selectedCandidate:
        selected.name,

      score:
        selected.score,

      autoQuality:
        candidates.find(
          (candidate) =>
            candidate.name ===
            "ORIGINAL / AUTO"
        )?.quality ?? 0,

      grayscaleQuality:
        candidates.find(
          (candidate) =>
            candidate.name ===
            "GRAYSCALE / AUTO"
        )?.quality ?? 0,

      // --------------------------------
      // WORDS
      // --------------------------------

      words:
        finalWords,

      flaggedWords,

      flaggedWordCount:
        flaggedWords.length,

      threshold:
        CONFIDENCE_THRESHOLD,

      // --------------------------------
      // METRICS
      // --------------------------------

      tokenCount:
        selected.tokenCount,

      meaningfulWordCount:
        selected.meaningfulWordCount,

      garbageRatio:
        selected.garbageRatio,

      bboxCoverage:
        selected.bboxCoverage,

      horizontalCoverage:
        selected.horizontalCoverage,

      verticalCoverage:
        selected.verticalCoverage,

      lineCount:
        selected.lineCount,

      suspicious:
        selected.suspicious,

      // --------------------------------
      // TIME
      // --------------------------------

      processingTimeMs:
        Date.now() -
        requestStart,

      processing: {
        variantsTested:
          selectedVariants.length,

        candidatesTested:
          candidates.length,

        preprocessing: [
          "upscale",
          "grayscale",
        ],

        pageSegmentationModes: [
          "AUTO",
        ],
      },
    };

    console.log(
      `[Klaro OCR] OCR complete in ${
        Date.now() -
        requestStart
      }ms`
    );

    return NextResponse.json(
      responseData,
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "[Klaro OCR] OCR PROCESSING ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        message:
          "OCR processing failed.",

        error:
          error instanceof Error
            ? error.message
            : "Unknown OCR error.",

        processingTimeMs:
          Date.now() -
          requestStart,
      },

      {
        status: 500,
      }
    );
  } finally {
    // ----------------------------------------------
    // TERMINATE WORKER
    // ----------------------------------------------

    if (worker) {
      try {
        await worker.terminate();
      } catch (error) {
        console.error(
          "[Klaro OCR] Failed to terminate worker:",
          error
        );
      }
    }

    // ----------------------------------------------
    // CLEAN TEMP DIRECTORY
    // ----------------------------------------------

    if (tempDir) {
      try {
        await fs.rm(
          tempDir,
          {
            recursive: true,

            force: true,
          }
        );
      } catch (error) {
        console.error(
          "[Klaro OCR] Failed to clean temporary directory:",
          error
        );
      }
    }

    console.log(
      "[Klaro OCR] ===== OCR CLEANUP COMPLETE ====="
    );
  }
}