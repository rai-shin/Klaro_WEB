import { NextRequest, NextResponse } from "next/server";
import { createWorker, PSM } from "tesseract.js";
import sharp from "sharp";
import fs from "fs/promises";
import os from "os";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIDENCE_THRESHOLD = 70;

type BBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type OCRWord = {
  text: string;
  confidence: number;
  bbox?: BBox;
};

type ConfidenceSource =
  | "word"
  | "hocr"
  | "tsv"
  | "tesseract-overall"
  | "fallback";

type ProcessedWord = OCRWord & {
  originalText: string;
  correctedText: string;
  flagged: boolean;
  corrected: boolean;
  reason?: string;
  confidenceSource: ConfidenceSource;
};

type OCRResult = {
  rawText: string;
  tesseractConfidence: number;
  words: OCRWord[];
  confidenceSource: ConfidenceSource;
};

/*
|--------------------------------------------------------------------------
| MEDICAL OCR CORRECTIONS
|--------------------------------------------------------------------------
*/

const MEDICAL_CORRECTIONS: Record<string, string> = {
  // Temperature
  temparature: "temperature",
  temprature: "temperature",
  tempereture: "temperature",
  tempurature: "temperature",

  // Patient
  patien: "patient",
  patiant: "patient",
  paitent: "patient",
  patinet: "patient",
  tient: "patient",

  // Headache
  heada: "headache",
  headach: "headache",
  hedache: "headache",
  headake: "headache",
  headeche: "headache",
  headz: "headache",

  // Fever
  feverr: "fever",
  fevr: "fever",

  // Cough
  coughh: "cough",
  cof: "cough",

  // Diarrhea
  diarrhoea: "diarrhea",
  diahrrea: "diarrhea",

  // Vomiting
  vomitting: "vomiting",
  vomitng: "vomiting",

  // Nausea
  nause: "nausea",
  nausia: "nausea",

  // Medication
  medicaton: "medication",
  medcation: "medication",

  // Prescription
  prescrption: "prescription",
  presciption: "prescription",

  // Diagnosis
  diagnoss: "diagnosis",
  diagnsis: "diagnosis",

  // Symptom
  sympton: "symptom",
  symptms: "symptoms",

  // Pathology
  patology: "pathology",
  pathlogy: "pathology",

  // Infection
  infecton: "infection",
  infectin: "infection",

  // Inflammation
  inflamtion: "inflammation",
  inflamation: "inflammation",

  // Antibiotic
  antibiotc: "antibiotic",
  antibotic: "antibiotic",

  // Hypertension
  hypertenssion: "hypertension",
  hypertenzion: "hypertension",

  // Diabetes
  diabetis: "diabetes",

  // Respiratory
  respitory: "respiratory",
  respiratry: "respiratory",

  // Emergency
  emergncy: "emergency",
  emergeny: "emergency",

  // Hospital
  hospitl: "hospital",

  // Clinic
  clininc: "clinic",
};

/*
|--------------------------------------------------------------------------
| ALLOWED SHORT WORDS
|--------------------------------------------------------------------------
*/

const ALLOWED_SHORT_WORDS = new Set([
  "ID",
  "NO",
  "NR",
  "MR",
  "MS",
  "DR",
  "RN",
  "MD",
  "ER",
  "OR",
  "BP",
  "HR",
  "RR",
  "BMI",
  "O2",
  "TEMP",
  "DOB",
  "AGE",
  "SEX",
  "M",
  "F",
]);

/*
|--------------------------------------------------------------------------
| TEXT CLEANING
|--------------------------------------------------------------------------
*/

function cleanOCRText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/*
|--------------------------------------------------------------------------
| WORD NORMALIZATION
|--------------------------------------------------------------------------
*/

function normalizeWord(word: string): string {
  return word
    .trim()
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/[^a-zA-Z0-9]+$/, "")
    .toLowerCase();
}

/*
|--------------------------------------------------------------------------
| TOKEN COUNT
|--------------------------------------------------------------------------
*/

function getTokenCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

/*
|--------------------------------------------------------------------------
| NUMERIC / DOCUMENT VALUES
|--------------------------------------------------------------------------
*/

