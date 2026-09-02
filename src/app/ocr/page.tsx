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

import { suggestCorrection } from "@/lib/correction";

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

export default function OCRPage() {
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
  // OCR / TEXT
  // --------------------------------------------------

  const [text, setText] = useState("");

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

  /*
   * true  = accepted
   * false = ignored
   * undefined = not decided
   */
  const [
    correctionDecisions,
    setCorrectionDecisions,
  ] = useState<CorrectionState>({});

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

        if (!contentType.includes("application/json")) {
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

        /*
         * Your API may return an array directly
         * or { patients: [...] }.
         */
        const patientList = Array.isArray(data)
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
    setCorrectedText("");
    setConfidence(null);
    setWords([]);

    setProgress(0);
    setStatus("idle");

    setError("");
    setSaveMessage("");
    setSavedDocument(null);

    setCorrectionDecisions({});

    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }

    /*
     * Only images have an image preview here.
     */
    if (detectedType === "image") {
      const newPreview =
        URL.createObjectURL(
          selectedFile
        );

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
      data = await response.json();
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

    setCorrectedText(
      result.text
    );

    setConfidence(
      result.confidence
    );

    setWords(result.words);

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

    setCorrectedText(
      extractedText
    );

    /*
     * DOCX text extraction does not use Tesseract.
     */
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

    /*
     * Required PDF.js worker.
     *
     * File:
     * public/pdf.worker.min.mjs
     */
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

    const pageTexts: string[] = [];

    const pageConfidences: number[] = [];

    const allWords: OCRWord[] = [];

    for (
      let pageNumber = 1;
      pageNumber <=
        pdf.numPages;
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

      /*
       * pdfjs-dist requires canvas
       * and canvasContext.
       */
      await page.render({
        canvas,
        canvasContext:
          context,
        viewport,
      }).promise;

      /*
       * Convert rendered PDF page
       * to PNG.
       */
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

      /*
       * Our OCR utility currently expects File.
       */
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

    /*
     * Average confidence across
     * all pages.
     */
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
      pageTexts.join(
        "\n\n"
      );

    setText(
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
      setCorrectedText("");
      setConfidence(null);
      setWords([]);

      setCorrectionDecisions({});

      /*
       * Save original file first.
       */
      const document =
        await uploadOriginalFile();

      setSavedDocument(
        document
      );

      /*
       * Process selected file.
       */
      if (
        documentType ===
        "image"
      ) {
        await processImage();
      } else if (
        documentType ===
        "pdf"
      ) {
        await processPdf();
      } else if (
        documentType ===
        "docx"
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
        const normalized =
          normalizeWord(
            word.text
          );

        if (!normalized) {
          continue;
        }

        const suggestion =
          suggestCorrection(
            word.text,
            word.confidence
          );

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
    }, [words]);

  // --------------------------------------------------
  // GROUP LOW-CONFIDENCE WORDS
  // WITHOUT A CORRECTION
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
          word.confidence >= 70
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

        /*
         * If it has a correction,
         * it is displayed in the
         * correction section.
         */
        const suggestion =
          suggestCorrection(
            word.text,
            word.confidence
          );

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
    }, [words]);

  // --------------------------------------------------
  // ACCEPT CORRECTION
  // --------------------------------------------------

  function handleAcceptCorrection(
    normalizedWord: string,
    displayWord: string,
    suggestion: string
  ) {
    setCorrectedText(
      (currentText) => {
        const escapedWord =
          displayWord.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );

        /*
         * g = replace ALL occurrences
         */
        const pattern =
          new RegExp(
            `\\b${escapedWord}\\b`,
            "gi"
          );

        return currentText.replace(
          pattern,
          suggestion
        );
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

    if (status !== "complete") {
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
        documentType ===
        "pdf"
      ) {
        processingMethod =
          "OCR_PDF";
      }

      if (
        documentType ===
        "docx"
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
        "Document and processing result successfully saved to PostgreSQL."
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
      documentType ===
      "image"
    ) {
      return "Image";
    }

    if (
      documentType ===
      "pdf"
    ) {
      return "PDF";
    }

    return "DOCX";
  }

  // --------------------------------------------------
  // OVERALL CONFIDENCE HELPERS
  // --------------------------------------------------

  function getConfidenceLabel(
    value: number
  ) {
    if (value >= 90) {
      return "High Confidence";
    }

    if (value >= 70) {
      return "Moderate Confidence";
    }

    return "Needs Review";
  }

  function getConfidenceClass(
    value: number
  ) {
    if (value >= 90) {
      return "bg-green-50 text-green-700";
    }

    if (value >= 70) {
      return "bg-yellow-50 text-yellow-700";
    }

    return "bg-red-50 text-red-700";
  }

  // --------------------------------------------------
  // WORD CONFIDENCE HELPERS
  // --------------------------------------------------

  function getWordStatusLabel(
    value: number
  ) {
    if (value >= 90) {
      return "High";
    }

    if (value >= 70) {
      return "Moderate";
    }

    return "Needs Review";
  }

  function getWordStatusClass(
    value: number
  ) {
    if (value >= 90) {
      return "border-green-200 bg-green-50 text-green-700";
    }

    if (value >= 70) {
      return "border-yellow-200 bg-yellow-50 text-yellow-700";
    }

    return "border-red-200 bg-red-50 text-red-700";
  }

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className="ml-64">
        <Header />

        <div className="p-8">
          <div className="mx-auto max-w-7xl">

            {/* HEADER */}

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">
                Document Input
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Upload a clinic document, process its
                contents, review confidence, correct
                possible errors, and save the result.
              </p>
            </div>

            {/* PATIENT */}

            <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-gray-800">
                Patient
              </h2>

              <label className="mb-2 block text-sm font-medium text-gray-700">
                Select Patient
              </label>

              <select
                value={
                  selectedPatientId
                }
                onChange={(event) =>
                  setSelectedPatientId(
                    event.target.value
                  )
                }
                disabled={
                  loadingPatients
                }
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
                      key={
                        patient.id
                      }
                      value={
                        patient.id
                      }
                    >
                      {
                        patient.studentId
                      }{" "}
                      -{" "}
                      {
                        patient.firstName
                      }{" "}
                      {patient.middleName
                        ? `${patient.middleName} `
                        : ""}
                      {
                        patient.lastName
                      }
                    </option>
                  )
                )}
              </select>

              {!loadingPatients &&
                patients.length === 0 && (
                  <p className="mt-2 text-xs text-gray-400">
                    No patients found. Add a patient
                    first.
                  </p>
                )}
            </section>

            {/* DOCUMENT UPLOAD */}

            <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Upload Document
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Supported: JPG, JPEG, PNG,
                    WEBP, PDF, DOCX
                  </p>
                </div>

                {documentType && (
                  <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {
                      getDocumentTypeLabel()
                    }
                  </span>
                )}

              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-6 py-12 transition hover:border-blue-400 hover:bg-blue-50/30">

                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl text-blue-600">
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
                  onChange={
                    handleFileChange
                  }
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
                        {(
                          file.size /
                          1024
                        ).toFixed(
                          1
                        )}{" "}
                        KB
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={
                        handleProcessDocument
                      }
                      disabled={
                        status ===
                          "processing" ||
                        !selectedPatientId
                      }
                      className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {status ===
                      "processing"
                        ? "Processing..."
                        : documentType ===
                            "image" ||
                          documentType ===
                            "pdf"
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

            {status ===
              "processing" && (
              <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

                <div className="mb-3 flex justify-between">

                  <span className="text-sm font-medium text-gray-700">
                    Processing{" "}
                    {
                      getDocumentTypeLabel()
                    }
                  </span>

                  <span className="text-sm font-semibold text-blue-600">
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
                  Please wait while the document is
                  being processed.
                </p>

              </section>
            )}

            {/* RESULTS */}

            {status ===
              "complete" && (
              <>

                {/* IMAGE PREVIEW */}

                {preview && (
                  <section className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

                    <h2 className="mb-4 text-lg font-semibold text-gray-800">
                      Original File Preview
                    </h2>

                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">

                      <Image
                        src={
                          preview
                        }
                        alt="Original uploaded document"
                        width={1000}
                        height={1200}
                        unoptimized
                        className="mx-auto h-auto max-h-[600px] w-full object-contain"
                      />

                    </div>

                  </section>
                )}

                {/* ORIGINAL / CORRECTED TEXT */}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                  <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

                    <h2 className="mb-3 text-lg font-semibold text-gray-800">
                      Original Extracted Text
                    </h2>

                    <textarea
                      value={
                        text
                      }
                      readOnly
                      rows={15}
                      className="w-full resize-none rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700 outline-none"
                    />

                  </section>

                  <section className="rounded-xl border border-blue-200 bg-white p-6 shadow-sm">

                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                      <h2 className="text-lg font-semibold text-gray-800">
                        Corrected Text
                      </h2>

                      <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        Editable
                      </span>

                    </div>

                    <textarea
                      value={
                        correctedText
                      }
                      onChange={(
                        event
                      ) =>
                        setCorrectedText(
                          event.target.value
                        )
                      }
                      rows={15}
                      className="w-full resize-none rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm leading-6 text-gray-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    <p className="mt-2 text-xs text-gray-400">
                      Accepted corrections are reflected
                      here. You can also manually edit the
                      corrected result.
                    </p>

                  </section>

                </div>

                {/* CONFIDENCE */}

                {confidence !==
                  null && (
                  <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                      <div>

                        <p className="text-sm text-gray-500">
                          Overall Confidence
                        </p>

                        <p className="mt-1 text-3xl font-bold text-gray-800">
                          {
                            confidence.toFixed(
                              1
                            )
                          }
                          %
                        </p>

                      </div>

                      <span
                        className={`w-fit rounded-full px-4 py-2 text-sm font-semibold ${getConfidenceClass(
                          confidence
                        )}`}
                      >
                        {
                          getConfidenceLabel(
                            confidence
                          )
                        }
                      </span>

                    </div>

                  </section>
                )}

                {/* OCR WORD ANALYSIS */}

                {words.length >
                  0 && (
                  <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

                    {/* SUMMARY */}

                    <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                          Recognized Words
                        </p>

                        <p className="mt-1 text-2xl font-bold text-gray-800">
                          {
                            words.length
                          }
                        </p>
                      </div>

                      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-red-600">
                          Needs Review
                        </p>

                        <p className="mt-1 text-2xl font-bold text-red-700">
                          {
                            groupedFlaggedWords.length
                          }
                        </p>
                      </div>

                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                          Possible Corrections
                        </p>

                        <p className="mt-1 text-2xl font-bold text-blue-700">
                          {
                            groupedCorrectionWords.length
                          }
                        </p>
                      </div>

                    </div>

                    {/* POSSIBLE CORRECTIONS */}

                    {groupedCorrectionWords.length >
                      0 && (
                      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">

                        <h3 className="text-sm font-semibold text-blue-800">
                          Possible Corrections
                        </h3>

                        <p className="mt-1 text-xs text-blue-600">
                          Duplicate words are grouped
                          together. Accepting a correction
                          changes all matching occurrences.
                        </p>

                        <div className="mt-4 space-y-3">

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
                                  key={
                                    item.normalized
                                  }
                                  className="rounded-lg border border-blue-200 bg-white p-4"
                                >

                                  {/* HEADER */}

                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                                    <div>

                                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                        OCR Word
                                      </p>

                                      <p className="mt-1 text-lg font-semibold text-gray-800">
                                        {
                                          item.displayWord
                                        }
                                      </p>

                                      <p className="mt-1 text-xs text-gray-400">
                                        {
                                          item.occurrences
                                        }{" "}
                                        occurrence
                                        {
                                          item.occurrences !==
                                          1
                                            ? "s"
                                            : ""
                                        }
                                      </p>

                                    </div>

                                    <div className="flex items-center gap-3">

                                      <span className="text-sm font-semibold text-gray-600">
                                        {item.confidence.toFixed(
                                          1
                                        )}
                                        %
                                      </span>

                                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                        Possible Correction
                                      </span>

                                    </div>

                                  </div>

                                  {/* SUGGESTION */}

                                  <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">

                                    <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                                      Suggested Correction
                                    </p>

                                    <p className="mt-1 text-base font-semibold text-blue-800">
                                      {
                                        item.suggestion
                                      }
                                    </p>

                                  </div>

                                  {/* BUTTONS */}

                                  {!accepted &&
                                    !ignored && (
                                      <div className="mt-4 flex flex-wrap gap-2">

                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleAcceptCorrection(
                                              item.normalized,
                                              item.displayWord,
                                              item.suggestion
                                            )
                                          }
                                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
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
                                          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                        >
                                          Ignore
                                        </button>

                                      </div>
                                    )}

                                  {/* ACCEPTED */}

                                  {accepted && (
                                    <div className="mt-4 rounded-lg bg-green-50 p-3">

                                      <p className="text-sm font-medium text-green-700">
                                        ✓ Correction accepted
                                      </p>

                                      <p className="mt-1 text-xs text-green-600">
                                        All{" "}
                                        {
                                          item.occurrences
                                        }{" "}
                                        occurrences changed:
                                        {" "}
                                        {
                                          item.displayWord
                                        }{" "}
                                        →{" "}
                                        {
                                          item.suggestion
                                        }
                                      </p>

                                    </div>
                                  )}

                                  {/* IGNORED */}

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

                    {/* LOW CONFIDENCE WITHOUT SUGGESTION */}

                    {groupedFlaggedWords.length >
                      0 && (
                      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">

                        <h3 className="text-sm font-semibold text-red-800">
                          Low-Confidence Words
                        </h3>

                        <p className="mt-1 text-xs text-red-600">
                          These words have less than 70%
                          OCR confidence and do not have
                          a reliable correction suggestion.
                        </p>

                        <div className="mt-4 space-y-2">

                          {groupedFlaggedWords.map(
                            (item) => {

                              const ignored =
                                correctionDecisions[
                                  item.normalized
                                ] === false;

                              return (
                                <div
                                  key={
                                    item.normalized
                                  }
                                  className="rounded-lg border border-red-200 bg-white p-4"
                                >

                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                                    <div>

                                      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                        OCR Word
                                      </p>

                                      <p className="mt-1 text-lg font-semibold text-gray-800">
                                        {
                                          item.displayWord
                                        }
                                      </p>

                                      <p className="mt-1 text-xs text-gray-400">
                                        {
                                          item.occurrences
                                        }{" "}
                                        occurrence
                                        {
                                          item.occurrences !==
                                          1
                                            ? "s"
                                            : ""
                                        }
                                      </p>

                                    </div>

                                    <div className="flex items-center gap-3">

                                      <span className="text-sm font-semibold text-red-600">
                                        {item.confidence.toFixed(
                                          1
                                        )}
                                        %
                                      </span>

                                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                                        Needs Review
                                      </span>

                                    </div>

                                  </div>

                                  <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">

                                    <p className="text-sm font-medium text-gray-600">
                                      No reliable correction
                                      suggestion available.
                                    </p>

                                    <p className="mt-1 text-xs text-gray-400">
                                      This word should be
                                      reviewed manually.
                                    </p>

                                  </div>

                                  {!ignored && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleIgnoreCorrection(
                                          item.normalized
                                        )
                                      }
                                      className="mt-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      Ignore
                                    </button>
                                  )}

                                  {ignored && (
                                    <div className="mt-3 rounded-lg bg-gray-100 p-3">

                                      <p className="text-xs font-medium text-gray-600">
                                        Review ignored.
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

                    {/* WORD CONFIDENCE */}

                    <div>

                      <h3 className="mb-3 text-sm font-semibold text-gray-800">
                        Word Confidence
                      </h3>

                      <div className="max-h-96 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3">

                        {words.map(
                          (word, index) => (
                            <div
                              key={`${word.text}-${index}`}
                              className={`flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${getWordStatusClass(
                                word.confidence
                              )}`}
                            >

                              <span className="break-words font-medium">
                                {
                                  word.text
                                }
                              </span>

                              <div className="flex shrink-0 items-center gap-3">

                                <span className="text-xs font-semibold">
                                  {word.confidence.toFixed(
                                    1
                                  )}
                                  %
                                </span>

                                <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-semibold">
                                  {
                                    getWordStatusLabel(
                                      word.confidence
                                    )
                                  }
                                </span>

                              </div>

                            </div>
                          )
                        )}

                      </div>
                    </div>

                  </section>
                )}

                {/* SAVE */}

                <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <h2 className="text-lg font-semibold text-gray-800">
                        Save Document
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        The original file and processing
                        result will be stored.
                      </p>

                    </div>

                    <button
                      type="button"
                      onClick={
                        handleSaveOCRResult
                      }
                      disabled={
                        saving ||
                        !savedDocument
                      }
                      className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
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