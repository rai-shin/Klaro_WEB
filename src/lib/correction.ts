// src/lib/correction.ts

import {
  getSpellSuggestions,
} from "@/lib/spellchecker";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export type CorrectionCandidate = {
  word: string;
  distance: number;
  similarity: number;
};

export type CorrectionResult = {
  suggestion: string | null;
  candidates: CorrectionCandidate[];
  shouldSkip: boolean;
};

// --------------------------------------------------
// NORMALIZE WORD
// --------------------------------------------------

export function normalizeWord(
  word: string
): string {
  return word
    .replace(/[^a-zA-Z]/g, "")
    .toLowerCase()
    .trim();
}

// --------------------------------------------------
// PRIVACY / SAFETY FILTER
// --------------------------------------------------

function shouldSkipCorrection(
  word: string
): boolean {
  const trimmedWord =
    word.trim();

  if (!trimmedWord) {
    return true;
  }

  // Too short
  if (trimmedWord.length < 3) {
    return true;
  }

  // Pure numbers
  if (/^\d+$/.test(trimmedWord)) {
    return true;
  }

  // Dates
  if (
    /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(
      trimmedWord
    )
  ) {
    return true;
  }

  // Phone-like numbers
  if (
    /^[+\d\s()-]{7,}$/.test(
      trimmedWord
    )
  ) {
    return true;
  }

  // Mixed letters and numbers
  if (
    /[a-zA-Z]/.test(
      trimmedWord
    ) &&
    /\d/.test(trimmedWord)
  ) {
    return true;
  }

  return false;
}

// --------------------------------------------------
// DAMERAU-LEVENSHTEIN DISTANCE
// --------------------------------------------------

export function damerauLevenshteinDistance(
  a: string,
  b: string
): number {
  const first =
    normalizeWord(a);

  const second =
    normalizeWord(b);

  if (!first) {
    return second.length;
  }

  if (!second) {
    return first.length;
  }

  const matrix: number[][] = [];

  for (
    let i = 0;
    i <= first.length;
    i++
  ) {
    matrix[i] = [i];
  }

  for (
    let j = 0;
    j <= second.length;
    j++
  ) {
    matrix[0][j] = j;
  }

  for (
    let i = 1;
    i <= first.length;
    i++
  ) {
    for (
      let j = 1;
      j <= second.length;
      j++
    ) {
      const cost =
        first[i - 1] ===
        second[j - 1]
          ? 0
          : 1;

      matrix[i][j] =
        Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] +
            cost
        );

      // Transposition support
      if (
        i > 1 &&
        j > 1 &&
        first[i - 1] ===
          second[j - 2] &&
        first[i - 2] ===
          second[j - 1]
      ) {
        matrix[i][j] =
          Math.min(
            matrix[i][j],
            matrix[i - 2][j - 2] +
              cost
          );
      }
    }
  }

  return matrix[
    first.length
  ][second.length];
}

// --------------------------------------------------
// SIMILARITY SCORE
// --------------------------------------------------

export function calculateSimilarity(
  a: string,
  b: string
): number {
  const first =
    normalizeWord(a);

  const second =
    normalizeWord(b);

  if (!first || !second) {
    return 0;
  }

  if (first === second) {
    return 1;
  }

  const distance =
    damerauLevenshteinDistance(
      first,
      second
    );

  const maxLength =
    Math.max(
      first.length,
      second.length
    );

  return Math.max(
    0,
    1 - distance / maxLength
  );
}

// --------------------------------------------------
// MAXIMUM ALLOWED DISTANCE
// --------------------------------------------------

function getMaximumDistance(
  wordLength: number
): number {
  if (wordLength <= 4) {
    return 1;
  }

  if (wordLength <= 7) {
    return 2;
  }

  if (wordLength <= 10) {
    return 3;
  }

  return 4;
}

// --------------------------------------------------
// CONFIDENCE-BASED RULES
// --------------------------------------------------

function getMinimumSimilarity(
  confidence: number
): number {
  // High confidence:
  // OCR is already considered reliable.
  // Only allow extremely strong matches.
  if (confidence >= 90) {
    return 1;
  }

  // Moderate confidence:
  // Require a strong similarity before
  // showing a suggestion.
  if (confidence >= 70) {
    return 0.85;
  }

  // Low confidence:
  // Allow more possible corrections,
  // but still require a reasonable match.
  if (confidence >= 50) {
    return 0.65;
  }

  // Very low confidence:
  // Still require some similarity to avoid
  // random or unrelated suggestions.
  return 0.5;
}

// --------------------------------------------------
// SHOULD SUGGEST CORRECTION
// --------------------------------------------------

function shouldSuggestCorrection(
  confidence: number
): boolean {
  // High-confidence OCR words should not
  // normally receive correction suggestions.
  if (confidence >= 90) {
    return false;
  }

  return true;
}

// --------------------------------------------------
// FIND CORRECTION CANDIDATES
//
// HYBRID:
// 1. spellchecker-wasm
// 2. Dynamic candidate words
// 3. Damerau-Levenshtein
// 4. Similarity ranking
// --------------------------------------------------