function isNumericOrDocumentValue(word: string): boolean {
  const value = word.trim();

  if (!value) {
    return false;
  }

  if (/^\d+$/.test(value)) {
    return true;
  }

  if (/^\d+[./-]\d+[./-]?\d*$/.test(value)) {
    return true;
  }

  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return true;
  }

  if (/^\d+(?:mg|ml|kg|cm|mm|bpm|°c|c)$/i.test(value)) {
    return true;
  }

  if (/^[A-Z]{1,4}\d{1,}$/i.test(value)) {
    return true;
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| ALLOWED SHORT WORD
|--------------------------------------------------------------------------
*/

function isAllowedShortWord(word: string): boolean {
  return ALLOWED_SHORT_WORDS.has(word.toUpperCase());
}

/*
|--------------------------------------------------------------------------
| REPEATED CHARACTER NOISE
|--------------------------------------------------------------------------
*/

function isRepeatedCharacterNoise(word: string): boolean {
  const normalized = word
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase();

  if (normalized.length < 3) {
    return false;
  }

  return /^([a-z])\1+$/.test(normalized);
}

/*
|--------------------------------------------------------------------------
| PUNCTUATION CHECK
|--------------------------------------------------------------------------
*/

function hasMostlyPunctuation(word: string): boolean {
  if (!word) {
    return true;
  }

  const punctuation = word.replace(/[a-zA-Z0-9]/g, "").length;

  return punctuation / word.length > 0.5;
}

/*
|--------------------------------------------------------------------------
| GARBAGE DETECTION
|--------------------------------------------------------------------------
*/

function looksLikeGarbage(word: string): boolean {
  const value = word.trim();

  if (!value) {
    return true;
  }

  if (hasMostlyPunctuation(value)) {
    return true;
  }

  if (isRepeatedCharacterNoise(value)) {
    return true;
  }

  const letters = value.replace(/[^a-zA-Z]/g, "");

  if (letters.length >= 5) {
    const vowels = letters.match(/[aeiou]/gi)?.length ?? 0;

    if (vowels === 0) {
      return true;
    }
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| MEANINGFUL WORD
|--------------------------------------------------------------------------
*/

function isMeaningfulWord(word: string): boolean {
  const value = word.trim();

  if (!value) {
    return false;
  }

  if (looksLikeGarbage(value)) {
    return false;
  }

  if (isNumericOrDocumentValue(value)) {
    return true;
  }

  if (value.length <= 2) {
    return isAllowedShortWord(value);
  }

  return /[a-zA-Z]/.test(value);
}

/*
|--------------------------------------------------------------------------
| HTML ENTITY DECODER
|--------------------------------------------------------------------------
*/

function decodeHTMLEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/*
|--------------------------------------------------------------------------
| hOCR PARSER
|--------------------------------------------------------------------------
*/

function parseHOCR(hocr: string): OCRWord[] {
  if (!hocr || typeof hocr !== "string") {
    return [];
  }

  const words: OCRWord[] = [];

  const wordRegex =
    /<span[^>]*class=['"][^'"]*ocrx_word[^'"]*['"][^>]*title=['"]([^'"]*)['"][^>]*>([\s\S]*?)<\/span>/gi;

  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(hocr)) !== null) {
    const title = match[1] ?? "";
    const rawHTML = match[2] ?? "";

    const text = decodeHTMLEntities(
      rawHTML
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    );

    if (!text) {
      continue;
    }

    const bboxMatch = title.match(
      /bbox\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)/i
    );

    const confidenceMatch = title.match(
      /x_wconf\s+(-?\d+(?:\.\d+)?)/i
    );

    let bbox: BBox | undefined;

    if (bboxMatch) {
      bbox = {
        x0: Number(bboxMatch[1]),
        y0: Number(bboxMatch[2]),
        x1: Number(bboxMatch[3]),
        y1: Number(bboxMatch[4]),
      };
    }

    const confidence = confidenceMatch
      ? Number(confidenceMatch[1])
      : 0;

    words.push({
      text,
      confidence,
      bbox,
    });
  }

  return words;
}

/*
|--------------------------------------------------------------------------
| TSV PARSER
|--------------------------------------------------------------------------
*/

function parseTSV(tsv: string): OCRWord[] {
  if (!tsv || typeof tsv !== "string") {
    return [];
  }

  const lines = tsv.split("\n");

  if (lines.length < 2) {
    return [];
  }

  const words: OCRWord[] = [];

  for (const line of lines.slice(1)) {
    const parts = line.split("\t");

    if (parts.length < 12) {
      continue;
    }

    const confidence = Number(parts[10]);
    const text = parts[11]?.trim() ?? "";

    if (!text) {
      continue;
    }

    if (!Number.isFinite(confidence) || confidence < 0) {
      continue;
    }

    const left = Number(parts[6]);
    const top = Number(parts[7]);
    const width = Number(parts[8]);
    const height = Number(parts[9]);

    let bbox: BBox | undefined;

    if (
      Number.isFinite(left) &&
      Number.isFinite(top) &&
      Number.isFinite(width) &&
      Number.isFinite(height)
    ) {
      bbox = {
        x0: left,
        y0: top,
        x1: left + width,
        y1: top + height,
      };
    }

    words.push({
      text,
      confidence,
      bbox,
    });
  }

  return words;
}

/*
|--------------------------------------------------------------------------
| TEXT FALLBACK
|--------------------------------------------------------------------------
*/

function wordsFromText(
  text: string,
  confidence: number
): OCRWord[] {
  const words: OCRWord[] = [];

  const lines = text.split(/\n+/);

  for (const line of lines) {
    const parts = line
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    for (const part of parts) {
      words.push({
        text: part,
        confidence,
      });
    }
  }

  return words;
}

/*
|--------------------------------------------------------------------------
| SORT WORDS
|--------------------------------------------------------------------------
*/

function sortWords(words: OCRWord[]): OCRWord[] {
  return [...words].sort((a, b) => {
    if (!a.bbox && !b.bbox) {
      return 0;
    }

    if (!a.bbox) {
      return 1;
    }

    if (!b.bbox) {
      return -1;
    }

    const aHeight = a.bbox.y1 - a.bbox.y0;
    const bHeight = b.bbox.y1 - b.bbox.y0;

    const aCenter = a.bbox.y0 + aHeight / 2;
    const bCenter = b.bbox.y0 + bHeight / 2;

    const averageHeight = (aHeight + bHeight) / 2;

    const verticalDifference = Math.abs(
      aCenter - bCenter
    );

    if (
      verticalDifference <=
      averageHeight * 0.8
    ) {
      return a.bbox.x0 - b.bbox.x0;
    }

    return aCenter - bCenter;
  });
}

