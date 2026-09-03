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
  confidence: number;
  originalConfidence?: number;
  correctedText?: string;
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

const CONFIDENCE_THRESHOLD = 70;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function normalizeToken(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

function cleanOCRText(text: string) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function isProbablyGarbage(
  text: string,
  confidence: number
): boolean {
  const normalized = normalizeToken(text);

  if (!normalized) {
    return true;
  }

  if (confidence < 15) {
    return true;
  }

  if (/^[^a-zA-Z0-9]+$/.test(text)) {
    return true;
  }

  if (/[<>{}\[\]\\|]/.test(text)) {
    return true;
  }

  if (/^(.)\1{3,}$/i.test(normalized)) {
    return true;
  }

  if (normalized.length > 40) {
    return true;
  }

  if (
    normalized.length >= 5 &&
    !/[aeiou]/i.test(normalized) &&
    !ALLOW_SHORT_WORDS.has(normalized)
  ) {
    return true;
  }

  const punctuationCount =
    text.match(/[^a-zA-Z0-9\s]/g)?.length ?? 0;

  if (
    text.length > 2 &&
    punctuationCount / text.length > 0.6
  ) {
    return true;
  }

  return false;
}

function preserveCase(
  original: string,
  corrected: string
) {
  if (original === original.toUpperCase()) {
    return corrected.toUpperCase();
  }

  if (
    original.length > 0 &&
    original[0] === original[0].toUpperCase()
  ) {
    return (
      corrected.charAt(0).toUpperCase() +
      corrected.slice(1)
    );
  }

  return corrected;
}

function applyCorrection(text: string) {
  const normalized = normalizeToken(text);

  if (!normalized) {
    return {
      text,
      corrected: false,
    };
  }

  const correction = CORRECTIONS[normalized];

  if (!correction || correction === normalized) {
    return {
      text,
      corrected: false,
    };
  }

  return {
    text: preserveCase(text, correction),
    corrected: true,
  };
}

function parseHOCR(
  hocr: string
): OCRWord[] {
  if (!hocr) {
    return [];
  }

  const words: OCRWord[] = [];

  const wordRegex =
  /<span[^>]*class=['"][^'"]*(?:ocrx_word|ocr_word)[^'"]*['"][^>]*title=['"]([^'"]*)['"][^>]*>([\s\S]*?)<\/span>/gi;
  
  let match: RegExpExecArray | null;

  while ((match = wordRegex.exec(hocr)) !== null) {
    const title = match[1];
    const rawText = match[2]
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!rawText) {
      continue;
    }

    const bboxMatch = title.match(
      /bbox\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i
    );

    const confidenceMatch = title.match(
      /x_wconf\s+(-?\d+(?:\.\d+)?)/i
    );

    const confidence = confidenceMatch
      ? Number(confidenceMatch[1])
      : 0;

    const bbox = bboxMatch
      ? {
          x0: Number(bboxMatch[1]),
          y0: Number(bboxMatch[2]),
          x1: Number(bboxMatch[3]),
          y1: Number(bboxMatch[4]),
        }
      : undefined;

    const correction = applyCorrection(rawText);

    words.push({
      text: correction.text,
      confidence,
      originalConfidence: confidence,
      correctedText: correction.text,
      corrected: correction.corrected,
      bbox,
    });
  }

  return words;
}

function parseTSV(
  tsv: string
): OCRWord[] {
  if (!tsv) {
    return [];
  }

  const lines = tsv.split(/\r?\n/);

  if (lines.length < 2) {
    return [];
  }

  const words: OCRWord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      continue;
    }

    const parts = line.split("\t");

    if (parts.length < 12) {
      continue;
    }

    const level = Number(parts[0]);

    if (level !== 5) {
      continue;
    }

    const left = Number(parts[6]);
    const top = Number(parts[7]);
    const width = Number(parts[8]);
    const height = Number(parts[9]);
    const confidence = Number(parts[10]);
    const rawText = parts.slice(11).join("\t").trim();

    if (!rawText) {
      continue;
    }

    const correction = applyCorrection(rawText);

    words.push({
      text: correction.text,
      confidence:
        Number.isFinite(confidence) ? confidence : 0,
      originalConfidence:
        Number.isFinite(confidence) ? confidence : 0,
      correctedText: correction.text,
      corrected: correction.corrected,
      bbox: {
        x0: left,
        y0: top,
        x1: left + width,
        y1: top + height,
      },
    });
  }

  return words;
}

