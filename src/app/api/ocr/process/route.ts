import { NextRequest, NextResponse } from "next/server";
import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import os from "os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OCRWord = {
  text: string;
  original: string;
  corrected: string;
  confidence: number;
  flagged: boolean;
  correctionApplied: boolean;
  bbox?: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  source: "hocr" | "tsv";
};

type OCRCandidate = {
  name: string;
  psm: PSM;
  imagePath: string;
  text: string;
  rawText: string;
  words: OCRWord[];
  tesseractConfidence: number;
  confidence: number;
  tokenCount: number;
  meaningfulWordCount: number;
  coverage: number;
  horizontalCoverage: number;
  verticalCoverage: number;
  lineCount: number;
  garbageRatio: number;
  quality: number;
  score: number;
  suspicious: boolean;
};

const CONFIDENCE_THRESHOLD = 70;

/*
|--------------------------------------------------------------------------
| Medical terminology / common OCR corrections
|--------------------------------------------------------------------------
*/

const CORRECTIONS: Record<string, string> = {
  temparature: "temperature",
  tempereture: "temperature",
  temprature: "temperature",
  tempurature: "temperature",
  temperatuure: "temperature",

  headake: "headache",
  hedache: "headache",
  headche: "headache",
  hedake: "headache",

  patlent: "patient",
  patien: "patient",
  patiant: "patient",

  fevar: "fever",
  fevr: "fever",

  couhg: "cough",
  coough: "cough",

  vomitting: "vomiting",
  vomting: "vomiting",

  nausia: "nausea",
  nauea: "nausea",

  diarrhoea: "diarrhea",
  diarhea: "diarrhea",
  diahrea: "diarrhea",

  medicaton: "medication",
  medcation: "medication",

  presciption: "prescription",
  perscription: "prescription",

  diagnsis: "diagnosis",
  diagonsis: "diagnosis",

  sympton: "symptom",
  symtom: "symptom",

  patholgy: "pathology",

  infecton: "infection",
  infecion: "infection",

  inflamamation: "inflammation",
  inflamation: "inflammation",

  antibiotc: "antibiotic",

  hypertenson: "hypertension",
  hipertension: "hypertension",

  diabtes: "diabetes",
  diabeetes: "diabetes",

  respiratry: "respiratory",

  emergncy: "emergency",
  hospitl: "hospital",
  clinlc: "clinic",

  he1p: "help",
  he1th: "health",
  hea1th: "health",
};

/*
|--------------------------------------------------------------------------
| Short words / abbreviations
|--------------------------------------------------------------------------
*/

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

/*
|--------------------------------------------------------------------------
| Basic helpers
|--------------------------------------------------------------------------
*/

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(max, value)
  );
}