/*
|--------------------------------------------------------------------------
| RECONSTRUCT TEXT
|--------------------------------------------------------------------------
*/

function reconstructText(words: OCRWord[]): string {
  if (!words.length) {
    return "";
  }

  const sorted = sortWords(words);

  let result = "";
  let previousWord: OCRWord | null = null;

  for (const word of sorted) {
    const text = word.text.trim();

    if (!text) {
      continue;
    }

    if (previousWord?.bbox && word.bbox) {
      const previousHeight =
        previousWord.bbox.y1 -
        previousWord.bbox.y0;

      const currentHeight =
        word.bbox.y1 -
        word.bbox.y0;

      const previousCenter =
        previousWord.bbox.y0 +
        previousHeight / 2;

      const currentCenter =
        word.bbox.y0 +
        currentHeight / 2;

      const averageHeight =
        (previousHeight +
          currentHeight) /
        2;

      const verticalDistance = Math.abs(
        currentCenter -
          previousCenter
      );

      const newLine =
        verticalDistance >
        averageHeight * 0.8;

      if (newLine) {
        result += "\n";
      } else {
        result += " ";
      }
    } else if (result.length > 0) {
      result += " ";
    }

    result += text;

    previousWord = word;
  }

  return cleanOCRText(result);
}

/*
|--------------------------------------------------------------------------
| MEDICAL CORRECTION
|--------------------------------------------------------------------------
*/

function findMedicalCorrection(
  word: string
): string | null {
  const normalized = normalizeWord(word);

  if (!normalized) {
    return null;
  }

  return MEDICAL_CORRECTIONS[normalized] ?? null;
}

/*
|--------------------------------------------------------------------------
| APPLY CORRECTIONS
|--------------------------------------------------------------------------
*/

function applyCorrections(
  words: OCRWord[],
  confidenceSource: ConfidenceSource
): ProcessedWord[] {
  return words.map((word) => {
    const originalText = word.text;

    const correction =
      findMedicalCorrection(originalText);

    if (correction) {
      return {
        ...word,
        originalText,
        correctedText: correction,
        text: correction,
        flagged: true,
        corrected: true,
        reason:
          `Possible OCR error: "${originalText}" → "${correction}"`,
        confidenceSource,
      };
    }

    const flagged =
      word.confidence > 0 &&
      word.confidence < CONFIDENCE_THRESHOLD;

    return {
      ...word,
      originalText,
      correctedText: originalText,
      flagged,
      corrected: false,
      reason: flagged
        ? "Low OCR confidence"
        : undefined,
      confidenceSource,
    };
  });
}

/*
|--------------------------------------------------------------------------
| BUILD FINAL WORDS
|--------------------------------------------------------------------------
*/

function buildFinalWords(
  rawWords: OCRWord[],
  tesseractConfidence: number,
  confidenceSource: ConfidenceSource
): ProcessedWord[] {
  const processed = rawWords.map((word) => ({
    ...word,
    confidence:
      word.confidence > 0
        ? word.confidence
        : tesseractConfidence,
  }));

  return applyCorrections(
    processed,
    confidenceSource
  );
}

/*
|--------------------------------------------------------------------------
| KLARO CONFIDENCE
|--------------------------------------------------------------------------
*/

function calculateKlaroConfidence(
  words: ProcessedWord[],
  tesseractConfidence: number
): number {
  if (!words.length) {
    return Math.max(
      0,
      Math.min(100, tesseractConfidence)
    );
  }

  const meaningfulWords =
    words.filter((word) =>
      isMeaningfulWord(
        word.originalText
      )
    );

  if (!meaningfulWords.length) {
    return Math.max(
      0,
      Math.min(100, tesseractConfidence)
    );
  }

  const realWordConfidences =
    meaningfulWords
      .map((word) => word.confidence)
      .filter(
        (confidence) =>
          Number.isFinite(confidence) &&
          confidence > 0
      );

  if (!realWordConfidences.length) {
    return Math.max(
      0,
      Math.min(100, tesseractConfidence)
    );
  }

  const average =
    realWordConfidences.reduce(
      (sum, value) => sum + value,
      0
    ) /
    realWordConfidences.length;

  const correctionPenalty =
    meaningfulWords.filter(
      (word) => word.corrected
    ).length * 2;

  const lowConfidencePenalty =
    meaningfulWords.filter(
      (word) =>
        word.confidence > 0 &&
        word.confidence < CONFIDENCE_THRESHOLD
    ).length * 1.5;

  const score =
    average -
    correctionPenalty -
    lowConfidencePenalty;

  return Math.max(
    0,
    Math.min(
      100,
      Number(score.toFixed(1))
    )
  );
}

/*
|--------------------------------------------------------------------------
| OCR QUALITY / COMPLETENESS
|--------------------------------------------------------------------------
|
| This is NOT the same thing as OCR confidence.
|
| Tesseract confidence answers:
|
| "How confident am I in what I recognized?"
|
| This function asks:
|
| "Does this result look complete and useful?"
|
| This allows Klaro to detect situations such as:
|
|   Image contains 5 words
|   OCR returns 1 word at 94%
|
| The 94% confidence can still be valid for the
| one word, while the result itself is incomplete.
|
|--------------------------------------------------------------------------
*/

