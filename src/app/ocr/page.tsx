"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import Image from "next/image";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

import {
  recognizeImage,
  OCRWord,
} from "@/lib/ocr";

import {
  suggestCorrection,
} from "@/lib/correction";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

type OCRStatus =
  | "idle"
  | "processing"
  | "complete"
  | "error";

type CorrectionState = {
  [word: string]: boolean;
};

type Patient = {
  id: number;
  studentId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
};

type DocumentType =
  | "image"
  | "pdf"
  | "docx";

type DocumentUploadResponse = {
  id: number;
  patientId: number;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  filePath: string | null;
  documentType: string | null;
};

// --------------------------------------------------
// CONFIDENCE THRESHOLDS
// --------------------------------------------------

const HIGH_CONFIDENCE = 90;
const MODERATE_CONFIDENCE = 70;

// --------------------------------------------------
// PAGE
// --------------------------------------------------

export default function OCRPage() {
  // --------------------------------------------------
  // MOBILE SIDEBAR
  // --------------------------------------------------

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  // --------------------------------------------------
  // FILE
  // --------------------------------------------------

  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState<string | null>(null);

  const [documentType, setDocumentType] =
    useState<DocumentType | null>(null);

  // --------------------------------------------------
  // TEXT LAYERS
  // --------------------------------------------------

  const [text, setText] =
    useState("");

  const [reviewedText, setReviewedText] =
    useState("");

  const [correctedText, setCorrectedText] =
    useState("");

  const [confidence, setConfidence] =
    useState<number | null>(null);

  const [words, setWords] =
    useState<OCRWord[]>([]);

  // --------------------------------------------------
  // PROCESSING
  // --------------------------------------------------

  const [progress, setProgress] =
    useState(0);

  const [status, setStatus] =
    useState<OCRStatus>("idle");

  const [error, setError] =
    useState("");

  // --------------------------------------------------
  // PATIENT
  // --------------------------------------------------

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [selectedPatientId, setSelectedPatientId] =
    useState("");

  const [loadingPatients, setLoadingPatients] =
    useState(true);

  // --------------------------------------------------
  // SAVE
  // --------------------------------------------------

  const [saving, setSaving] =
    useState(false);

  const [saveMessage, setSaveMessage] =
    useState("");

  const [savedDocument, setSavedDocument] =
    useState<DocumentUploadResponse | null>(
      null
    );

  // --------------------------------------------------
  // CORRECTIONS
  // --------------------------------------------------

  const [
    correctionDecisions,
    setCorrectionDecisions,
  ] = useState<CorrectionState>({});

  const [
    correctionSuggestions,
    setCorrectionSuggestions,
  ] = useState<
    Record<string, string>
  >({});

  // --------------------------------------------------
  // CLEANUP PREVIEW
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  // --------------------------------------------------
  // LOAD PATIENTS
  // --------------------------------------------------

  useEffect(() => {
    async function fetchPatients() {
      try {
        setLoadingPatients(true);

        const response =
          await fetch("/api/patients");

        const contentType =
          response.headers.get(
            "content-type"
          ) || "";

        if (
          !contentType.includes(
            "application/json"
          )
        ) {
          const responseText =
            await response.text();

          throw new Error(
            `Server returned ${response.status}: ${responseText.slice(
              0,
              300
            )}`
          );
        }

        if (!response.ok) {
          throw new Error(
            "Failed to load patients."
          );
        }

        const data =
          await response.json();

        const patientList =
          Array.isArray(data)
            ? data
            : Array.isArray(data.patients)
              ? data.patients
              : [];

        setPatients(patientList);
      } catch (error) {
        console.error(
          "Failed to load patients:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load patients."
        );
      } finally {
        setLoadingPatients(false);
      }
    }

    fetchPatients();
  }, []);

  // --------------------------------------------------
  // SYNC LAYER 2 TO LAYER 3
  // --------------------------------------------------

  function updateReviewedText(
    value: string
  ) {
    setReviewedText(value);
    setCorrectedText(value);
  }

  // --------------------------------------------------
  // DETECT DOCUMENT TYPE
  // --------------------------------------------------

  function getDocumentType(
    selectedFile: File
  ): DocumentType | null {
    const name =
      selectedFile.name.toLowerCase();

    const type =
      selectedFile.type;

    if (type.startsWith("image/")) {
      return "image";
    }

    if (
      type === "application/pdf" ||
      name.endsWith(".pdf")
    ) {
      return "pdf";
    }

    if (
      type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      name.endsWith(".docx")
    ) {
      return "docx";
    }

    return null;
  }

  // --------------------------------------------------
  // FILE SELECTION
  // --------------------------------------------------

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    const detectedType =
      getDocumentType(selectedFile);

    if (!detectedType) {
      setError(
        "Unsupported file type. Please upload JPG, JPEG, PNG, WEBP, PDF, or DOCX."
      );

      return;
    }

    setFile(selectedFile);
    setDocumentType(detectedType);

    setText("");
    setReviewedText("");
    setCorrectedText("");

    setConfidence(null);
    setWords([]);

    setProgress(0);
    setStatus("idle");

    setError("");
    setSaveMessage("");
    setSavedDocument(null);

    setCorrectionDecisions({});
    setCorrectionSuggestions({});

    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }

    if (detectedType === "image") {
      const newPreview =
        URL.createObjectURL(selectedFile);

      setPreview(newPreview);
    }
  }

  // --------------------------------------------------
  // UPLOAD ORIGINAL FILE
  // --------------------------------------------------

  async function uploadOriginalFile() {
    if (!file) {
      throw new Error(
        "No document selected."
      );
    }

    if (!selectedPatientId) {
      throw new Error(
        "Please select a patient."
      );
    }

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    formData.append(
      "patientId",
      selectedPatientId
    );

    formData.append(
      "documentType",
      "Clinic Document"
    );

    const response =
      await fetch(
        "/api/documents/upload",
        {
          method: "POST",
          body: formData,
        }
      );

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";

    let data: {
      message?: string;
      document?: DocumentUploadResponse;
    };

    if (
      contentType.includes(
        "application/json"
      )
    ) {
      data =
        await response.json();
    } else {
      const responseText =
        await response.text();

      throw new Error(
        `Server returned ${response.status}: ${responseText.slice(
          0,
          300
        )}`
      );
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to upload document."
      );
    }

    if (!data.document) {
      throw new Error(
        "Document upload succeeded but no document data was returned."
      );
    }

    return data.document;
  }

  // --------------------------------------------------
  // IMAGE OCR
  // --------------------------------------------------

  async function processImage() {
    if (!file) {
      throw new Error(
        "No image selected."
      );
    }

    const result =
      await recognizeImage(
        file,
        setProgress
      );

    setText(result.text);

    setReviewedText(
      result.text
    );

    setCorrectedText(
      result.text
    );

    setConfidence(
      result.confidence
    );

    setWords(
      result.words
    );

    setProgress(100);
  }

  // --------------------------------------------------
  // DOCX PROCESSING
  // --------------------------------------------------

  async function processDocx() {
    if (!file) {
      throw new Error(
        "No DOCX file selected."
      );
    }

    setProgress(10);

    const mammoth =
      await import("mammoth");

    setProgress(40);

    const arrayBuffer =
      await file.arrayBuffer();

    const result =
      await mammoth.extractRawText({
        arrayBuffer,
      });

    const extractedText =
      result.value.trim();

    setText(
      extractedText
    );

    setReviewedText(
      extractedText
    );

    setCorrectedText(
      extractedText
    );

    setConfidence(null);

    setWords([]);

    setProgress(100);
  }

  // --------------------------------------------------
  // PDF PROCESSING
  // --------------------------------------------------

  async function processPdf() {
    if (!file) {
      throw new Error(
        "No PDF selected."
      );
    }

    setProgress(5);

    const pdfjs =
      await import(
        "pdfjs-dist/legacy/build/pdf.mjs"
      );

    setProgress(10);

    pdfjs.GlobalWorkerOptions.workerSrc =
      "/pdf.worker.min.mjs";

    const data =
      new Uint8Array(
        await file.arrayBuffer()
      );

    const loadingTask =
      pdfjs.getDocument({
        data,
      });

    const pdf =
      await loadingTask.promise;

    const pageTexts: string[] =
      [];

    const pageConfidences: number[] =
      [];

    const allWords: OCRWord[] =
      [];

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      const page =
        await pdf.getPage(
          pageNumber
        );

      const viewport =
        page.getViewport({
          scale: 2,
        });

      const canvas =
        document.createElement(
          "canvas"
        );

      const context =
        canvas.getContext("2d");

      if (!context) {
        throw new Error(
          "Unable to create PDF canvas."
        );
      }

      canvas.width =
        Math.ceil(
          viewport.width
        );

      canvas.height =
        Math.ceil(
          viewport.height
        );

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      const imageBlob =
        await new Promise<Blob>(
          (resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(
                    new Error(
                      "Failed to convert PDF page to image."
                    )
                  );
                }
              },
              "image/png"
            );
          }
        );

      const imageFile =
        new File(
          [imageBlob],
          `pdf-page-${pageNumber}.png`,
          {
            type: "image/png",
          }
        );

      const result =
        await recognizeImage(
          imageFile
        );

      pageTexts.push(
        result.text
      );

      pageConfidences.push(
        result.confidence
      );

      allWords.push(
        ...result.words
      );

      setProgress(
        Math.round(
          10 +
            (pageNumber /
              pdf.numPages) *
              90
        )
      );
    }

    const averageConfidence =
      pageConfidences.length > 0
        ? pageConfidences.reduce(
            (
              total,
              value
            ) =>
              total + value,
            0
          ) /
          pageConfidences.length
        : null;

    const combinedText =
      pageTexts.join("\n\n");

    setText(
      combinedText
    );

    setReviewedText(
      combinedText
    );

    setCorrectedText(
      combinedText
    );

    setConfidence(
      averageConfidence
    );

    setWords(
      allWords
    );

    setProgress(100);
  }

  // --------------------------------------------------
  // PROCESS DOCUMENT
  // --------------------------------------------------

  async function handleProcessDocument() {
    if (!file) {
      setError(
        "Please select a document first."
      );

      return;
    }

    if (!selectedPatientId) {
      setError(
        "Please select a patient first."
      );

      return;
    }

    if (!documentType) {
      setError(
        "Unable to determine document type."
      );

      return;
    }

    try {
      setStatus("processing");

      setError("");
      setSaveMessage("");

      setSavedDocument(null);

      setProgress(0);

      setText("");
      setReviewedText("");
      setCorrectedText("");

      setConfidence(null);
      setWords([]);

      setCorrectionDecisions({});
      setCorrectionSuggestions({});

      const document =
        await uploadOriginalFile();

      setSavedDocument(
        document
      );

      if (
        documentType === "image"
      ) {
        await processImage();
      } else if (
        documentType === "pdf"
      ) {
        await processPdf();
      } else if (
        documentType === "docx"
      ) {
        await processDocx();
      }

      setStatus("complete");
    } catch (error) {
      console.error(
        "Document processing error:",
        error
      );

      setStatus("error");

      setError(
        error instanceof Error
          ? error.message
          : "Document processing failed."
      );
    }
  }

  // --------------------------------------------------
  // NORMALIZE WORD
  // --------------------------------------------------

  function normalizeWord(
    word: string
  ) {
    return word
      .replace(
        /[^a-zA-Z0-9]/g,
        ""
      )
      .toLowerCase()
      .trim();
  }

  // --------------------------------------------------
  // LOAD CORRECTION SUGGESTIONS
  // --------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadCorrectionSuggestions() {
      const suggestions:
        Record<string, string> = {};

      const processedWords =
        new Set<string>();

      for (const word of words) {
        if (
          word.confidence >=
          HIGH_CONFIDENCE
        ) {
          continue;
        }

        const normalized =
          normalizeWord(
            word.text
          );

        if (!normalized) {
          continue;
        }

        if (
          processedWords.has(
            normalized
          )
        ) {
          continue;
        }

        processedWords.add(
          normalized
        );

        try {
          const suggestion =
            await suggestCorrection(
              word.text,
              word.confidence
            );

          if (suggestion) {
            suggestions[
              normalized
            ] = suggestion;
          }
        } catch (error) {
          console.error(
            "Correction suggestion error:",
            error
          );
        }
      }

      if (!cancelled) {
        setCorrectionSuggestions(
          suggestions
        );
      }
    }

    if (words.length === 0) {
      setCorrectionSuggestions({});
      return;
    }

    loadCorrectionSuggestions();

    return () => {
      cancelled = true;
    };
  }, [words]);

  // --------------------------------------------------
  // GROUP POSSIBLE CORRECTIONS
  // --------------------------------------------------

  const groupedCorrectionWords =
    useMemo(() => {
      const groups = new Map<
        string,
        {
          normalized: string;
          displayWord: string;
          confidence: number;
          occurrences: number;
          suggestion: string;
        }
      >();

      for (const word of words) {
        if (
          word.confidence >=
          HIGH_CONFIDENCE
        ) {
          continue;
        }

        const normalized =
          normalizeWord(
            word.text
          );

        if (!normalized) {
          continue;
        }

        const suggestion =
          correctionSuggestions[
            normalized
          ];

        if (!suggestion) {
          continue;
        }

        const existing =
          groups.get(
            normalized
          );

        if (existing) {
          existing.occurrences += 1;

          existing.confidence =
            Math.min(
              existing.confidence,
              word.confidence
            );
        } else {
          groups.set(
            normalized,
            {
              normalized,
              displayWord:
                word.text,
              confidence:
                word.confidence,
              occurrences: 1,
              suggestion,
            }
          );
        }
      }

      return Array.from(
        groups.values()
      );
    }, [
      words,
      correctionSuggestions,
    ]);

  // --------------------------------------------------
  // GROUP LOW-CONFIDENCE WORDS
  // --------------------------------------------------

  const groupedFlaggedWords =
    useMemo(() => {
      const groups = new Map<
        string,
        {
          normalized: string;
          displayWord: string;
          confidence: number;
          occurrences: number;
        }
      >();

      for (const word of words) {
        if (
          word.confidence >=
          MODERATE_CONFIDENCE
        ) {
          continue;
        }

        const normalized =
          normalizeWord(
            word.text
          );

        if (!normalized) {
          continue;
        }

        const suggestion =
          correctionSuggestions[
            normalized
          ];

        if (suggestion) {
          continue;
        }

        const existing =
          groups.get(
            normalized
          );

        if (existing) {
          existing.occurrences += 1;

          existing.confidence =
            Math.min(
              existing.confidence,
              word.confidence
            );
        } else {
          groups.set(
            normalized,
            {
              normalized,
              displayWord:
                word.text,
              confidence:
                word.confidence,
              occurrences: 1,
            }
          );
        }
      }

      return Array.from(
        groups.values()
      );
    }, [
      words,
      correctionSuggestions,
    ]);

  // --------------------------------------------------
  // REVIEW COUNTS
  // --------------------------------------------------

  const highConfidenceCount =
    useMemo(() => {
      return words.filter(
        (word) =>
          word.confidence >=
          HIGH_CONFIDENCE
      ).length;
    }, [words]);

  const moderateConfidenceCount =
    useMemo(() => {
      return words.filter(
        (word) =>
          word.confidence >=
            MODERATE_CONFIDENCE &&
          word.confidence <
            HIGH_CONFIDENCE
      ).length;
    }, [words]);

  const lowConfidenceCount =
    useMemo(() => {
      return words.filter(
        (word) =>
          word.confidence <
          MODERATE_CONFIDENCE
      ).length;
    }, [words]);

  // --------------------------------------------------
  // ACCEPT CORRECTION
  // --------------------------------------------------

  function handleAcceptCorrection(
    normalizedWord: string,
    displayWord: string,
    suggestion: string
  ) {
    setReviewedText(
      (currentText) => {
        const escapedWord =
          displayWord.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );

        const pattern =
          new RegExp(
            `(^|\\s)${escapedWord}(?=\\s|$|[.,!?;:])`,
            "gi"
          );

        const updatedText =
          currentText.replace(
            pattern,
            (
              _match,
              prefix
            ) => {
              return `${prefix}${suggestion}`;
            }
          );

        setCorrectedText(
          updatedText
        );

        return updatedText;
      }
    );

    setCorrectionDecisions(
      (previous) => ({
        ...previous,
        [normalizedWord]: true,
      })
    );
  }

  // --------------------------------------------------
  // IGNORE CORRECTION
  // --------------------------------------------------

  function handleIgnoreCorrection(
    normalizedWord: string
  ) {
    setCorrectionDecisions(
      (previous) => ({
        ...previous,
        [normalizedWord]: false,
      })
    );
  }

  // --------------------------------------------------
  // SAVE OCR RESULT
  // --------------------------------------------------

  async function handleSaveOCRResult() {
    if (!savedDocument) {
      setError(
        "The original document has not been uploaded."
      );

      return;
    }

    if (
      status !== "complete"
    ) {
      setError(
        "Please finish document processing first."
      );

      return;
    }

    try {
      setSaving(true);

      setError("");
      setSaveMessage("");

      let processingMethod =
        "OCR_IMAGE";

      if (
        documentType === "pdf"
      ) {
        processingMethod =
          "OCR_PDF";
      }

      if (
        documentType === "docx"
      ) {
        processingMethod =
          "TEXT_EXTRACTION";
      }

      const response =
        await fetch(
          "/api/ocr",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              documentId:
                savedDocument.id,

              originalText:
                text,

              correctedText:
                correctedText,

              confidence:
                confidence,

              processingMethod,

              words: words.map(
                (word) => ({
                  text:
                    word.text,

                  confidence:
                    word.confidence,
                })
              ),

              reviewWords: [
                ...groupedCorrectionWords.map(
                  (item) => ({
                    normalized:
                      item.normalized,

                    displayWord:
                      item.displayWord,

                    confidence:
                      item.confidence,

                    occurrences:
                      item.occurrences,

                    suggestion:
                      item.suggestion,

                    isFlagged:
                      item.confidence <
                      MODERATE_CONFIDENCE,

                    decision:
                      correctionDecisions[
                        item.normalized
                      ] === true
                        ? "ACCEPTED"
                        : correctionDecisions[
                              item.normalized
                            ] === false
                          ? "IGNORED"
                          : "PENDING",
                  })
                ),

                ...groupedFlaggedWords.map(
                  (item) => ({
                    normalized:
                      item.normalized,

                    displayWord:
                      item.displayWord,

                    confidence:
                      item.confidence,

                    occurrences:
                      item.occurrences,

                    suggestion:
                      undefined,

                    isFlagged:
                      true,

                    decision:
                      correctionDecisions[
                        item.normalized
                      ] === false
                        ? "IGNORED"
                        : "PENDING",
                  })
                ),
              ],
            }),
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      let data: {
        message?: string;
      };

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        data =
          await response.json();
      } else {
        const responseText =
          await response.text();

        throw new Error(
          `Server returned ${response.status}: ${responseText.slice(
            0,
            300
          )}`
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to save OCR result."
        );
      }

      setSaveMessage(
        "Document, OCR result, and confidence-based review data successfully saved to PostgreSQL."
      );
    } catch (error) {
      console.error(
        "Save OCR error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to save OCR result."
      );
    } finally {
      setSaving(false);
    }
  }

  // --------------------------------------------------
  // DOCUMENT TYPE LABEL
  // --------------------------------------------------

  function getDocumentTypeLabel() {
    if (!documentType) {
      return "";
    }

    if (
      documentType === "image"
    ) {
      return "Image";
    }

    if (
      documentType === "pdf"
    ) {
      return "PDF";
    }

    return "DOCX";
  }

  // --------------------------------------------------
  // CONFIDENCE HELPERS
  // --------------------------------------------------

  function getConfidenceLabel(
    value: number
  ) {
    if (
      value >=
      HIGH_CONFIDENCE
    ) {
      return "High Confidence";
    }

    if (
      value >=
      MODERATE_CONFIDENCE
    ) {
      return "Moderate Confidence";
    }

    return "Needs Review";
  }

  function getConfidenceClass(
    value: number
  ) {
    if (
      value >=
      HIGH_CONFIDENCE
    ) {
      return "bg-green-50 text-green-700";
    }

    if (
      value >=
      MODERATE_CONFIDENCE
    ) {
      return "bg-yellow-50 text-yellow-700";
    }

    return "bg-red-50 text-red-700";
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50">

      {/* SIDEBAR */}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
      />

      {/* MAIN */}

      <main className="min-h-screen lg:ml-64">

        {/* HEADER */}

        <Header
          onMenuClick={() =>
            setSidebarOpen(true)
          }
        />

        {/* CONTENT */}

        <div className="px-4 py-5 sm:px-6 sm:py-6 lg:p-8">

          <div className="mx-auto max-w-7xl">

            {/* HEADER */}

            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">
                Document Input
              </h1>

              <p className="mt-2 text-sm leading-6 text-gray-500">
                Upload a clinic document and process it
                through Klaro&apos;s three-layer workflow:
                Original Copy, Editable Digital Review,
                and Structured Final Copy.
              </p>
            </div>

            {/* PATIENT */}

            <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">

              <h2 className="mb-4 text-base font-semibold text-gray-800 sm:text-lg">
                Patient
              </h2>

              <label className="mb-2 block text-sm font-medium text-gray-700">
                Select Patient
              </label>

              <select
                value={selectedPatientId}
                onChange={(event) =>
                  setSelectedPatientId(
                    event.target.value
                  )
                }
                disabled={loadingPatients}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
              >
                <option value="">
                  {loadingPatients
                    ? "Loading patients..."
                    : "Select a patient"}
                </option>

                {patients.map(
                  (patient) => (
                    <option
                      key={patient.id}
                      value={patient.id}
                    >
                      {patient.studentId}
                      {" - "}
                      {patient.firstName}
                      {" "}
                      {patient.middleName
                        ? `${patient.middleName} `
                        : ""}
                      {patient.lastName}
                    </option>
                  )
                )}
              </select>

              {!loadingPatients &&
                patients.length === 0 && (
                  <p className="mt-2 text-xs text-gray-400">
                    No patients found. Add a patient first.
                  </p>
                )}

            </section>

            {/* DOCUMENT UPLOAD */}

            <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">

              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h2 className="text-base font-semibold text-gray-800 sm:text-lg">
                    Upload Document
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Supported: JPG, JPEG, PNG, WEBP, PDF, DOCX
                  </p>
                </div>

                {documentType && (
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {getDocumentTypeLabel()}
                  </span>
                )}

              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/30 sm:px-6 sm:py-12">

                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-600 sm:h-14 sm:w-14 sm:text-2xl">
                  ↑
                </div>

                <p className="text-sm font-medium text-gray-700">
                  Click to upload a document
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Images, PDF, and DOCX
                </p>

                <input
                  type="file"
                  accept={[
                    "image/jpeg",
                    "image/png",
                    "image/webp",
                    "application/pdf",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                  ].join(",")}
                  onChange={handleFileChange}
                  className="hidden"
                />

              </label>

              {file && (
                <div className="mt-4 rounded-lg bg-gray-50 p-4">

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-700">
                        {file.name}
                      </p>

                      <p className="text-xs text-gray-400">
                        {(file.size / 1024).toFixed(1)}
                        {" KB"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleProcessDocument}
                      disabled={
                        status === "processing" ||
                        !selectedPatientId
                      }
                      className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {status === "processing"
                        ? "Processing..."
                        : documentType === "image" ||
                            documentType === "pdf"
                          ? "Run OCR"
                          : "Process Document"}
                    </button>

                  </div>

                </div>
              )}

            </section>

            {/* ERROR */}

            {error && (
              <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* SUCCESS */}

            {saveMessage && (
              <div className="mb-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                {saveMessage}
              </div>
            )}

            {/* PROCESSING */}

            {status === "processing" && (
              <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">

                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-gray-700">
                    Processing {getDocumentTypeLabel()}
                  </span>

                  <span className="shrink-0 text-sm font-semibold text-blue-600">
                    {progress}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>

                <p className="mt-3 text-xs text-gray-400">
                  Please wait while the document is being processed.
                </p>

              </section>
            )}

            {/* RESULTS */}

            {status === "complete" && (
              <>

                {/* LAYER 1 */}

                <section className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

                  <div className="border-b border-gray-200 bg-gray-50 p-4 sm:p-6">

                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Layer 1
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-gray-800 sm:text-xl">
                      Original Copy
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-gray-500">
                      The original uploaded document is preserved unchanged.
                    </p>

                  </div>

                  <div className="p-4 sm:p-6">

                    {preview ? (
                      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">

                        <Image
                          src={preview}
                          alt="Original uploaded document"
                          width={1000}
                          height={1200}
                          unoptimized
                          className="mx-auto h-auto max-h-[700px] w-full object-contain"
                        />

                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-5 sm:p-6">

                        <p className="text-sm font-medium text-gray-700">
                          Original File Saved
                        </p>

                        {file && (
                          <p className="mt-2 break-all text-sm text-gray-500">
                            {file.name}
                          </p>
                        )}

                      </div>
                    )}

                  </div>

                </section>

                {/* LAYER 2 */}

                <section className="mb-6 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">

                  <div className="border-b border-blue-100 bg-blue-50 p-4 sm:p-6">

                    <p className="text-xs font-bold uppercase tracking-wider text-blue-500">
                      Layer 2
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-gray-800 sm:text-xl">
                      Digital Copy with Review Flags
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      Only words requiring attention are displayed in the review section.
                    </p>

                  </div>

                  <div className="p-4 sm:p-6">

                    {/* DIGITAL COPY */}

                    <div className="mb-6">

                      <h3 className="text-base font-semibold text-gray-800 sm:text-lg">
                        Digital Copy
                      </h3>

                      <textarea
                        value={reviewedText}
                        onChange={(event) =>
                          updateReviewedText(
                            event.target.value
                          )
                        }
                        rows={15}
                        className="mt-3 w-full resize-y rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />

                    </div>

                    {/* OVERALL CONFIDENCE */}

                    {confidence !== null && (
                      <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">

                        <p className="text-sm text-gray-500">
                          OCR Overall Confidence
                        </p>

                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">

                          <p className="text-3xl font-bold text-gray-800">
                            {confidence.toFixed(1)}%
                          </p>

                          <span
                            className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${getConfidenceClass(
                              confidence
                            )}`}
                          >
                            {getConfidenceLabel(
                              confidence
                            )}
                          </span>

                        </div>

                      </div>
                    )}

                    {/* REVIEW SUMMARY */}

                    {words.length > 0 && (
                      <div className="mb-6">

                        <h3 className="mb-3 text-base font-semibold text-gray-800 sm:text-lg">
                          Confidence Review Summary
                        </h3>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                          <div className="rounded-lg border border-green-200 bg-green-50 p-4">

                            <p className="text-xs font-medium uppercase tracking-wide text-green-600">
                              Automatically Trusted
                            </p>

                            <p className="mt-1 text-2xl font-bold text-green-700">
                              {highConfidenceCount}
                            </p>

                            <p className="mt-2 text-xs leading-5 text-green-600">
                              High-confidence words are not shown for review.
                            </p>

                          </div>

                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">

                            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                              Possible Corrections
                            </p>

                            <p className="mt-1 text-2xl font-bold text-blue-700">
                              {groupedCorrectionWords.length}
                            </p>

                            <p className="mt-2 text-xs leading-5 text-blue-600">
                              Moderate or low-confidence words with suggestions.
                            </p>

                          </div>

                          <div className="rounded-lg border border-red-200 bg-red-50 p-4">

                            <p className="text-xs font-medium uppercase tracking-wide text-red-600">
                              Needs Manual Review
                            </p>

                            <p className="mt-1 text-2xl font-bold text-red-700">
                              {groupedFlaggedWords.length}
                            </p>

                            <p className="mt-2 text-xs leading-5 text-red-600">
                              Low-confidence words without suggestions.
                            </p>

                          </div>

                        </div>

                        <p className="mt-3 text-xs leading-5 text-gray-400">
                          OCR words: {words.length}
                          {" · "}
                          Moderate confidence: {moderateConfidenceCount}
                          {" · "}
                          Low confidence: {lowConfidenceCount}
                        </p>

                      </div>
                    )}

                    {/* POSSIBLE CORRECTIONS */}

                    {groupedCorrectionWords.length > 0 && (
                      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">

                        <h3 className="text-sm font-semibold text-blue-800">
                          Possible Corrections
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-blue-600">
                          These words have lower confidence and a possible correction generated by the correction mechanism.
                        </p>

                        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">

                          {groupedCorrectionWords.map(
                            (item) => {

                              const accepted =
                                correctionDecisions[
                                  item.normalized
                                ] === true;

                              const ignored =
                                correctionDecisions[
                                  item.normalized
                                ] === false;

                              return (
                                <div
                                  key={item.normalized}
                                  className="rounded-lg border border-blue-200 bg-white p-4"
                                >

                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                                    <div className="min-w-0">

                                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                        OCR Word
                                      </p>

                                      <p className="mt-1 break-words text-lg font-semibold text-gray-800">
                                        {item.displayWord}
                                      </p>

                                      <p className="mt-1 text-xs text-gray-400">
                                        {item.occurrences} occurrence
                                        {item.occurrences !== 1
                                          ? "s"
                                          : ""}
                                      </p>

                                    </div>

                                    <span className="w-fit shrink-0 rounded-full bg-yellow-50 px-3 py-1 text-sm font-semibold text-yellow-700">
                                      {item.confidence.toFixed(1)}%
                                    </span>

                                  </div>

                                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">

                                    <p className="text-xs font-medium uppercase text-blue-600">
                                      Suggested Correction
                                    </p>

                                    <p className="mt-1 break-words text-base font-semibold text-blue-800">
                                      {item.suggestion}
                                    </p>

                                  </div>

                                  {!accepted &&
                                    !ignored && (
                                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleAcceptCorrection(
                                              item.normalized,
                                              item.displayWord,
                                              item.suggestion
                                            )
                                          }
                                          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
                                        >
                                          Accept Correction
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleIgnoreCorrection(
                                              item.normalized
                                            )
                                          }
                                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
                                        >
                                          Ignore
                                        </button>

                                      </div>
                                    )}

                                  {accepted && (
                                    <div className="mt-4 rounded-lg bg-green-50 p-3">

                                      <p className="text-sm font-medium text-green-700">
                                        ✓ Correction accepted
                                      </p>

                                    </div>
                                  )}

                                  {ignored && (
                                    <div className="mt-4 rounded-lg bg-gray-100 p-3">

                                      <p className="text-sm font-medium text-gray-600">
                                        Correction ignored.
                                      </p>

                                    </div>
                                  )}

                                </div>
                              );
                            }
                          )}

                        </div>

                      </div>
                    )}

                    {/* LOW CONFIDENCE WORDS */}

                    {groupedFlaggedWords.length > 0 && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">

                        <h3 className="text-sm font-semibold text-red-800">
                          Needs Manual Review
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-red-600">
                          These words have low OCR confidence and no reliable automatic correction was found.
                        </p>

                        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">

                          {groupedFlaggedWords.map(
                            (item) => {

                              const ignored =
                                correctionDecisions[
                                  item.normalized
                                ] === false;

                              return (
                                <div
                                  key={item.normalized}
                                  className="rounded-lg border border-red-200 bg-white p-4"
                                >

                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                                    <div className="min-w-0">

                                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                        OCR Word
                                      </p>

                                      <p className="mt-1 break-words text-lg font-semibold text-gray-800">
                                        {item.displayWord}
                                      </p>

                                      <p className="mt-1 text-xs text-gray-400">
                                        {item.occurrences} occurrence
                                        {item.occurrences !== 1
                                          ? "s"
                                          : ""}
                                      </p>

                                    </div>

                                    <span className="w-fit shrink-0 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700">
                                      {item.confidence.toFixed(1)}%
                                    </span>

                                  </div>

                                  {!ignored && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleIgnoreCorrection(
                                          item.normalized
                                        )
                                      }
                                      className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto"
                                    >
                                      Mark as Reviewed
                                    </button>
                                  )}

                                  {ignored && (
                                    <div className="mt-3 rounded-lg bg-gray-100 p-3">

                                      <p className="text-xs font-medium text-gray-600">
                                        ✓ Review completed
                                      </p>

                                    </div>
                                  )}

                                </div>
                              );
                            }
                          )}

                        </div>

                      </div>
                    )}

                    {/* DOCX */}

                    {words.length === 0 &&
                      documentType === "docx" && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">

                          <p className="text-sm font-medium text-gray-700">
                            Text Extraction Complete
                          </p>

                          <p className="mt-2 text-sm leading-6 text-gray-500">
                            DOCX processing extracts digital text directly and does not generate Tesseract OCR confidence data.
                          </p>

                        </div>
                      )}

                  </div>

                </section>

                {/* LAYER 3 */}

                <section className="mb-6 overflow-hidden rounded-xl border border-green-200 bg-white shadow-sm">

                  <div className="border-b border-green-100 bg-green-50 p-4 sm:p-6">

                    <p className="text-xs font-bold uppercase tracking-wider text-green-600">
                      Layer 3
                    </p>

                    <h2 className="mt-1 text-lg font-bold text-gray-800 sm:text-xl">
                      Structured Final Copy
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      The final version based on the reviewed Layer 2 digital copy.
                    </p>

                  </div>

                  <div className="p-4 sm:p-6">

                    <textarea
                      value={correctedText}
                      onChange={(event) =>
                        setCorrectedText(
                          event.target.value
                        )
                      }
                      rows={18}
                      className="w-full resize-y rounded-lg border border-green-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    />

                    <p className="mt-3 text-xs leading-5 text-gray-400">
                      Layer 3 contains the final corrected copy that will be saved to the database.
                    </p>

                  </div>

                </section>

                {/* SAVE */}

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <h2 className="text-base font-semibold text-gray-800 sm:text-lg">
                        Save Document
                      </h2>

                      <p className="mt-1 text-sm leading-6 text-gray-500">
                        Save the original document, OCR result, final corrected copy, and confidence-based review data to the database.
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={handleSaveOCRResult}
                      disabled={
                        saving ||
                        !savedDocument
                      }
                      className="w-full rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                      {saving
                        ? "Saving..."
                        : "Save Result"}
                    </button>

                  </div>

                </section>

              </>
            )}

          </div>

        </div>

      </main>

    </div>
  );
}