function deduplicateWords(
  words: OCRWord[]
): OCRWord[] {
  const result: OCRWord[] = [];

  for (const word of words) {
    if (!word.text.trim()) {
      continue;
    }

    const duplicate = result.find((existing) => {
      if (
        existing.text.toLowerCase() !==
        word.text.toLowerCase()
      ) {
        return false;
      }

      if (!existing.bbox || !word.bbox) {
        return false;
      }

      const xDistance = Math.abs(
        existing.bbox.x0 - word.bbox.x0
      );

      const yDistance = Math.abs(
        existing.bbox.y0 - word.bbox.y0
      );

      return xDistance < 5 && yDistance < 5;
    });

    if (!duplicate) {
      result.push(word);
      continue;
    }

    if (word.confidence > duplicate.confidence) {
      duplicate.confidence = word.confidence;
      duplicate.originalConfidence =
        word.originalConfidence;
      duplicate.bbox = word.bbox;
    }
  }

  return result;
}

function buildTextFromWords(
  words: OCRWord[]
): string {
  if (words.length === 0) {
    return "";
  }

  const wordsWithBbox = words.filter(
    (word) => word.bbox
  );

  if (wordsWithBbox.length < 2) {
    return cleanOCRText(
      words.map((word) => word.text).join(" ")
    );
  }

  const sorted = [...wordsWithBbox].sort((a, b) => {
    const ay = a.bbox!.y0;
    const by = b.bbox!.y0;

    if (Math.abs(ay - by) > 12) {
      return ay - by;
    }

    return a.bbox!.x0 - b.bbox!.x0;
  });

  const lines: OCRWord[][] = [];

  for (const word of sorted) {
    const currentLine = lines[lines.length - 1];

    if (!currentLine) {
      lines.push([word]);
      continue;
    }

    const currentY =
      currentLine.reduce(
        (sum, item) => sum + item.bbox!.y0,
        0
      ) / currentLine.length;

    if (
      Math.abs(word.bbox!.y0 - currentY) <= 12
    ) {
      currentLine.push(word);
    } else {
      lines.push([word]);
    }
  }

  return cleanOCRText(
    lines
      .map((line) =>
        line
          .sort(
            (a, b) =>
              a.bbox!.x0 - b.bbox!.x0
          )
          .map((word) => word.text)
          .join(" ")
      )
      .join("\n")
  );
}

function calculateCandidateMetrics(
  words: OCRWord[],
  rawText: string,
  tesseractConfidence: number,
  imageWidth: number,
  imageHeight: number
) {
  const tokenCount = words.length;

  const meaningfulWords = words.filter(
    (word) =>
      !isProbablyGarbage(
        word.text,
        word.confidence
      )
  );

  const meaningfulWordCount =
    meaningfulWords.length;

  const garbageCount =
    tokenCount - meaningfulWordCount;

  const garbageRatio =
    tokenCount > 0
      ? garbageCount / tokenCount
      : 1;

  const wordConfidence =
    tokenCount > 0
      ? words.reduce(
          (sum, word) => sum + word.confidence,
          0
        ) / tokenCount
      : 0;

  const combinedConfidence =
    wordConfidence * 0.65 +
    tesseractConfidence * 0.35;

  const wordsWithBbox = words.filter(
    (word) => word.bbox
  );

  let bboxCoverage = 0;
  let horizontalCoverage = 0;
  let verticalCoverage = 0;

  if (
    wordsWithBbox.length > 0 &&
    imageWidth > 0 &&
    imageHeight > 0
  ) {
    let minX = imageWidth;
    let minY = imageHeight;
    let maxX = 0;
    let maxY = 0;

    for (const word of wordsWithBbox) {
      const bbox = word.bbox!;

      minX = Math.min(minX, bbox.x0);
      minY = Math.min(minY, bbox.y0);
      maxX = Math.max(maxX, bbox.x1);
      maxY = Math.max(maxY, bbox.y1);
    }

    const width =
      clamp(maxX - minX, 0, imageWidth);

    const height =
      clamp(maxY - minY, 0, imageHeight);

    horizontalCoverage =
      clamp(width / imageWidth, 0, 1);

    verticalCoverage =
      clamp(height / imageHeight, 0, 1);

    bboxCoverage =
      horizontalCoverage *
      verticalCoverage;
  }

  let lineCount = 0;

  if (wordsWithBbox.length > 0) {
    const sorted = [...wordsWithBbox].sort(
      (a, b) =>
        a.bbox!.y0 - b.bbox!.y0
    );

    const lineYs: number[] = [];

    for (const word of sorted) {
      const y = word.bbox!.y0;

      const existingLine = lineYs.find(
        (lineY) =>
          Math.abs(lineY - y) <= 12
      );

      if (existingLine === undefined) {
        lineYs.push(y);
      }
    }

    lineCount = lineYs.length;
  } else {
    lineCount = rawText
      .split("\n")
      .filter(Boolean).length;
  }

  const tokenScore =
    clamp(tokenCount / 5, 0, 1) * 100;

  const meaningfulScore =
    tokenCount > 0
      ? (meaningfulWordCount / tokenCount) * 100
      : 0;

  const quality =
    combinedConfidence * 0.55 +
    meaningfulScore * 0.25 +
    (100 - garbageRatio * 100) * 0.15 +
    tokenScore * 0.05;

  const suspicious =
    combinedConfidence < 45 ||
    garbageRatio > 0.35 ||
    meaningfulWordCount === 0;

  const score =
    quality -
    garbageRatio * 25 +
    Math.min(lineCount, 10) * 0.5;

  return {
    tokenCount,
    meaningfulWordCount,
    garbageRatio,
    bboxCoverage,
    horizontalCoverage,
    verticalCoverage,
    lineCount,
    quality: clamp(quality, 0, 100),
    score,
    suspicious,
  };
}