function calculateRecognitionQuality(
  result: OCRResult
): number {
  const text = cleanOCRText(result.rawText);

  const textTokens = getTokenCount(text);

  const meaningfulWordCount =
    result.words.filter((word) =>
      isMeaningfulWord(word.text)
    ).length;

  const totalWordCount =
    result.words.length;

  const confidence =
    Number.isFinite(result.tesseractConfidence)
      ? result.tesseractConfidence
      : 0;

  let score = 0;

  /*
  |--------------------------------------------------------------------------
  | 1. TEXT PRESENCE
  |--------------------------------------------------------------------------
  */

  if (text.length > 0) {
    score += 15;
  }

  /*
  |--------------------------------------------------------------------------
  | 2. TOKEN / WORD COMPLETENESS
  |--------------------------------------------------------------------------
  |
  | We deliberately do NOT require a fixed number of words.
  |
  | One-word documents can still receive a good score.
  |
  | However, when there are more words, having more
  | recognized words is strong evidence that the result
  | is more complete.
  |--------------------------------------------------------------------------
  */

  if (textTokens >= 10) {
    score += 35;
  } else if (textTokens >= 6) {
    score += 32;
  } else if (textTokens >= 4) {
    score += 28;
  } else if (textTokens >= 3) {
    score += 23;
  } else if (textTokens === 2) {
    score += 18;
  } else if (textTokens === 1) {
    score += 12;
  }

  /*
  |--------------------------------------------------------------------------
  | 3. WORD-LEVEL DATA
  |--------------------------------------------------------------------------
  */

  if (meaningfulWordCount >= 10) {
    score += 25;
  } else if (meaningfulWordCount >= 6) {
    score += 23;
  } else if (meaningfulWordCount >= 4) {
    score += 21;
  } else if (meaningfulWordCount >= 3) {
    score += 17;
  } else if (meaningfulWordCount === 2) {
    score += 13;
  } else if (meaningfulWordCount === 1) {
    score += 8;
  }

  /*
  |--------------------------------------------------------------------------
  | 4. TESSERACT CONFIDENCE
  |--------------------------------------------------------------------------
  */

  if (confidence >= 90) {
    score += 25;
  } else if (confidence >= 80) {
    score += 22;
  } else if (confidence >= 70) {
    score += 18;
  } else if (confidence >= 50) {
    score += 12;
  } else if (confidence > 0) {
    score += 5;
  }

  /*
  |--------------------------------------------------------------------------
  | 5. GARBAGE PENALTY
  |--------------------------------------------------------------------------
  */

  const garbageWords =
    result.words.filter((word) =>
      looksLikeGarbage(word.text)
    ).length;

  if (garbageWords > 0) {
    score -= Math.min(
      20,
      garbageWords * 4
    );
  }

  /*
  |--------------------------------------------------------------------------
  | 6. LOW-CONFIDENCE WORD PENALTY
  |--------------------------------------------------------------------------
  */

  const lowConfidenceWords =
    result.words.filter(
      (word) =>
        word.confidence > 0 &&
        word.confidence < 40
    ).length;

  if (lowConfidenceWords > 0) {
    score -= Math.min(
      15,
      lowConfidenceWords * 3
    );
  }

  return Math.max(
    0,
    Math.min(
      100,
      Number(score.toFixed(1))
    )
  );
}

/*
|--------------------------------------------------------------------------
| DETECT SUSPICIOUSLY INCOMPLETE OCR
|--------------------------------------------------------------------------
|
| This is the important part.
|
| We do NOT say:
|
|   "less than 4 words = wrong"
|
| Instead, we ask whether AUTO looks suspicious
| enough to justify another OCR attempt.
|
|--------------------------------------------------------------------------
*/

