const correctionDictionary = [
  // Clinic terms
  "patient",
  "name",
  "student",
  "number",
  "date",
  "birth",
  "age",
  "sex",
  "male",
  "female",

  "clinic",
  "medical",
  "record",
  "records",
  "history",
  "visit",

  "chief",
  "complaint",
  "symptoms",
  "symptom",
  "diagnosis",
  "treatment",
  "medication",
  "medicine",
  "remarks",

  "temperature",
  "blood",
  "pressure",

  // Common health terms
  "headache",
  "fever",
  "cough",
  "cold",
  "dizziness",
  "pain",
  "stomach",
  "nausea",
  "vomiting",
  "injury",
  "wound",

  // School terms
  "first",
  "second",
  "third",
  "fourth",
  "year",
  "section",

  // Prototype names
  "Paolo",
  "Juan",
  "Maria",
  "Jose",
  "John",
  "Mark",
];

function levenshteinDistance(
  a: string,
  b: string
): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] =
          matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function normalizeWord(word: string): string {
  return word
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Finds a possible correction without requiring
 * the OCR confidence to be below a threshold.
 *
 * Confidence is still useful for determining
 * whether the word is a "Needs Review" item.
 */
export function suggestCorrection(
  word: string,
  _confidence: number
): string | null {
  const cleanedWord = normalizeWord(word);

  if (!cleanedWord) {
    return null;
  }

  // Don't attempt corrections on very short words.
  if (cleanedWord.length < 3) {
    return null;
  }

  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of correctionDictionary) {
    const candidateWord =
      normalizeWord(candidate);

    // Don't suggest the exact same word.
    if (candidateWord === cleanedWord) {
      continue;
    }

    const distance = levenshteinDistance(
      cleanedWord,
      candidateWord
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = candidate;
    }
  }

  if (!bestMatch) {
    return null;
  }

  /*
   * Allow a small amount of variation.
   */
  let maxDistance = 1;

  if (cleanedWord.length >= 5) {
    maxDistance = 2;
  }

  if (cleanedWord.length >= 8) {
    maxDistance = 3;
  }

  if (bestDistance > maxDistance) {
    return null;
  }

  return bestMatch;
}