function selectBestCandidate(
  candidates: OCRCandidate[]
): OCRCandidate {
  if (candidates.length === 0) {
    throw new Error(
      "No OCR candidates were produced."
    );
  }

  const strongCandidates =
    candidates.filter(
      (candidate) =>
        candidate.tesseractConfidence >= 50 &&
        candidate.garbageRatio <= 0.35 &&
        !candidate.suspicious
    );

  const pool =
    strongCandidates.length > 0
      ? strongCandidates
      : candidates;

  const sorted = [...pool].sort(
    (a, b) => b.score - a.score
  );

  return sorted[0];
}

async function createImageVariants(
  inputPath: string,
  tempDir: string
) {
  const metadata =
    await sharp(inputPath).metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  let scale = 1;

  if (width > 0 && width < 800) {
    scale = 3;
  } else if (
    width > 0 &&
    width < 1400
  ) {
    scale = 2;
  }

  const originalPath = path.join(
    tempDir,
    "original.png"
  );

  const grayscalePath = path.join(
    tempDir,
    "grayscale.png"
  );

  let originalPipeline = sharp(inputPath);

  if (scale > 1) {
    originalPipeline =
      originalPipeline.resize({
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        fit: "fill",
      });
  }

  await originalPipeline
    .png()
    .toFile(originalPath);

  let grayscalePipeline = sharp(inputPath);

  if (scale > 1) {
    grayscalePipeline =
      grayscalePipeline.resize({
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        fit: "fill",
      });
  }

  await grayscalePipeline
    .grayscale()
    .png()
    .toFile(grayscalePath);

  return {
    variants: [
      {
        name: "ORIGINAL",
        path: originalPath,
      },
      {
        name: "GRAYSCALE",
        path: grayscalePath,
      },
    ],
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

async function recognizeImage(
  worker: Awaited<
    ReturnType<typeof createWorker>
  >,
  imagePath: string,
  psm: PSM,
  name: string,
  imageWidth: number,
  imageHeight: number
): Promise<OCRCandidate> {
  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });

  const result = await worker.recognize(
    imagePath,
    {},
    {
      text: true,
      hocr: true,
      tsv: true,
    }
  );

  const rawText = cleanOCRText(
    result.data.text ?? ""
  );

  const hocrWords = parseHOCR(
    result.data.hocr ?? ""
  );

  const tsvWords = parseTSV(
    result.data.tsv ?? ""
  );

  let words =
    hocrWords.length > 0
      ? hocrWords
      : tsvWords;

  words = deduplicateWords(words);

  const finalText =
    words.length > 0
      ? buildTextFromWords(words)
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
      finalText,
      tesseractConfidence,
      imageWidth,
      imageHeight
    );

  console.log(
    `[Klaro OCR] ${name}: ` +
      `quality=${metrics.quality.toFixed(2)}, ` +
      `tokens=${metrics.tokenCount}, ` +
      `meaningful=${metrics.meaningfulWordCount}, ` +
      `confidence=${tesseractConfidence}, ` +
      `garbage=${metrics.garbageRatio.toFixed(3)}, ` +
      `suspicious=${metrics.suspicious}`
  );

  return {
    name,
    text: finalText,
    words,
    tesseractConfidence,
    ...metrics,
  };
}