function normalizeWhitespace(
  text: string
) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeToken(
  token: string
) {
  return token
    .trim()
    .replace(
      /^[^A-Za-z0-9/%:.'-]+/,
      ""
    )
    .replace(
      /[^A-Za-z0-9/%:.'-]+$/,
      ""
    );
}

function cleanOCRText(
  text: string
) {
  if (!text) {
    return "";
  }

  const cleaned = text
    .replace(/\r/g, "\n")
    .replace(/[|]+/g, "I")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return normalizeWhitespace(
    lines.join("\n")
  );
}

/*
|--------------------------------------------------------------------------
| Garbage detection
|--------------------------------------------------------------------------
*/

function isProbablyGarbage(
  token: string,
  confidence: number
) {
  const value = normalizeToken(token);

  if (!value) {
    return true;
  }

  const lower =
    value.toLowerCase();

  if (
    ALLOW_SHORT_WORDS.has(lower)
  ) {
    return false;
  }

  if (confidence < 15) {
    return true;
  }

  if (
    /^[^A-Za-z0-9]+$/.test(value)
  ) {
    return true;
  }

  const alphaNumeric =
    (
      value.match(
        /[A-Za-z0-9]/g
      ) || []
    ).length;

  const strange =
    (
      value.match(
        /[^A-Za-z0-9/%:.'-]/g
      ) || []
    ).length;

  if (
    value.length >= 3 &&
    strange > alphaNumeric
  ) {
    return true;
  }

  if (
    /(.)\1{3,}/.test(value)
  ) {
    return true;
  }

  if (
    /^[_|~`^=\-*\\-]{2,}$/.test(
      value
    )
  ) {
    return true;
  }

  if (value.length > 40) {
    return true;
  }

  if (
    value.length >= 6 &&
    /^[A-Za-z]+$/.test(value) &&
    !/[aeiouy]/i.test(value)
  ) {
    return true;
  }

  if (
    /^[{}\[\]()<>()\\\/]+/.test(
      value
    )
  ) {
    return true;
  }

  if (
    confidence < 45 &&
    /[^A-Za-z0-9]/.test(value) &&
    !/[/%:.'-]/.test(value)
  ) {
    return true;
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| Medical correction
|--------------------------------------------------------------------------
*/

function applyCorrection(
  token: string
) {
  const normalized =
    normalizeToken(token);

  if (!normalized) {
    return {
      original: token,
      corrected: "",
      correctionApplied: false,
    };
  }

  const lower =
    normalized.toLowerCase();

  const correction =
    CORRECTIONS[lower];

  if (!correction) {
    return {
      original: normalized,
      corrected: normalized,
      correctionApplied: false,
    };
  }

  let corrected = correction;

  if (
    normalized ===
    normalized.toUpperCase()
  ) {
    corrected =
      correction.toUpperCase();
  } else if (
    normalized[0] ===
    normalized[0].toUpperCase()
  ) {
    corrected =
      correction.charAt(0).toUpperCase() +
      correction.slice(1);
  }

  return {
    original: normalized,
    corrected,
    correctionApplied: true,
  };
}

/*
|--------------------------------------------------------------------------
| hOCR parser
|--------------------------------------------------------------------------
*/

function parseHOCR(
  hocr: string,
  imageWidth: number,
  imageHeight: number
): OCRWord[] {
  const words: OCRWord[] = [];

  if (!hocr) {
    return words;
  }

  const regex =
    /<span[^>]*class=['"][^'"]*(?:ocrx_word|ocr_word)[^'"]*['"][^>]*title=['"]([^'"]*)['"][^>]*>([\s\S]*?)<\/span>/gi;

  let match:
    RegExpExecArray | null;

  while (
    (match = regex.exec(hocr)) !==
    null
  ) {
    const title =
      match[1] || "";

    const htmlText =
      match[2] || "";

    const text =
      htmlText
        .replace(
          /<[^>]+>/g,
          " "
        )
        .replace(
          /&nbsp;/gi,
          " "
        )
        .replace(
          /&amp;/gi,
          "&"
        )
        .replace(
          /&lt;/gi,
          "<"
        )
        .replace(
          /&gt;/gi,
          ">"
        )
        .trim();

    if (!text) {
      continue;
    }

    const bboxMatch =
      title.match(
        /bbox\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/i
      );

    const confidenceMatch =
      title.match(
        /x_wconf\s+([\d.]+)/i
      );

    const confidence =
      confidenceMatch
        ? clamp(
            Number(
              confidenceMatch[1]
            ),
            0,
            100
          )
        : 0;

    let bbox:
      | {
          x0: number;
          y0: number;
          x1: number;
          y1: number;
        }
      | undefined;

    if (bboxMatch) {
      bbox = {
        x0: clamp(
          Number(
            bboxMatch[1]
          ),
          0,
          imageWidth
        ),
        y0: clamp(
          Number(
            bboxMatch[2]
          ),
          0,
          imageHeight
        ),
        x1: clamp(
          Number(
            bboxMatch[3]
          ),
          0,
          imageWidth
        ),
        y1: clamp(
          Number(
            bboxMatch[4]
          ),
          0,
          imageHeight
        ),
      };
    }

    const correction =
      applyCorrection(text);

    words.push({
      text:
        correction.corrected,

      original:
        correction.original,

      corrected:
        correction.corrected,

      confidence,

      flagged:
        confidence <
          CONFIDENCE_THRESHOLD &&
        !correction.correctionApplied,

      correctionApplied:
        correction.correctionApplied,

      bbox,

      source: "hocr",
    });
  }

  return words;
}

/*
|--------------------------------------------------------------------------
| TSV parser
|--------------------------------------------------------------------------
*/

function parseTSV(
  tsv: string,
  imageWidth: number,
  imageHeight: number
): OCRWord[] {
  const words: OCRWord[] = [];

  if (!tsv) {
    return words;
  }

  const lines =
    tsv.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const parts =
      line.split("\t");

    if (parts.length < 12) {
      continue;
    }

    const level =
      Number(parts[0]);

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
      clamp(
        Number(parts[10]),
        0,
        100
      );

    const text =
      parts
        .slice(11)
        .join("\t")
        .trim();

    if (!text) {
      continue;
    }

    const correction =
      applyCorrection(text);

    words.push({
      text:
        correction.corrected,

      original:
        correction.original,

      corrected:
        correction.corrected,

      confidence,

      flagged:
        confidence <
          CONFIDENCE_THRESHOLD &&
        !correction.correctionApplied,

      correctionApplied:
        correction.correctionApplied,

      bbox: {
        x0: clamp(
          left,
          0,
          imageWidth
        ),

        y0: clamp(
          top,
          0,
          imageHeight
        ),

        x1: clamp(
          left + width,
          0,
          imageWidth
        ),

        y1: clamp(
          top + height,
          0,
          imageHeight
        ),
      },

      source: "tsv",
    });
  }

  return words;
}

/*
|--------------------------------------------------------------------------
| Deduplicate words
|--------------------------------------------------------------------------
*/

function deduplicateWords(
  words: OCRWord[]
) {
  const result: OCRWord[] = [];

  for (const word of words) {
    const normalized =
      word.corrected.toLowerCase();

    if (!normalized) {
      continue;
    }

    const duplicate =
      result.some(
        (existing) => {
          if (
            existing.corrected.toLowerCase() !==
            normalized
          ) {
            return false;
          }

          if (
            !existing.bbox ||
            !word.bbox
          ) {
            return true;
          }

          const dx =
            Math.abs(
              existing.bbox.x0 -
                word.bbox.x0
            );

          const dy =
            Math.abs(
              existing.bbox.y0 -
                word.bbox.y0
            );

          return (
            dx < 5 &&
            dy < 5
          );
        }
      );

    if (!duplicate) {
      result.push(word);
    }
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| Reconstruct readable text
|--------------------------------------------------------------------------
*/

function buildTextFromWords(
  words: OCRWord[]
) {
  if (!words.length) {
    return "";
  }

  const validWords =
    words.filter(
      (word) =>
        word.corrected
          .trim()
          .length > 0
    );

  if (!validWords.length) {
    return "";
  }

  const withBBox =
    validWords.filter(
      (word) => word.bbox
    );

  if (
    withBBox.length <
    Math.max(
      2,
      validWords.length * 0.4
    )
  ) {
    return validWords
      .map(
        (word) =>
          word.corrected
      )
      .join(" ")
      .trim();
  }

  const sorted =
    [...withBBox].sort(
      (a, b) => {
        const ay =
          a.bbox!.y0;

        const by =
          b.bbox!.y0;

        if (
          Math.abs(
            ay - by
          ) > 15
        ) {
          return ay - by;
        }

        return (
          a.bbox!.x0 -
          b.bbox!.x0
        );
      }
    );

  const lines: OCRWord[][] =
    [];

  for (const word of sorted) {
    const y =
      word.bbox!.y0;

    let targetLine =
      lines.find(
        (line) => {
          if (!line.length) {
            return false;
          }

          const averageY =
            line.reduce(
              (sum, item) =>
                sum +
                item.bbox!.y0,
              0
            ) /
            line.length;

          return (
            Math.abs(
              averageY - y
            ) <= 18
          );
        }
      );

    if (!targetLine) {
      targetLine = [];
      lines.push(
        targetLine
      );
    }

    targetLine.push(word);
  }

  return lines
    .map((line) =>
      line
        .sort(
          (a, b) =>
            a.bbox!.x0 -
            b.bbox!.x0
        )
        .map(
          (word) =>
            word.corrected
        )
        .join(" ")
    )
    .join("\n")
    .trim();
}

/*
|--------------------------------------------------------------------------
| Candidate metrics
|--------------------------------------------------------------------------
*/

function calculateCandidateMetrics(
  words: OCRWord[],
  rawText: string,
  imageWidth: number,
  imageHeight: number,
  tesseractConfidence: number
) {
  const tokenCount =
    words.length;

  const meaningfulWords =
    words.filter(
      (word) =>
        !isProbablyGarbage(
          word.original,
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

  const confidences =
    meaningfulWords
      .map(
        (word) =>
          word.confidence
      )
      .filter((value) =>
        Number.isFinite(value)
      );

  const wordConfidence =
    confidences.length > 0
      ? confidences.reduce(
          (sum, value) =>
            sum + value,
          0
        ) /
        confidences.length
      : 0;

  const combinedConfidence =
    confidences.length > 0
      ? wordConfidence * 0.65 +
        tesseractConfidence *
          0.35
      : tesseractConfidence;

  let minX = imageWidth;
  let minY = imageHeight;
  let maxX = 0;
  let maxY = 0;

  let hasBBox = false;

  for (const word of meaningfulWords) {
    if (!word.bbox) {
      continue;
    }

    hasBBox = true;

    minX = Math.min(
      minX,
      word.bbox.x0
    );

    minY = Math.min(
      minY,
      word.bbox.y0
    );

    maxX = Math.max(
      maxX,
      word.bbox.x1
    );

    maxY = Math.max(
      maxY,
      word.bbox.y1
    );
  }

  let coverage = 0;
  let horizontalCoverage = 0;
  let verticalCoverage = 0;

  if (hasBBox) {
    const width =
      Math.max(
        0,
        maxX - minX
      );

    const height =
      Math.max(
        0,
        maxY - minY
      );

    coverage =
      (width * height) /
      (imageWidth *
        imageHeight);

    horizontalCoverage =
      width /
      imageWidth;

    verticalCoverage =
      height /
      imageHeight;
  }

  const lineCount =
    rawText
      .split(/\r?\n/)
      .map((line) =>
        line.trim()
      )
      .filter(Boolean)
      .length;

  const garbagePenalty =
    garbageRatio * 55;

  const confidencePenalty =
    combinedConfidence < 45
      ? (45 -
          combinedConfidence) *
        1.4
      : 0;

  const emptyPenalty =
    meaningfulWordCount === 0
      ? 80
      : 0;

  const tokenExplosionPenalty =
    tokenCount > 120
      ? Math.min(
          35,
          (tokenCount - 120) *
            0.3
        )
      : 0;

  const readableCharacters =
    rawText.replace(
      /[^A-Za-z0-9]/g,
      ""
    ).length;

  const readableTextBonus =
    readableCharacters > 0
      ? Math.min(
          10,
          readableCharacters /
            30
        )
      : 0;

  const coverageBonus =
    Math.min(
      8,
      coverage * 8
    );

  const quality = clamp(
    combinedConfidence -
      garbagePenalty -
      confidencePenalty -
      emptyPenalty -
      tokenExplosionPenalty +
      readableTextBonus +
      coverageBonus,
    0,
    100
  );

  const suspicious =
    meaningfulWordCount === 0 ||
    garbageRatio > 0.35 ||
    combinedConfidence < 50;

  const score =
    quality * 0.75 +
    combinedConfidence *
      0.2 +
    Math.min(
      5,
      coverage * 5
    );

  return {
    tokenCount,
    meaningfulWordCount,
    garbageRatio,
    coverage,
    horizontalCoverage,
    verticalCoverage,
    lineCount,

    confidence: clamp(
      Math.round(
        combinedConfidence
      ),
      0,
      100
    ),

    quality:
      Math.round(
        quality * 100
      ) / 100,

    score:
      Math.round(
        score * 100
      ) / 100,

    suspicious,
  };
}

/*
|--------------------------------------------------------------------------
| Select best OCR candidate
|--------------------------------------------------------------------------
*/

function selectBestCandidate(
  candidates: OCRCandidate[]
) {
  if (!candidates.length) {
    return null;
  }

  const usable =
    candidates.filter(
      (candidate) =>
        candidate.meaningfulWordCount >
          0 &&
        candidate.text
          .trim()
          .length > 0
    );

  if (!usable.length) {
    return [...candidates].sort(
      (a, b) =>
        b.score - a.score
    )[0];
  }

  /*
   * Strong candidate:
   *
   * - Has actual readable words
   * - Confidence >= 50
   * - Garbage <= 35%
   */

  const strong =
    usable.filter(
      (candidate) =>
        candidate.confidence >=
          50 &&
        candidate.garbageRatio <=
          0.35
    );

  if (strong.length) {
    return [...strong].sort(
      (a, b) => {
        if (
          Math.abs(
            a.score - b.score
          ) > 3
        ) {
          return (
            b.score -
            a.score
          );
        }

        if (
          Math.abs(
            a.confidence -
              b.confidence
          ) > 5
        ) {
          return (
            b.confidence -
            a.confidence
          );
        }

        return (
          a.garbageRatio -
          b.garbageRatio
        );
      }
    )[0];
  }

  /*
   * If every candidate is poor,
   * choose the least-bad one.
   */

  return [...usable].sort(
    (a, b) => {
      if (
        Math.abs(
          a.garbageRatio -
            b.garbageRatio
        ) > 0.08
      ) {
        return (
          a.garbageRatio -
          b.garbageRatio
        );
      }

      return (
        b.score -
        a.score
      );
    }
  )[0];
}

/*
|--------------------------------------------------------------------------
| Image preprocessing
|--------------------------------------------------------------------------
*/

async function createImageVariants(
  inputPath: string,
  workDir: string
) {
  const variants: {
    name: string;
    path: string;
  }[] = [];

  const metadata =
    await sharp(
      inputPath
    ).metadata();

  const originalWidth =
    metadata.width || 0;

  const originalHeight =
    metadata.height || 0;

  /*
   * Upscale small camera images.
   */

  let scale = 1;

  if (originalWidth < 1400) {
    scale = 2;
  }

  if (originalWidth < 800) {
    scale = 3;
  }

  /*
   * ORIGINAL
   */

  const originalPath =
    path.join(
      workDir,
      "original.png"
    );

  await sharp(inputPath)
    .rotate()
    .resize({
      width:
        originalWidth > 0
          ? Math.round(
              originalWidth *
                scale
            )
          : undefined,

      height:
        originalHeight > 0
          ? Math.round(
              originalHeight *
                scale
            )
          : undefined,

      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toFile(
      originalPath
    );

  variants.push({
    name: "ORIGINAL",
    path: originalPath,
  });

  /*
   * GRAYSCALE
   */

  const grayscalePath =
    path.join(
      workDir,
      "grayscale.png"
    );

  await sharp(inputPath)
    .rotate()
    .resize({
      width:
        originalWidth > 0
          ? Math.round(
              originalWidth *
                scale
            )
          : undefined,

      height:
        originalHeight > 0
          ? Math.round(
              originalHeight *
                scale
            )
          : undefined,

      fit: "inside",
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .png()
    .toFile(
      grayscalePath
    );

  variants.push({
    name: "GRAYSCALE",
    path: grayscalePath,
  });

  /*
   * The following preprocessing variants are
   * intentionally NOT generated for the Vercel
   * serverless OCR request.
   *
   * This reduces processing time and prevents
   * FUNCTION_INVOCATION_TIMEOUT.
   */

  return variants;
}

/*
|--------------------------------------------------------------------------
| Run OCR on one image
|--------------------------------------------------------------------------
*/

async function recognizeImage(
  worker: Awaited<
    ReturnType<
      typeof createWorker
    >
  >,
  imagePath: string,
  psm: PSM,
  variantName: string
) {
  /*
   * IMPORTANT:
   *
   * tessedit_pageseg_mode belongs in
   * worker.setParameters(), not recognize().
   */

  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
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

  const data =
    result.data as any;

  const imageMetadata =
    await sharp(
      imagePath
    ).metadata();

  const imageWidth =
    imageMetadata.width || 1;

  const imageHeight =
    imageMetadata.height || 1;

  const rawText =
    typeof data.text ===
    "string"
      ? data.text
      : "";

  /*
   * Parse word data.
   */

  const hocrWords =
    parseHOCR(
      typeof data.hocr ===
        "string"
        ? data.hocr
        : "",
      imageWidth,
      imageHeight
    );

  const tsvWords =
    parseTSV(
      typeof data.tsv ===
        "string"
        ? data.tsv
        : "",
      imageWidth,
      imageHeight
    );

  /*
   * Prefer hOCR.
   */

  let words =
    hocrWords.length > 0
      ? hocrWords
      : tsvWords;

  words =
    deduplicateWords(
      words
    );

  /*
   * Fallback if Tesseract returned text
   * but word parsing failed.
   */

  if (
    words.length === 0 &&
    rawText.trim()
  ) {
    words = rawText
      .split(/\s+/)
      .map(
        (token: string) => {
          const correction =
            applyCorrection(
              token
            );

          const confidence =
            clamp(
              Number(
                data.confidence ||
                  0
              ),
              0,
              100
            );

          return {
            text:
              correction.corrected,

            original:
              correction.original,

            corrected:
              correction.corrected,

            confidence,

            flagged:
              confidence <
                CONFIDENCE_THRESHOLD &&
              !correction.correctionApplied,

            correctionApplied:
              correction.correctionApplied,

            source:
              "tsv" as const,
          };
        }
      );
  }

  const cleanedRawText =
    cleanOCRText(
      rawText
    );

  const reconstructedText =
    buildTextFromWords(
      words
    );

  const text =
    words.length > 0 &&
    reconstructedText
      .trim()
      .length > 0
      ? reconstructedText
      : cleanedRawText;

  const tesseractConfidence =
    clamp(
      Number(
        data.confidence ||
          0
      ),
      0,
      100
    );

  const metrics =
    calculateCandidateMetrics(
      words,
      text,
      imageWidth,
      imageHeight,
      tesseractConfidence
    );

  return {
    name: variantName,
    psm,
    imagePath,
    text,
    rawText: cleanedRawText,
    words,
    tesseractConfidence,
    ...metrics,
  } satisfies OCRCandidate;
}

/*
|--------------------------------------------------------------------------
| POST /api/ocr/process
|--------------------------------------------------------------------------
*/
export async function POST(
  request: NextRequest
) {
  const startTime = Date.now();

  let workDir:
    | string
    | null = null;

  let worker:
    | Awaited<
        ReturnType<
          typeof createWorker
        >
      >
    | null = null;

  const logTime = (
    label: string
  ) => {
    console.log(
      `[Klaro OCR TIMING] ${label}: ${
        Date.now() - startTime
      }ms`
    );
  };

  try {
    console.log(
      "[Klaro OCR TIMING] ===== OCR REQUEST START ====="
    );

    /*
     * ---------------------------------------------------------------
     * Receive request
     * ---------------------------------------------------------------
     */

    const formData =
      await request.formData();

    logTime(
      "request.formData() complete"
    );

    const file =
      formData.get("file") ||
      formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No image file was provided.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      `[Klaro OCR TIMING] File received: ${file.name}`
    );

    console.log(
      `[Klaro OCR TIMING] File type: ${file.type}`
    );

    console.log(
      `[Klaro OCR TIMING] File size: ${file.size} bytes`
    );

    /*
     * ---------------------------------------------------------------
     * Validate image
     * ---------------------------------------------------------------
     */

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The uploaded file must be an image.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Maximum file size: 15 MB.
     */

    const MAX_FILE_SIZE =
      15 * 1024 * 1024;

    if (
      file.size >
      MAX_FILE_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Image is too large. Maximum size is 15 MB.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * ---------------------------------------------------------------
     * Temporary working directory
     * ---------------------------------------------------------------
     */

    workDir =
      await fs.mkdtemp(
        path.join(
          os.tmpdir(),
          "klaro-ocr-"
        )
      );

    logTime(
      "temporary directory created"
    );

    const inputPath =
      path.join(
        workDir,
        "input"
      );

    const buffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    logTime(
      "file converted to Buffer"
    );

    await fs.writeFile(
      inputPath,
      buffer
    );

    logTime(
      "input image written to disk"
    );

    /*
     * ---------------------------------------------------------------
     * Image preprocessing
     * ---------------------------------------------------------------
     */

    console.log(
      "[Klaro OCR TIMING] Starting image preprocessing..."
    );

    const variants =
      await createImageVariants(
        inputPath,
        workDir
      );

    logTime(
      "image preprocessing complete"
    );

    console.log(
      `[Klaro OCR TIMING] Variants created: ${variants
        .map(
          (variant) =>
            variant.name
        )
        .join(", ")}`
    );

    /*
     * ---------------------------------------------------------------
     * Tesseract worker
     * ---------------------------------------------------------------
     */

    console.log(
      "[Klaro OCR TIMING] Starting Tesseract worker creation..."
    );

    const workerPath =
      path.join(
        process.cwd(),
        "node_modules",
        "tesseract.js",
        "src",
        "worker-script",
        "node",
        "index.js"
      );

    console.log(
      `[Klaro OCR TIMING] Worker path: ${workerPath}`
    );

    const workerStart =
      Date.now();

    worker =
      await createWorker(
        "eng",
        1,
        {
          workerPath,

          logger: (message) => {
            if (
              message.status ===
                "recognizing text" &&
              typeof message.progress ===
                "number"
            ) {
              if (
                message.progress ===
                  0 ||
                message.progress >=
                  0.99
              ) {
                console.log(
                  `[Klaro OCR] ${message.status}: ${Math.round(
                    message.progress *
                      100
                  )}%`
                );
              }
            }
          },
        }
      );

    console.log(
      `[Klaro OCR TIMING] Tesseract worker created in ${
        Date.now() -
        workerStart
      }ms`
    );

    logTime(
      "Tesseract worker ready"
    );

    /*
     * ---------------------------------------------------------------
     * OCR candidates
     * ---------------------------------------------------------------
     *
     * Only:
     *
     * ORIGINAL / AUTO
     * GRAYSCALE / AUTO
     *
     * Total: 2 OCR operations.
     * ---------------------------------------------------------------
     */

    const candidates:
      OCRCandidate[] = [];

    const selectedVariants =
      variants.filter(
        (variant) =>
          variant.name ===
            "ORIGINAL" ||
          variant.name ===
            "GRAYSCALE"
      );

    console.log(
      `[Klaro OCR TIMING] Selected variants: ${selectedVariants
        .map(
          (variant) =>
            variant.name
        )
        .join(", ")}`
    );

    /*
     * ---------------------------------------------------------------
     * Run OCR candidates
     * ---------------------------------------------------------------
     */

    for (
      const variant of
        selectedVariants
    ) {
      const candidateStart =
        Date.now();

      console.log(
        `[Klaro OCR TIMING] >>> Starting ${variant.name} / AUTO`
      );

      try {
        const candidate =
          await recognizeImage(
            worker,
            variant.path,
            PSM.AUTO,
            `${variant.name} / AUTO`
          );

        candidates.push(
          candidate
        );

        console.log(
          `[Klaro OCR] ${candidate.name}: ` +
            `quality=${candidate.quality}, ` +
            `tokens=${candidate.tokenCount}, ` +
            `meaningful=${candidate.meaningfulWordCount}, ` +
            `confidence=${candidate.tesseractConfidence}, ` +
            `garbage=${candidate.garbageRatio.toFixed(
              3
            )}, ` +
            `suspicious=${candidate.suspicious}`
        );

        console.log(
          `[Klaro OCR TIMING] <<< ${variant.name} / AUTO complete in ${
            Date.now() -
            candidateStart
          }ms`
        );

        logTime(
          `${variant.name} / AUTO complete`
        );
      } catch (error) {
        console.error(
          `[Klaro OCR] ${variant.name} AUTO failed:`,
          error
        );

        console.error(
          `[Klaro OCR TIMING] ${variant.name} / AUTO failed after ${
            Date.now() -
            candidateStart
          }ms`
        );
      }
    }

    /*
     * ---------------------------------------------------------------
     * Candidate validation
     * ---------------------------------------------------------------
     */

    console.log(
      `[Klaro OCR TIMING] OCR candidates completed: ${candidates.length}`
    );

    logTime(
      "all OCR candidates complete"
    );

    if (
      candidates.length === 0
    ) {
      throw new Error(
        "Tesseract did not produce any OCR candidates."
      );
    }

    /*
     * ---------------------------------------------------------------
     * Candidate comparison
     * ---------------------------------------------------------------
     */

    console.log(
      "[Klaro OCR] Candidate comparison:"
    );

    for (
      const candidate of
        candidates
    ) {
      console.log(
        `${candidate.name}: ` +
          `quality=${candidate.quality}, ` +
          `tokens=${candidate.tokenCount}, ` +
          `meaningful=${candidate.meaningfulWordCount}, ` +
          `confidence=${candidate.tesseractConfidence}, ` +
          `coverage=${candidate.coverage.toFixed(
            4
          )}, ` +
          `horizontal=${candidate.horizontalCoverage.toFixed(
            4
          )}, ` +
          `vertical=${candidate.verticalCoverage.toFixed(
            4
          )}, ` +
          `lines=${candidate.lineCount}, ` +
          `garbage=${candidate.garbageRatio.toFixed(
            4
          )}, ` +
          `suspicious=${candidate.suspicious}`
      );
    }

    const selected =
      selectBestCandidate(
        candidates
      );

    logTime(
      "best candidate selected"
    );

    if (!selected) {
      throw new Error(
        "Unable to select an OCR result."
      );
    }

    console.log(
      `[Klaro OCR] Selected: ${selected.name}`
    );

    /*
     * ---------------------------------------------------------------
     * Final word processing
     * ---------------------------------------------------------------
     */

    const finalWords =
      selected.words.map(
        (word) => {
          const correction =
            applyCorrection(
              word.original ||
                word.text
            );

          const corrected =
            correction.corrected ||
            word.text;

          const flagged =
            word.confidence <
              CONFIDENCE_THRESHOLD &&
            !correction.correctionApplied;

          return {
            text: corrected,

            original:
              correction.original,

            corrected,

            confidence:
              Math.round(
                word.confidence
              ),

            flagged,

            correctionApplied:
              correction.correctionApplied,

            bbox: word.bbox,

            source:
              word.source,
          };
        }
      );

    /*
     * ---------------------------------------------------------------
     * Final text
     * ---------------------------------------------------------------
     */

    const finalText =
      buildTextFromWords(
        finalWords
      ) ||
      selected.text;

    const normalizedFinalText =
      cleanOCRText(
        finalText
      );

    /*
     * ---------------------------------------------------------------
     * Flagged words
     * ---------------------------------------------------------------
     */

    const flaggedWords =
      finalWords.filter(
        (word) =>
          word.flagged
      );

    /*
     * ---------------------------------------------------------------
     * Quality classification
     * ---------------------------------------------------------------
     */

    let recognitionQuality:
      | "excellent"
      | "good"
      | "fair"
      | "poor";

    if (
      selected.confidence >=
        85 &&
      selected.garbageRatio <=
        0.1 &&
      selected.meaningfulWordCount >
        0
    ) {
      recognitionQuality =
        "excellent";
    } else if (
      selected.confidence >=
        70 &&
      selected.garbageRatio <=
        0.2
    ) {
      recognitionQuality =
        "good";
    } else if (
      selected.confidence >=
        50 &&
      selected.garbageRatio <=
        0.35
    ) {
      recognitionQuality =
        "fair";
    } else {
      recognitionQuality =
        "poor";
    }

    const suspicious =
      selected.suspicious ||
      flaggedWords.length > 0;

    const processingTimeMs =
      Date.now() -
      startTime;

    logTime(
      "final response prepared"
    );

    console.log(
      `[Klaro OCR TIMING] ===== OCR REQUEST COMPLETE: ${processingTimeMs}ms =====`
    );

    /*
     * ---------------------------------------------------------------
     * Final response
     * ---------------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      text:
        normalizedFinalText,

      rawText:
        selected.rawText,

      confidence:
        selected.confidence,

      tesseractConfidence:
        Math.round(
          selected.tesseractConfidence
        ),

      confidenceSource:
        "tesseract + word-level analysis",

      selectedCandidate:
        selected.name,

      score:
        selected.score,

      recognitionQuality,

      autoQuality:
        selected.quality,

      /*
       * There are currently no SINGLE_BLOCK
       * candidates, so this remains 0.
       */

      singleBlockQuality:
        Math.max(
          ...candidates
            .filter(
              (candidate) =>
                candidate.psm ===
                PSM.SINGLE_BLOCK
            )
            .map(
              (candidate) =>
                candidate.quality
            ),
          0
        ),

      grayscaleQuality:
        Math.max(
          ...candidates
            .filter(
              (candidate) =>
                candidate.name.startsWith(
                  "GRAYSCALE"
                )
            )
            .map(
              (candidate) =>
                candidate.quality
            ),
          0
        ),

      words:
        finalWords,

      flaggedWords,

      flaggedWordCount:
        flaggedWords.length,

      threshold:
        CONFIDENCE_THRESHOLD,

      tokenCount:
        selected.tokenCount,

      meaningfulWordCount:
        selected.meaningfulWordCount,

      coverage:
        Number(
          selected.coverage.toFixed(
            4
          )
        ),

      horizontalCoverage:
        Number(
          selected.horizontalCoverage.toFixed(
            4
          )
        ),

      verticalCoverage:
        Number(
          selected.verticalCoverage.toFixed(
            4
          )
        ),

      lineCount:
        selected.lineCount,

      garbageRatio:
        Number(
          selected.garbageRatio.toFixed(
            4
          )
        ),

      suspicious,

      processingTimeMs,

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
    });
  } catch (error) {
    const processingTimeMs =
      Date.now() -
      startTime;

    console.error(
      "[Klaro OCR] Error:",
      error
    );

    console.error(
      `[Klaro OCR TIMING] ===== OCR REQUEST FAILED AFTER ${processingTimeMs}ms =====`
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "OCR processing failed.",

        processingTimeMs,
      },
      {
        status: 500,
      }
    );
  } finally {
    /*
     * ---------------------------------------------------------------
     * Terminate worker
     * ---------------------------------------------------------------
     */

    if (worker) {
      const terminateStart =
        Date.now();

      try {
        await worker.terminate();

        console.log(
          `[Klaro OCR TIMING] Worker terminated in ${
            Date.now() -
            terminateStart
          }ms`
        );
      } catch (error) {
        console.error(
          "[Klaro OCR] Worker termination failed:",
          error
        );
      }
    }

    /*
     * ---------------------------------------------------------------
     * Delete temporary files
     * ---------------------------------------------------------------
     */

    if (workDir) {
      const cleanupStart =
        Date.now();

      try {
        await fs.rm(
          workDir,
          {
            recursive: true,
            force: true,
          }
        );

        console.log(
          `[Klaro OCR TIMING] Temporary directory cleaned in ${
            Date.now() -
            cleanupStart
          }ms`
        );
      } catch (error) {
        console.error(
          "[Klaro OCR] Temporary directory cleanup failed:",
          error
        );
      }
    }

    console.log(
      "[Klaro OCR TIMING] ===== OCR CLEANUP COMPLETE ====="
    );
  }
}