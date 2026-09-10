"use client";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

export type SpellSuggestion = {
  term: string;
  distance: number;
  count: number;
};

type SpellcheckerInstance = {
  resultHandler: (
    results: Array<{
      term: string;
      distance: number;
      count: number;
    }>
  ) => void;

  prepareSpellchecker: (
    wasmResponse: Response,
    dictionaryResponse: Response,
    bigramResponse: Response,
    options: {
      dictionaryEditDistance: number;
      countThreshold: number;
    }
  ) => Promise<void>;

  checkSpelling: (
    word: string,
    options: {
      verbosity: unknown;
      maxEditDistance: number;
      includeUnknown: boolean;
      includeSelf: boolean;
    }
  ) => void;
};

// --------------------------------------------------
// SPELLCHECKER STATE
// --------------------------------------------------

let spellchecker: SpellcheckerInstance | null =
  null;

let initialized = false;

let initializingPromise:
  | Promise<void>
  | null = null;

// --------------------------------------------------
// INITIALIZE SPELLCHECKER
// --------------------------------------------------

export async function initializeSpellchecker(): Promise<void> {
  // Already initialized

  if (
    initialized &&
    spellchecker
  ) {
    return;
  }

  // Prevent multiple initialization calls

  if (initializingPromise) {
    return initializingPromise;
  }

  initializingPromise =
    new Promise<void>(
      async (resolve, reject) => {
        try {
          // ------------------------------------------
          // IMPORTANT:
          // ONLY RUN IN BROWSER
          // ------------------------------------------

          if (
            typeof window ===
            "undefined"
          ) {
            throw new Error(
              "Spellchecker can only run in the browser."
            );
          }

          console.log(
            "Initializing Klaro spellchecker..."
          );

          // ------------------------------------------
          // DYNAMICALLY IMPORT BROWSER VERSION
          // ------------------------------------------

          const browserModule =
            await import(
              "spellchecker-wasm/lib/browser"
            );

          const baseModule =
            await import(
              "spellchecker-wasm/lib/SpellCheckerBase"
            );

          const {
            SpellcheckerWasm,
          } = browserModule;

          // ------------------------------------------
          // CREATE SPELLCHECKER
          // ------------------------------------------

          const instance =
            new SpellcheckerWasm(
              () => {
                // Default handler
              }
            );

          // Cast through unknown to avoid
          // incompatible SuggestedItem types

          spellchecker =
            instance as unknown as SpellcheckerInstance;

          // ------------------------------------------
          // FETCH WASM
          // ------------------------------------------

          const wasmResponse =
            await fetch(
              "/spellchecker/spellchecker-wasm.wasm"
            );

          if (
            !wasmResponse.ok
          ) {
            throw new Error(
              "Failed to load spellchecker WASM."
            );
          }

          // ------------------------------------------
          // FETCH ENGLISH DICTIONARY
          // ------------------------------------------

          const dictionaryResponse =
            await fetch(
              "/spellchecker/frequency_dictionary_en_82_765.txt"
            );

          if (
            !dictionaryResponse.ok
          ) {
            throw new Error(
              "Failed to load English dictionary."
            );
          }

          // ------------------------------------------
          // FETCH BIGRAM DICTIONARY
          // ------------------------------------------

          const bigramResponse =
            await fetch(
              "/spellchecker/frequency_bigramdictionary_en_243_342.txt"
            );

          if (
            !bigramResponse.ok
          ) {
            throw new Error(
              "Failed to load English bigram dictionary."
            );
          }

          // ------------------------------------------
          // PREPARE SPELLCHECKER
          // ------------------------------------------

          await spellchecker.prepareSpellchecker(
            wasmResponse,
            dictionaryResponse,
            bigramResponse,
            {
              dictionaryEditDistance: 2,
              countThreshold: 1,
            }
          );

          initialized = true;

          console.log(
            "Klaro spellchecker initialized."
          );

          resolve();
        } catch (error) {
          console.error(
            "Spellchecker initialization error:",
            error
          );

          spellchecker = null;

          initialized = false;

          initializingPromise = null;

          reject(error);
        }
      }
    );

  return initializingPromise;
}

// --------------------------------------------------
// GET SPELL SUGGESTIONS
// --------------------------------------------------

export async function getSpellSuggestions(
  word: string
): Promise<SpellSuggestion[]> {
  // ------------------------------------------
  // VALIDATE WORD
  // ------------------------------------------

  if (
    !word.trim()
  ) {
    return [];
  }

  // ------------------------------------------
  // PREVENT SSR
  // ------------------------------------------

  if (
    typeof window ===
    "undefined"
  ) {
    return [];
  }

  // ------------------------------------------
  // INITIALIZE
  // ------------------------------------------

  await initializeSpellchecker();

  if (!spellchecker) {
    return [];
  }

  // ------------------------------------------
  // LOAD VERBOSITY
  // ------------------------------------------

  const baseModule =
    await import(
      "spellchecker-wasm/lib/SpellCheckerBase"
    );

  const {
    Verbosity,
  } = baseModule;

  // ------------------------------------------
  // RETURN SUGGESTIONS
  // ------------------------------------------

  return new Promise<
    SpellSuggestion[]
  >(
    (resolve) => {
      const suggestions:
        SpellSuggestion[] = [];

      // ----------------------------------------
      // TEMPORARY RESULT HANDLER
      // ----------------------------------------

      spellchecker!.resultHandler =
        (results) => {
          for (
            const result of results
          ) {
            if (
              result &&
              typeof result.term ===
                "string"
            ) {
              suggestions.push({
                term:
                  result.term,

                distance:
                  Number(
                    result.distance
                  ) || 0,

                count:
                  Number(
                    result.count
                  ) || 0,
              });
            }
          }

          resolve(
            suggestions
          );
        };

      // ----------------------------------------
      // CHECK SPELLING
      // ----------------------------------------

      spellchecker!.checkSpelling(
        word
          .toLowerCase()
          .trim(),
        {
          verbosity:
            Verbosity.All,

          maxEditDistance: 2,

          includeUnknown:
            false,

          includeSelf:
            false,
        }
      );
    }
  );
}

// --------------------------------------------------
// CHECK IF READY
// --------------------------------------------------

export function isSpellcheckerReady(): boolean {
  return (
    initialized &&
    spellchecker !== null
  );
}