export async function POST(
  request: NextRequest
) {
  const requestStart = Date.now();

  let tempDir: string | null = null;

  let worker:
    | Awaited<
        ReturnType<typeof createWorker>
      >
    | null = null;

  console.log(
    "[Klaro OCR TIMING] ===== OCR REQUEST START ====="
  );

  try {
    const formData =
      await request.formData();

    console.log(
      `[Klaro OCR TIMING] request.formData() complete: ${
        Date.now() - requestStart
      }ms`
    );

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          message: "No image file was uploaded.",
        },
        { status: 400 }
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

    const tempStart = Date.now();

    tempDir = await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "klaro-ocr-"
      )
    );

    console.log(
      `[Klaro OCR TIMING] temporary directory created: ${
        Date.now() - requestStart
      }ms`
    );

    const inputPath = path.join(
      tempDir,
      "input"
    );

    const arrayBuffer =
      await file.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);

    console.log(
      `[Klaro OCR TIMING] file converted to Buffer: ${
        Date.now() - requestStart
      }ms`
    );

    await fs.writeFile(
      inputPath,
      buffer
    );

    console.log(
      `[Klaro OCR TIMING] input image written to disk: ${
        Date.now() - requestStart
      }ms`
    );

    console.log(
      "[Klaro OCR TIMING] Starting image preprocessing..."
    );

    const preprocessStart = Date.now();

    const {
      variants,
      width,
      height,
    } = await createImageVariants(
      inputPath,
      tempDir
    );

    console.log(
      `[Klaro OCR TIMING] image preprocessing complete: ${
        Date.now() - preprocessStart
      }ms`
    );

    console.log(
      `[Klaro OCR TIMING] Variants created: ${variants
        .map((variant) => variant.name)
        .join(", ")}`
    );

    console.log(
      "[Klaro OCR TIMING] Starting Tesseract worker creation..."
    );

    const workerStart =
      Date.now();

    /*
     * IMPORTANT:
     *
     * Do NOT manually specify workerPath here.
     *
     * Tesseract.js resolves its Node worker
     * internally. Manually pointing to:
     *
     * node_modules/tesseract.js/src/worker-script/node/index.js
     *
     * can break on Vercel because the deployed
     * filesystem/package layout is different.
     */
    worker =
      await createWorker("eng", 1);

    console.log(
      `[Klaro OCR TIMING] Tesseract worker created in ${
        Date.now() - workerStart
      }ms`
    );

    console.log(
      `[Klaro OCR TIMING] Tesseract worker ready: ${
        Date.now() - requestStart
      }ms`
    );

    const selectedVariants =
      variants.filter(
        (variant) =>
          variant.name === "ORIGINAL" ||
          variant.name === "GRAYSCALE"
      );

    console.log(
      `[Klaro OCR TIMING] Selected variants: ${selectedVariants
        .map((variant) => variant.name)
        .join(", ")}`
    );

    const candidates: OCRCandidate[] =
      [];

    for (const variant of selectedVariants) {
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
            `${variant.name} / AUTO`,
            width,
            height
          );

        candidates.push(candidate);

        console.log(
          `[Klaro OCR TIMING] <<< ${variant.name} / AUTO complete in ${
            Date.now() - candidateStart
          }ms`
        );

        console.log(
          `[Klaro OCR TIMING] ${variant.name} / AUTO complete: ${
            Date.now() - requestStart
          }ms`
        );
      } catch (error) {
        console.error(
          `[Klaro OCR] ${variant.name} AUTO failed:`,
          error
        );

        console.error(
          `[Klaro OCR TIMING] ${variant.name} / AUTO failed after ${
            Date.now() - candidateStart
          }ms`
        );
      }
    }

    console.log(
      `[Klaro OCR TIMING] OCR candidates completed: ${candidates.length}`
    );

    console.log(
      `[Klaro OCR TIMING] all OCR candidates complete: ${
        Date.now() - requestStart
      }ms`
    );

    if (candidates.length === 0) {
      throw new Error(
        "OCR failed. No candidate completed successfully."
      );
    }

    for (const candidate of candidates) {
      console.log(
        `[Klaro OCR] Candidate comparison:\n` +
          `${candidate.name}: ` +
          `quality=${candidate.quality.toFixed(2)}, ` +
          `tokens=${candidate.tokenCount}, ` +
          `meaningful=${candidate.meaningfulWordCount}, ` +
          `confidence=${candidate.tesseractConfidence}, ` +
          `coverage=${candidate.bboxCoverage.toFixed(4)}, ` +
          `horizontal=${candidate.horizontalCoverage.toFixed(4)}, ` +
          `vertical=${candidate.verticalCoverage.toFixed(4)}, ` +
          `lines=${candidate.lineCount}, ` +
          `garbage=${candidate.garbageRatio.toFixed(4)}, ` +
          `suspicious=${candidate.suspicious}`
      );
    }

    const selected =
      selectBestCandidate(candidates);

    console.log(
      `[Klaro OCR TIMING] best candidate selected: ${
        Date.now() - requestStart
      }ms`
    );

    console.log(
      `[Klaro OCR] Selected: ${selected.name}`
    );

    const finalWords =
      selected.words.map((word) => ({
        ...word,
        originalConfidence:
          word.originalConfidence ??
          word.confidence,
        correctedText:
          word.correctedText ??
          word.text,
      }));

    const flaggedWords =
      finalWords.filter(
        (word) =>
          word.confidence <
          CONFIDENCE_THRESHOLD
      );

    const correctedText =
      finalWords.length > 0
        ? buildTextFromWords(finalWords)
        : selected.text;

    const responseData = {
      success: true,

      text: correctedText,

      rawText: selected.text,

      confidence:
        selected.quality,

      tesseractConfidence:
        selected.tesseractConfidence,

      confidenceSource:
        "Tesseract word confidence + candidate quality",

      selectedCandidate:
        selected.name,

      score:
        selected.score,

      recognitionQuality:
        selected.quality,

      autoQuality:
        candidates.find(
          (candidate) =>
            candidate.name ===
            "ORIGINAL / AUTO"
        )?.quality ?? 0,

      singleBlockQuality: 0,

      grayscaleQuality:
        candidates.find(
          (candidate) =>
            candidate.name ===
            "GRAYSCALE / AUTO"
        )?.quality ?? 0,

      words: finalWords,

      flaggedWords,

      flaggedWordCount:
        flaggedWords.length,

      threshold:
        CONFIDENCE_THRESHOLD,

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

      processingTimeMs:
        Date.now() - requestStart,

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
      `[Klaro OCR TIMING] final response prepared: ${
        Date.now() - requestStart
      }ms`
    );

    console.log(
      `[Klaro OCR TIMING] ===== OCR REQUEST COMPLETE: ${
        Date.now() - requestStart
      }ms =====`
    );

    return NextResponse.json(
      responseData,
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "[Klaro OCR] OCR PROCESSING ERROR:",
      error
    );

    console.error(
      `[Klaro OCR TIMING] ===== OCR REQUEST FAILED: ${
        Date.now() - requestStart
      }ms =====`
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
          Date.now() - requestStart,
      },
      { status: 500 }
    );
  } finally {
    if (worker) {
      const terminateStart =
        Date.now();

      try {
        await worker.terminate();

        console.log(
          `[Klaro OCR TIMING] Worker terminated in ${
            Date.now() - terminateStart
          }ms`
        );
      } catch (error) {
        console.error(
          "[Klaro OCR] Failed to terminate worker:",
          error
        );
      }
    }

    if (tempDir) {
      const cleanupStart =
        Date.now();

      try {
        await fs.rm(
          tempDir,
          {
            recursive: true,
            force: true,
          }
        );

        console.log(
          `[Klaro OCR TIMING] Temporary directory cleaned in ${
            Date.now() - cleanupStart
          }ms`
        );
      } catch (error) {
        console.error(
          "[Klaro OCR] Failed to clean temporary directory:",
          error
        );
      }
    }

    console.log(
      "[Klaro OCR TIMING] ===== OCR CLEANUP COMPLETE ====="
    );
  }
}