function isSuspiciouslyIncomplete(
  result: OCRResult
): boolean {
  const text = cleanOCRText(result.rawText);

  const tokenCount =
    getTokenCount(text);

  const meaningfulWordCount =
    result.words.filter((word) =>
      isMeaningfulWord(word.text)
    ).length;

  const quality =
    calculateRecognitionQuality(result);

  /*
  |--------------------------------------------------------------------------
  | Completely empty result
  |--------------------------------------------------------------------------
  */

  if (
    !text &&
    meaningfulWordCount === 0
  ) {
    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Very small result
  |--------------------------------------------------------------------------
  |
  | A single recognized word is not automatically wrong.
  |
  | But it is suspicious enough that we should try
  | another segmentation mode.
  |--------------------------------------------------------------------------
  */

  if (
    tokenCount === 1 &&
    meaningfulWordCount <= 1
  ) {
    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Very low recognition quality
  |--------------------------------------------------------------------------
  */

  if (quality < 45) {
    return true;
  }

  /*
  |--------------------------------------------------------------------------
  | Word-level result is unexpectedly tiny
  |--------------------------------------------------------------------------
  */

  if (
    tokenCount <= 2 &&
    meaningfulWordCount <= 2 &&
    result.tesseractConfidence >= 85
  ) {
    return true;
  }

  return false;
}

/*
|--------------------------------------------------------------------------
| COMPARE OCR RESULTS
|--------------------------------------------------------------------------
|
| Higher quality wins.
|
| Confidence alone does NOT decide the winner.
|
|--------------------------------------------------------------------------
*/

function chooseBestOCRResult(
  first: OCRResult,
  second: OCRResult
): {
  result: OCRResult;
  selected: "first" | "second";
  firstQuality: number;
  secondQuality: number;
} {
  const firstQuality =
    calculateRecognitionQuality(first);

  const secondQuality =
    calculateRecognitionQuality(second);

  console.log(
    "\nOCR CANDIDATE COMPARISON"
  );

  console.log(
    "First candidate quality:",
    firstQuality
  );

  console.log(
    "Second candidate quality:",
    secondQuality
  );

  console.log(
    "First candidate tokens:",
    getTokenCount(first.rawText)
  );

  console.log(
    "Second candidate tokens:",
    getTokenCount(second.rawText)
  );

  console.log(
    "First candidate words:",
    first.words.length
  );

  console.log(
    "Second candidate words:",
    second.words.length
  );

  /*
  |--------------------------------------------------------------------------
  | Require a meaningful advantage before switching.
  |--------------------------------------------------------------------------
  |
  | This prevents tiny score differences from causing
  | unstable OCR selection.
  |--------------------------------------------------------------------------
  */

  if (secondQuality > firstQuality + 5) {
    console.log(
      "SECOND OCR candidate selected."
    );

    return {
      result: second,
      selected: "second",
      firstQuality,
      secondQuality,
    };
  }

  console.log(
    "FIRST OCR candidate selected."
  );

  return {
    result: first,
    selected: "first",
    firstQuality,
    secondQuality,
  };
}

/*
|--------------------------------------------------------------------------
| WORKER PATH
|--------------------------------------------------------------------------
*/

async function getWorkerPath(): Promise<string> {
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js"
  );

  console.log(
    "Resolved worker path:",
    workerPath
  );

  await fs.access(workerPath);

  console.log(
    "Worker file confirmed."
  );

  return workerPath;
}

/*
|--------------------------------------------------------------------------
| OCR RECOGNITION
|--------------------------------------------------------------------------
*/

async function recognizeImage(
  imagePath: string,
  workerPath: string,
  psmMode: PSM,
  attemptName: string
): Promise<OCRResult> {
  console.log("\n");
  console.log(
    "========================================"
  );
  console.log(
    `TESSERACT RECOGNITION: ${attemptName}`
  );
  console.log(
    "========================================"
  );

  console.log(
    "Image:",
    imagePath
  );

  console.log(
    "Worker:",
    workerPath
  );

  const worker = await createWorker(
    "eng",
    1,
    {
      workerPath,
      logger: (message) => {
        if (
          message.status ===
          "recognizing text"
        ) {
          console.log(
            `Tesseract: ${Math.round(
              (message.progress ?? 0) * 100
            )}%`
          );
        }
      },
    }
  );

  try {
    console.log(
      "Setting PSM:",
      psmMode
    );

    await worker.setParameters({
      tessedit_pageseg_mode:
        psmMode,
    });

    console.log(
      "Calling worker.recognize()..."
    );

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

    console.log(
      "worker.recognize() RETURNED!"
    );

    const data = result.data;

    console.log(
      "TESSERACT DATA KEYS:",
      Object.keys(data)
    );

    const rawText =
      typeof data.text === "string"
        ? data.text
        : "";

    const tesseractConfidence =
      Number(data.confidence) || 0;

    const hocr =
      typeof data.hocr === "string"
        ? data.hocr
        : "";

    const tsv =
      typeof data.tsv === "string"
        ? data.tsv
        : "";

    console.log(
      "\nTESSERACT TEXT:"
    );

    console.log(
      JSON.stringify(rawText)
    );

    console.log(
      "TESSERACT TEXT LENGTH:",
      rawText.length
    );

    console.log(
      "TESSERACT HOCR LENGTH:",
      hocr.length
    );

    console.log(
      "TESSERACT TSV LENGTH:",
      tsv.length
    );

    console.log(
      "TESSERACT CONFIDENCE:",
      tesseractConfidence
    );

    /*
    |--------------------------------------------------------------------------
    | NATIVE WORDS
    |--------------------------------------------------------------------------
    */

    const dataWithOptionalWords =
      data as typeof data & {
        words?: Array<{
          text?: string;
          confidence?: number;
          bbox?: {
            x0?: number;
            y0?: number;
            x1?: number;
            y1?: number;
          };
        }>;
      };

    const nativeWords =
      Array.isArray(
        dataWithOptionalWords.words
      )
        ? dataWithOptionalWords.words
        : [];

    console.log(
      "TESSERACT NATIVE WORDS:",
      nativeWords.length
    );

    let rawWords: OCRWord[] = [];

    let confidenceSource:
      ConfidenceSource = "fallback";

    /*
    |--------------------------------------------------------------------------
    | METHOD 1: NATIVE WORDS
    |--------------------------------------------------------------------------
    */

    if (nativeWords.length > 0) {
      rawWords = nativeWords
        .map((word) => {
          let bbox:
            | BBox
            | undefined;

          if (word.bbox) {
            bbox = {
              x0:
                Number(
                  word.bbox.x0
                ) || 0,
              y0:
                Number(
                  word.bbox.y0
                ) || 0,
              x1:
                Number(
                  word.bbox.x1
                ) || 0,
              y1:
                Number(
                  word.bbox.y1
                ) || 0,
            };
          }

          return {
            text:
              String(
                word.text ?? ""
              ).trim(),
            confidence:
              Number(
                word.confidence
              ) || 0,
            bbox,
          };
        })
        .filter(
          (word) => word.text
        );

      if (rawWords.length > 0) {
        confidenceSource = "word";

        console.log(
          "Using native Tesseract word-level data."
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | METHOD 2: hOCR
    |--------------------------------------------------------------------------
    */

    if (
      rawWords.length === 0 &&
      hocr.length > 0
    ) {
      console.log(
        "Parsing hOCR..."
      );

      const hocrWords =
        parseHOCR(hocr);

      console.log(
        "Parsed hOCR words:",
        hocrWords.length
      );

      if (hocrWords.length > 0) {
        rawWords = hocrWords;
        confidenceSource = "hocr";

        console.log(
          "Using hOCR word-level confidence."
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | METHOD 3: TSV
    |--------------------------------------------------------------------------
    */

    if (
      rawWords.length === 0 &&
      tsv.length > 0
    ) {
      console.log(
        "Parsing TSV..."
      );

      const tsvWords =
        parseTSV(tsv);

      console.log(
        "Parsed TSV words:",
        tsvWords.length
      );

      if (tsvWords.length > 0) {
        rawWords = tsvWords;
        confidenceSource = "tsv";

        console.log(
          "Using TSV word-level confidence."
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | METHOD 4: TEXT FALLBACK
    |--------------------------------------------------------------------------
    */

    if (
      rawWords.length === 0 &&
      rawText.trim()
    ) {
      rawWords =
        wordsFromText(
          rawText,
          tesseractConfidence
        );

      confidenceSource =
        "tesseract-overall";

      console.log(
        "No word-level data available."
      );

      console.log(
        "Using overall Tesseract confidence as fallback."
      );
    }

    console.log(
      "\nFINAL RAW WORD COUNT:",
      rawWords.length
    );

    if (rawWords.length > 0) {
      console.log(
        "\nWORD DETAILS:"
      );

      for (const word of rawWords) {
        console.log(
          `- "${word.text}" => ${word.confidence}%`,
          word.bbox
            ? `bbox=${JSON.stringify(
                word.bbox
              )}`
            : ""
        );
      }
    }

    const sortedWords =
      sortWords(rawWords);

    const reconstructedRawText =
      rawWords.some(
        (word) => word.bbox
      )
        ? reconstructText(
            sortedWords
          )
        : cleanOCRText(
            rawText
          );

    const finalResult: OCRResult = {
      rawText:
        reconstructedRawText,
      tesseractConfidence,
      words:
        sortedWords,
      confidenceSource,
    };

    console.log(
      "\nOCR RESULT QUALITY:",
      calculateRecognitionQuality(
        finalResult
      )
    );

    console.log(
      "OCR RESULT TOKEN COUNT:",
      getTokenCount(
        finalResult.rawText
      )
    );

    console.log(
      "OCR RESULT SUSPICIOUS:",
      isSuspiciouslyIncomplete(
        finalResult
      )
    );

    return finalResult;
  } finally {
    console.log(
      "Terminating Tesseract worker..."
    );

    await worker.terminate();

    console.log(
      "Tesseract worker terminated."
    );
  }
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

  let resizedPath:
    | string
    | null = null;

  try {
    console.log("\n");
    console.log(
      "========================================"
    );
    console.log(
      "KLARO OCR REQUEST"
    );
    console.log(
      "========================================"
    );

    /*
    |--------------------------------------------------------------------------
    | GET FILE
    |--------------------------------------------------------------------------
    */

    const formData =
      await request.formData();

    const file =
      formData.get("file");

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
      "File:",
      file.name
    );

    console.log(
      "Type:",
      file.type
    );

    console.log(
      "Size:",
      file.size,
      "bytes"
    );

    /*
    |--------------------------------------------------------------------------
    | VALIDATE FILE
    |--------------------------------------------------------------------------
    */

    if (
      !file.type.startsWith("image/")
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

    const buffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    /*
    |--------------------------------------------------------------------------
    | TEMP DIRECTORY
    |--------------------------------------------------------------------------
    */

    const tempDirectory =
      path.join(
        os.tmpdir(),
        "klaro-ocr"
      );

    await fs.mkdir(
      tempDirectory,
      {
        recursive: true,
      }
    );

    const id =
      crypto.randomUUID();

    resizedPath =
      path.join(
        tempDirectory,
        `${id}-resized.jpg`
      );

    /*
    |--------------------------------------------------------------------------
    | IMAGE METADATA
    |--------------------------------------------------------------------------
    */

    const metadata =
      await sharp(buffer)
        .metadata();

    console.log(
      "Width:",
      metadata.width
    );

    console.log(
      "Height:",
      metadata.height
    );

    console.log(
      "Channels:",
      metadata.channels
    );

    console.log(
      "Density:",
      metadata.density
    );

    /*
    |--------------------------------------------------------------------------
    | PREPROCESSING
    |--------------------------------------------------------------------------
    |
    | Keep this deliberately conservative.
    |
    | 1. Auto rotate
    | 2. Resize
    | 3. High-quality JPEG
    |
    |--------------------------------------------------------------------------
    */

    console.log("\n");
    console.log(
      "========================================"
    );
    console.log(
      "PREPROCESSING"
    );
    console.log(
      "========================================"
    );

    const processedImage =
      await sharp(buffer)
        .rotate()
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality: 95,
          chromaSubsampling: "4:4:4",
        })
        .toFile(
          resizedPath
        );

    console.log(
      "Processed dimensions:",
      processedImage.width,
      "x",
      processedImage.height
    );

    console.log(
      "Resize only."
    );

    console.log(
      "Original color preserved."
    );

    /*
    |--------------------------------------------------------------------------
    | WORKER
    |--------------------------------------------------------------------------
    */

    console.log("\n");
    console.log(
      "========================================"
    );
    console.log(
      "WORKER"
    );
    console.log(
      "========================================"
    );

    const workerPath =
      await getWorkerPath();

    /*
    |--------------------------------------------------------------------------
    | OCR ATTEMPT 1
    |--------------------------------------------------------------------------
    |
    | AUTO / PSM 3
    |
    | This remains the primary mode because Klaro
    | must support general documents, multiple lines,
    | paragraphs and clinic forms.
    |--------------------------------------------------------------------------
    */

    console.log("\n");
    console.log(
      "========================================"
    );
    console.log(
      "OCR ATTEMPT 1: GENERAL DOCUMENT"
    );
    console.log(
      "PSM: AUTO (3)"
    );
    console.log(
      "========================================"
    );

    let ocrResult =
      await recognizeImage(
        resizedPath,
        workerPath,
        PSM.AUTO,
        "AUTO / PSM 3"
      );

    let usedSingleLineFallback =
      false;

    let singleLineResult:
      | OCRResult
      | null = null;

    let comparison:
      | {
          firstQuality: number;
          secondQuality: number;
          selected:
            | "first"
            | "second";
        }
      | null = null;

    /*
    |--------------------------------------------------------------------------
    | DECIDE WHETHER AUTO NEEDS ANOTHER ATTEMPT
    |--------------------------------------------------------------------------
    */

    const autoQuality =
      calculateRecognitionQuality(
        ocrResult
      );

    const autoSuspicious =
      isSuspiciouslyIncomplete(
        ocrResult
      );

    console.log("\n");
    console.log(
      "========================================"
    );
    console.log(
      "AUTO RESULT ANALYSIS"
    );
    console.log(
      "========================================"
    );

    console.log(
      "AUTO quality:",
      autoQuality
    );

    console.log(
      "AUTO token count:",
      getTokenCount(
        ocrResult.rawText
      )
    );

    console.log(
      "AUTO word count:",
      ocrResult.words.length
    );

    console.log(
      "AUTO suspicious:",
      autoSuspicious
    );

    /*
    |--------------------------------------------------------------------------
    | OCR ATTEMPT 2
    |--------------------------------------------------------------------------
    |
    | SINGLE_LINE / PSM 7
    |
    | This is NOT because Klaro only supports sentences.
    |
    | It is simply a second candidate when the general
    | document segmentation looks suspicious.
    |--------------------------------------------------------------------------
    */

    if (autoSuspicious) {
      console.log("\n");
      console.log(
        "========================================"
      );
      console.log(
        "OCR ATTEMPT 2: ALTERNATIVE SEGMENTATION"
      );
      console.log(
        "PSM: SINGLE_LINE (7)"
      );
      console.log(
        "========================================"
      );

      singleLineResult =
        await recognizeImage(
          resizedPath,
          workerPath,
          PSM.SINGLE_LINE,
          "SINGLE LINE / PSM 7"
        );

      const comparisonResult =
        chooseBestOCRResult(
          ocrResult,
          singleLineResult
        );

      comparison = {
        firstQuality:
          comparisonResult.firstQuality,
        secondQuality:
          comparisonResult.secondQuality,
        selected:
          comparisonResult.selected,
      };

      if (
        comparisonResult.selected ===
        "second"
      ) {
        ocrResult =
          singleLineResult;

        usedSingleLineFallback =
          true;
      }

      console.log(
        "Selected OCR candidate:",
        comparisonResult.selected
      );
    } else {
      console.log(
        "\nAUTO result appears sufficiently complete."
      );

      console.log(
        "No alternative segmentation needed."
      );
    }

    /*
    |--------------------------------------------------------------------------
    | PROCESS WORDS
    |--------------------------------------------------------------------------
    */

    const processedWords =
      buildFinalWords(
        ocrResult.words,
        ocrResult.tesseractConfidence,
        ocrResult.confidenceSource
      );

    /*
    |--------------------------------------------------------------------------
    | MEANINGFUL WORDS
    |--------------------------------------------------------------------------
    */

    const meaningfulWords =
      processedWords.filter(
        (word) =>
          isMeaningfulWord(
            word.originalText
          )
      );

    /*
    |--------------------------------------------------------------------------
    | FINAL TEXT
    |--------------------------------------------------------------------------
    */

    const finalText =
      processedWords.length > 0
        ? reconstructText(
            processedWords.map(
              (word) => ({
                text:
                  word.correctedText,
                confidence:
                  word.confidence,
                bbox:
                  word.bbox,
              })
            )
          )
        : cleanOCRText(
            ocrResult.rawText
          );

    /*
    |--------------------------------------------------------------------------
    | FLAGGED WORDS
    |--------------------------------------------------------------------------
    */

    const flaggedWords =
      processedWords.filter(
        (word) =>
          word.flagged
      );

    /*
    |--------------------------------------------------------------------------
    | KLARO CONFIDENCE
    |--------------------------------------------------------------------------
    */

    const klaroConfidence =
      calculateKlaroConfidence(
        processedWords,
        ocrResult.tesseractConfidence
      );

    /*
    |--------------------------------------------------------------------------
    | PROCESSING TIME
    |--------------------------------------------------------------------------
    */

    const processingTimeMs =
      Date.now() -
      startTime;

    /*
    |--------------------------------------------------------------------------
    | LOG RESULT
    |--------------------------------------------------------------------------
    */

    console.log("\n");
    console.log(
      "========================================"
    );
    console.log(
      "KLARO OCR RESULT"
    );
    console.log(
      "========================================"
    );

    console.log(
      "Tesseract confidence:",
      ocrResult.tesseractConfidence
    );

    console.log(
      "Klaro confidence:",
      klaroConfidence
    );

    console.log(
      "Confidence source:",
      ocrResult.confidenceSource
    );

    console.log(
      "Recognition quality:",
      calculateRecognitionQuality(
        ocrResult
      )
    );

    console.log(
      "Raw words:",
      processedWords.length
    );

    console.log(
      "Meaningful words:",
      meaningfulWords.length
    );

    console.log(
      "Flagged words:",
      flaggedWords.length
    );

    console.log(
      "Used SINGLE_LINE fallback:",
      usedSingleLineFallback
    );

    console.log(
      "Used original fallback: false"
    );

    if (comparison) {
      console.log(
        "AUTO quality:",
        comparison.firstQuality
      );

      console.log(
        "SINGLE_LINE quality:",
        comparison.secondQuality
      );
    }

    console.log(
      "\nRAW TEXT:"
    );

    console.log(
      ocrResult.rawText
    );

    console.log(
      "\nFINAL TEXT:"
    );

    console.log(
      finalText
    );

    console.log(
      "\nFLAGGED WORDS:"
    );

    for (const word of flaggedWords) {
      console.log(
        `"${word.originalText}" -> "${word.correctedText}" | ${word.confidence}% | ${word.reason ?? ""}`
      );
    }

    console.log(
      "\nProcessing time:",
      processingTimeMs,
      "ms"
    );

    /*
    |--------------------------------------------------------------------------
    | RESPONSE
    |--------------------------------------------------------------------------
    */

    return NextResponse.json({
      success: true,

      text:
        finalText,

      rawText:
        ocrResult.rawText,

      confidence:
        klaroConfidence,

      tesseractConfidence:
        ocrResult.tesseractConfidence,

      confidenceSource:
        ocrResult.confidenceSource,

      score:
        klaroConfidence,

      recognitionQuality:
        calculateRecognitionQuality(
          ocrResult
        ),

      words:
        processedWords.map(
          (word) => ({
            text:
              word.correctedText,

            originalText:
              word.originalText,

            correctedText:
              word.correctedText,

            confidence:
              Number(
                word.confidence.toFixed(
                  1
                )
              ),

            flagged:
              word.flagged,

            corrected:
              word.corrected,

            reason:
              word.reason,

            confidenceSource:
              word.confidenceSource,

            bbox:
              word.bbox,
          })
        ),

      flaggedWords:
        flaggedWords.map(
          (word) => ({
            text:
              word.correctedText,

            originalText:
              word.originalText,

            confidence:
              Number(
                word.confidence.toFixed(
                  1
                )
              ),

            corrected:
              word.corrected,

            reason:
              word.reason,

            bbox:
              word.bbox,
          })
        ),

      flaggedWordCount:
        flaggedWords.length,

      threshold:
        CONFIDENCE_THRESHOLD,

      processingTimeMs,

      processing: {
        preprocessing:
          "rotate + resize + high-quality JPEG",

        psm:
          usedSingleLineFallback
            ? "SINGLE_LINE (7)"
            : "AUTO (3)",

        usedSingleLineFallback,

        usedOriginalFallback:
          false,

        wordLevelData:
          ocrResult.confidenceSource !==
            "tesseract-overall" &&
          ocrResult.confidenceSource !==
            "fallback",

        confidenceMethod:
          ocrResult.confidenceSource ===
          "hocr"
            ? "hOCR x_wconf"
            : ocrResult.confidenceSource ===
              "tsv"
            ? "TSV word confidence"
            : ocrResult.confidenceSource ===
              "word"
            ? "Tesseract word confidence"
            : "Tesseract overall confidence",

        recognitionQuality:
          calculateRecognitionQuality(
            ocrResult
          ),

        autoQuality:
          comparison?.firstQuality ??
          calculateRecognitionQuality(
            ocrResult
          ),

        singleLineQuality:
          comparison?.secondQuality ??
          null,
      },
    });
  } catch (error) {
    console.error("\n");
    console.error(
      "========================================"
    );
    console.error(
      "KLARO OCR ERROR"
    );
    console.error(
      "========================================"
    );

    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "OCR processing failed.",
      },
      {
        status: 500,
      }
    );
  } finally {
    /*
    |--------------------------------------------------------------------------
    | CLEAN TEMP FILE
    |--------------------------------------------------------------------------
    */

    try {
      if (resizedPath) {
        await fs.unlink(
          resizedPath
        );
      }
    } catch {}
  }
}