export async function findCorrectionCandidates(
  word: string,
  candidateWords: string[] = []
): Promise<CorrectionCandidate[]> {
  if (
    shouldSkipCorrection(word)
  ) {
    return [];
  }

  const cleanedWord =
    normalizeWord(word);

  if (!cleanedWord) {
    return [];
  }

  const maximumDistance =
    getMaximumDistance(
      cleanedWord.length
    );

  let spellSuggestions: string[] =
    [];

  try {
    const suggestions =
      await getSpellSuggestions(
        cleanedWord
      );

    spellSuggestions =
      suggestions.map(
        (suggestion) =>
          suggestion.term
      );
  } catch (error) {
    console.error(
      "Spellchecker suggestion error:",
      error
    );
  }

  // ----------------------------------------------
  // COMBINE CANDIDATES
  // ----------------------------------------------

  const allCandidateWords =
    [
      ...candidateWords,
      ...spellSuggestions,
    ];

  // ----------------------------------------------
  // REMOVE DUPLICATES
  // ----------------------------------------------

  const uniqueMap =
    new Map<string, string>();

  for (
    const candidate of allCandidateWords
  ) {
    const normalized =
      normalizeWord(candidate);

    if (
      normalized &&
      !uniqueMap.has(normalized)
    ) {
      uniqueMap.set(
        normalized,
        candidate
      );
    }
  }

  const uniqueCandidates =
    Array.from(
      uniqueMap.values()
    );

  // ----------------------------------------------
  // RANK CANDIDATES
  // ----------------------------------------------

  const candidates =
    uniqueCandidates
      .map(
        (
          candidate
        ):
          | CorrectionCandidate
          | null => {
          const cleanedCandidate =
            normalizeWord(candidate);

          if (
            !cleanedCandidate ||
            cleanedCandidate ===
              cleanedWord
          ) {
            return null;
          }

          const distance =
            damerauLevenshteinDistance(
              cleanedWord,
              cleanedCandidate
            );

          if (
            distance >
            maximumDistance
          ) {
            return null;
          }

          return {
            word: candidate,

            distance,

            similarity:
              calculateSimilarity(
                cleanedWord,
                cleanedCandidate
              ),
          };
        }
      )
      .filter(
        (
          candidate
        ): candidate is CorrectionCandidate =>
          candidate !== null
      )
      .sort(
        (a, b) => {
          if (
            b.similarity !==
            a.similarity
          ) {
            return (
              b.similarity -
              a.similarity
            );
          }

          return (
            a.distance -
            b.distance
          );
        }
      );

  return candidates;
}

// --------------------------------------------------
// MAIN CORRECTION FUNCTION
//
// CONFIDENCE RULES:
//
// 90-100%
// High Confidence
// No correction suggestion.
//
// 70-89%
// Moderate Confidence
// Suggest only strong matches.
//
// 50-69%
// Needs Review
// Suggest reasonable matches.
//
// Below 50%
// Very Low Confidence
// Flag for review and allow possible
// suggestions with caution.
// --------------------------------------------------

export async function suggestCorrection(
  word: string,
  confidence: number,
  candidateWords: string[] = []
): Promise<string | null> {
  if (
    shouldSkipCorrection(word)
  ) {
    return null;
  }

  const numericConfidence =
    Number(confidence);

  const validConfidence =
    Number.isFinite(
      numericConfidence
    )
      ? Math.max(
          0,
          Math.min(
            100,
            numericConfidence
          )
        )
      : 0;

  // ----------------------------------------------
  // HIGH CONFIDENCE
  // ----------------------------------------------

  if (
    !shouldSuggestCorrection(
      validConfidence
    )
  ) {
    return null;
  }

  // ----------------------------------------------
  // GET CANDIDATES
  // ----------------------------------------------

  const candidates =
    await findCorrectionCandidates(
      word,
      candidateWords
    );

  if (
    candidates.length === 0
  ) {
    return null;
  }

  // ----------------------------------------------
  // CONFIDENCE-BASED SIMILARITY
  // ----------------------------------------------

  const minimumSimilarity =
    getMinimumSimilarity(
      validConfidence
    );

  const bestCandidate =
    candidates.find(
      (candidate) =>
        candidate.similarity >=
        minimumSimilarity
    );

  if (!bestCandidate) {
    return null;
  }

  return bestCandidate.word;
}

// --------------------------------------------------
// DETAILED CORRECTION RESULT
// --------------------------------------------------

export async function analyzeCorrection(
  word: string,
  confidence: number = 0,
  candidateWords: string[] = []
): Promise<CorrectionResult> {
  if (
    shouldSkipCorrection(word)
  ) {
    return {
      suggestion: null,
      candidates: [],
      shouldSkip: true,
    };
  }

  const numericConfidence =
    Number(confidence);

  const validConfidence =
    Number.isFinite(
      numericConfidence
    )
      ? Math.max(
          0,
          Math.min(
            100,
            numericConfidence
          )
        )
      : 0;

  // High-confidence words don't need
  // correction suggestions.
  if (
    validConfidence >= 90
  ) {
    return {
      suggestion: null,
      candidates: [],
      shouldSkip: false,
    };
  }

  const candidates =
    await findCorrectionCandidates(
      word,
      candidateWords
    );

  const minimumSimilarity =
    getMinimumSimilarity(
      validConfidence
    );

  const filteredCandidates =
    candidates.filter(
      (candidate) =>
        candidate.similarity >=
        minimumSimilarity
    );

  return {
    suggestion:
      filteredCandidates.length > 0
        ? filteredCandidates[0].word
        : null,

    candidates:
      filteredCandidates,

    shouldSkip: false,
  };
}