import { createWorker } from "tesseract.js";

export type OCRWord = {
  text: string;
  confidence: number;
};

export type OCRResult = {
  text: string;
  confidence: number;
  words: OCRWord[];
};

export async function recognizeImage(
  image: File,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (
        typeof message.progress === "number" &&
        onProgress
      ) {
        onProgress(Math.round(message.progress * 100));
      }
    },
  });

  try {
    const result = await worker.recognize(
      image,
      {},
      {
        blocks: true,
      }
    );

    const data = result.data as {
      text: string;
      confidence: number;
      blocks?: Array<{
        paragraphs?: Array<{
          lines?: Array<{
            words?: Array<{
              text: string;
              confidence: number;
            }>;
          }>;
        }>;
      }>;
    };

    const blocks = data.blocks ?? [];

    const words: OCRWord[] = [];

    for (const block of blocks) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          for (const word of line.words ?? []) {
            if (word.text.trim()) {
              words.push({
                text: word.text.trim(),
                confidence: Number(word.confidence),
              });
            }
          }
        }
      }
    }

    return {
      text: data.text,
      confidence: Number(data.confidence),
      words,
    };
  } finally {
    await worker.terminate();
  }
}