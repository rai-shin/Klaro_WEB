"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
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

  // --------------------------------------------------
  // CAMERA
  // --------------------------------------------------

  const [cameraOpen, setCameraOpen] =
    useState(false);

  const [cameraStarting, setCameraStarting] =
    useState(false);

  const [cameraError, setCameraError] =
    useState("");

  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const cameraStreamRef =
    useRef<MediaStream | null>(null);

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

  const [scanStage, setScanStage] =
    useState("Preparing document...");

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

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewFinished, setReviewFinished] = useState(false);

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

  useEffect(() => {
    if (
      !cameraOpen ||
      cameraStarting ||
      !cameraStreamRef.current ||
      !videoRef.current
    ) {
      return;
    }

    const video = videoRef.current;

    if (
      video.srcObject !==
      cameraStreamRef.current
    ) {
      video.srcObject =
        cameraStreamRef.current;

      video
        .play()
        .catch(() => undefined);
    }
  }, [cameraOpen, cameraStarting]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        cameraStreamRef.current = null;
      }
    };
  }, []);

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

  function applySelectedFile(
    selectedFile: File
  ) {
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
    setReviewOpen(false);
    setReviewFinished(false);

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

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFile =
      event.target.files?.[0];

    if (!selectedFile) {
      return;
    }

    applySelectedFile(selectedFile);

    event.target.value = "";
  }

  // --------------------------------------------------
  // CAMERA
  // --------------------------------------------------

  function stopCamera() {
    if (cameraStreamRef.current) {
      cameraStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      cameraStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  function closeCamera() {
    stopCamera();
    setCameraOpen(false);
    setCameraStarting(false);
    setCameraError("");
  }

  async function openCamera() {
    setCameraError("");
    setCameraOpen(true);
    setCameraStarting(true);

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraStarting(false);
      setCameraError(
        "Camera access is not supported by this browser."
      );

      return;
    }

    try {
      stopCamera();

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
            width: {
              ideal: 1920,
            },
            height: {
              ideal: 1080,
            },
          },
          audio: false,
        });

      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current
          .play()
          .catch(() => undefined);
      }
    } catch (error) {
      console.error(
        "Camera access error:",
        error
      );

      setCameraError(
        "Unable to access the camera. Please allow camera permission and try again."
      );

      stopCamera();
    } finally {
      setCameraStarting(false);
    }
  }

  function captureCameraImage() {
    const video =
      videoRef.current;

    if (
      !video ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setCameraError(
        "The camera is not ready yet. Please wait a moment and try again."
      );

      return;
    }

    const canvas =
      document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context =
      canvas.getContext("2d");

    if (!context) {
      setCameraError(
        "Unable to capture the camera image."
      );

      return;
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError(
            "Unable to create the captured image."
          );

          return;
        }

        const capturedFile =
          new File(
            [blob],
            `camera-capture-${Date.now()}.jpg`,
            {
              type: "image/jpeg",
            }
          );

        applySelectedFile(
          capturedFile
        );

        closeCamera();
      },
      "image/jpeg",
      0.92
    );
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
    throw new Error("No image selected.");
  }

  setScanStage("Preparing image...");
  setProgress(10);

  const formData = new FormData();
  formData.append("file", file);

  setScanStage("Scanning document...");
  setProgress(30);

  const response = await fetch("/api/ocr/paddle", {
    method: "POST",
    body: formData,
  });

  setScanStage("Reading detected text...");
  setProgress(80);

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(
      data.message || "PaddleOCR processing failed."
    );
  }

  if (!Array.isArray(data.results)) {
    throw new Error(
      "PaddleOCR returned an invalid response."
    );
  }

  const paddleResults = data.results as Array<{
    text: string;
    confidence: number;
    status: string;
    flagged: boolean;
  }>;

  const extractedText = paddleResults
    .map((item) => item.text.trim())
    .filter((text) => text.length > 0)
    .join("\n");

  const extractedWords: OCRWord[] = paddleResults
    .filter((item) => item.text.trim().length > 0)
    .flatMap((item) => {
      const lineConfidence = Number(item.confidence);

      return item.text
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 0)
        .map((word) => ({
          text: word,
          confidence: lineConfidence,
        }));
    });

  const averageConfidence =
    extractedWords.length > 0
      ? extractedWords.reduce(
          (total, word) => total + word.confidence,
          0
        ) / extractedWords.length
      : 0;

  setText(extractedText);

  setReviewedText(extractedText);

  setCorrectedText(extractedText);

  setConfidence(
    Number(averageConfidence.toFixed(2))
  );

  setWords(extractedWords);

  setScanStage("Analyzing confidence...");
  setProgress(95);

  // Keep the lightweight scan window visible briefly so the final
  // processing stage is visible before the result view appears.
  await new Promise((resolve) =>
    window.setTimeout(resolve, 180)
  );

  setScanStage("Processing complete");
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
      setScanStage("Preparing document...");

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

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50/30 sm:px-6 sm:py-10">

                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl text-blue-600 sm:h-14 sm:w-14 sm:text-2xl">
                    ↑
                  </div>

                  <p className="text-sm font-medium text-gray-700">
                    Upload a document
                  </p>

                  <p className="mt-1 text-xs text-gray-400">
                    Images, PDF, or DOCX
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

                <button
                  type="button"
                  onClick={openCamera}
                  disabled={status === "processing"}
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-blue-200 bg-blue-50/50 px-4 py-8 text-center transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:py-10"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm sm:h-14 sm:w-14">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-6 w-6 sm:h-7 sm:w-7"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M14 5l-1.5 2H9L7.5 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-5z" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  </div>

                  <p className="text-sm font-medium text-blue-800">
                    Use Camera
                  </p>

                  <p className="mt-1 text-xs text-blue-600/70">
                    Capture an image directly
                  </p>
                </button>
              </div>

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

            {status === "processing" &&
              documentType !== "image" && (
                <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">

                  <div className="mb-3 flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-gray-700">
                      Processing {getDocumentTypeLabel()}
                    </span>

                    <span className="shrink-0 text-sm font-semibold text-blue-600">
                      {progress}%
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
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

                <section className="mb-6 rounded-xl border border-blue-200 bg-white p-4 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-600">OCR Review</p>
                      <h2 className="mt-1 text-lg font-bold text-gray-800">Review your extracted document</h2>
                      <p className="mt-0.5 text-xs leading-5 text-gray-500">Open the original copy and flagged digital copy before finalizing the result.</p>
                    </div>
                    <button type="button" onClick={() => setReviewOpen(true)} className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700">
                      Review OCR
                    </button>
                  </div>
                </section>

                {reviewOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/50 p-2 sm:p-4">
                    <div className="relative flex h-[min(92vh,760px)] max-h-[92vh] w-full max-w-6xl flex-col overflow-visible rounded-2xl bg-white shadow-2xl">
                      <div className="sticky top-0 z-50 flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 shadow-sm sm:px-5">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">OCR Review Window</p>
                          <h2 className="text-lg font-bold text-gray-800">Original Copy & Digital Review</h2>
                        </div>
                        <button type="button" onClick={() => setReviewOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100">Close</button>
                      </div>
                      <div className="relative z-0 min-h-0 flex-1 overflow-y-auto overflow-x-visible p-2 sm:p-3">
                        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">

                {/* LAYER 1 */}

                <section className="mb-2 min-w-0 overflow-visible rounded-lg border border-gray-200 bg-white">

                  <div className="border-b border-gray-200 bg-gray-50 px-3 py-2">

                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      Layer 1
                    </p>

                    <h2 className="mt-0.5 text-sm font-bold text-gray-800 sm:text-base">
                      Original Copy
                    </h2>

                    <p className="mt-0.5 text-xs leading-5 text-gray-500">
                      Original uploaded document, unchanged.
                    </p>

                  </div>

                  <div className="p-3">

                    {preview ? (
                      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50">

                        <Image
                          src={preview}
                          alt="Original uploaded document"
                          width={1000}
                          height={1200}
                          unoptimized
                          className="mx-auto h-auto max-h-[300px] w-full object-contain"
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
                <section className="mb-3 min-w-0 overflow-visible rounded-xl border border-blue-200 bg-white">
                  <div className="border-b border-blue-100 bg-blue-50 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-500">
                          Layer 2
                        </p>
                        <h2 className="mt-0.5 text-sm font-bold text-gray-800 sm:text-base">
                          Interactive Digital Review
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-gray-600">
                          Hover or tap yellow/red words to review them.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs font-medium">
                        <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-yellow-800">
                          Moderate
                        </span>
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">
                          Needs Review
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 p-3">
                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold text-gray-800 sm:text-lg">
                          Digital Copy
                        </h3>
                        <span className="text-xs text-gray-400">
                          {words.length} words
                        </span>
                      </div>

                      <div className="relative z-0 overflow-visible rounded-lg bg-gray-50 p-2 text-sm leading-7 text-gray-700 sm:p-3 sm:text-base">
                        {words.length > 0 ? (
                          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                            {words.map((word, index) => {
                              const normalized = normalizeWord(word.text);
                              const suggestion =
                                correctionSuggestions[normalized];
                              const decision =
                                correctionDecisions[normalized];
                              const isAccepted = decision === true;
                              const isIgnored = decision === false;
                              const isModerate =
                                word.confidence >= MODERATE_CONFIDENCE &&
                                word.confidence < HIGH_CONFIDENCE;
                              const isLow =
                                word.confidence < MODERATE_CONFIDENCE;
                              const needsReview = isModerate || isLow;

                              return (
                                <span
                                  key={`${normalized}-${index}`}
                                  className="group relative inline-flex items-center"
                                >
                                  <button
                                    type="button"
                                    className={`rounded px-1 py-0.5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                                      !needsReview
                                        ? "text-gray-700"
                                        : isLow
                                          ? "bg-red-200 text-red-900 underline decoration-red-500 decoration-2 underline-offset-4 hover:bg-red-300"
                                          : "bg-yellow-200 text-yellow-900 underline decoration-yellow-500 decoration-2 underline-offset-4 hover:bg-yellow-300"
                                    }`}
                                    title={`${word.confidence.toFixed(1)}% confidence`}
                                  >
                                    {word.text}
                                  </button>

                                  {needsReview && (
                                    <div className="invisible fixed bottom-24 left-1/2 z-[10000] mb-2 w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 text-left text-xs shadow-2xl pointer-events-auto group-hover:visible group-focus-within:visible">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <p className="font-semibold text-gray-800">
                                            {word.text}
                                          </p>
                                          <p className="mt-1 text-gray-500">
                                            Confidence: {word.confidence.toFixed(1)}%
                                          </p>
                                        </div>
                                        <span
                                          className={`rounded-full px-2 py-1 font-semibold ${
                                            isLow
                                              ? "bg-red-100 text-red-700"
                                              : "bg-yellow-100 text-yellow-700"
                                          }`}
                                        >
                                          {isLow ? "Low" : "Moderate"}
                                        </span>
                                      </div>

                                      {suggestion ? (
                                        <>
                                          <div className="mt-3 rounded-lg bg-blue-50 p-2">
                                            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                                              Suggested Correction
                                            </p>
                                            <p className="mt-1 font-semibold text-blue-800">
                                              {suggestion}
                                            </p>
                                          </div>

                                          {!isAccepted && !isIgnored ? (
                                            <div className="mt-3 flex gap-2">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleAcceptCorrection(
                                                    normalized,
                                                    word.text,
                                                    suggestion
                                                  )
                                                }
                                                className="rounded-md bg-blue-600 px-2.5 py-1.5 font-medium text-white hover:bg-blue-700"
                                              >
                                                Accept
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleIgnoreCorrection(normalized)
                                                }
                                                className="rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
                                              >
                                                Ignore
                                              </button>
                                            </div>
                                          ) : (
                                            <p className="mt-2 font-medium text-gray-600">
                                              {isAccepted
                                                ? "✓ Correction accepted"
                                                : "Correction ignored"}
                                            </p>
                                          )}
                                        </>
                                      ) : (
                                        <>
                                          <p className="mt-3 text-gray-500">
                                            No automatic correction suggestion was found.
                                          </p>
                                          {!isIgnored && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleIgnoreCorrection(normalized)
                                              }
                                              className="mt-3 rounded-md border border-gray-300 px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
                                            >
                                              Mark as Reviewed
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap text-gray-700">
                            {reviewedText || "No extracted text available."}
                          </p>
                        )}
                      </div>

                      <p className="mt-2 text-xs leading-5 text-gray-400">
                        Yellow = moderate confidence · Red = low confidence.
                      </p>
                    </div>

                    {/* CONFIDENCE SUMMARY */}
                    {confidence !== null && (
                      <div className="rounded-lg bg-gray-50 p-3">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm text-gray-500">
                              OCR Overall Confidence
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <p className="text-3xl font-bold text-gray-800">
                                {confidence.toFixed(1)}%
                              </p>
                              <span
                                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${getConfidenceClass(
                                  confidence
                                )}`}
                              >
                                {getConfidenceLabel(confidence)}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-md bg-green-50 px-2 py-1">
                              <p className="text-lg font-bold text-green-700">
                                {highConfidenceCount}
                              </p>
                              <p className="text-[10px] font-medium uppercase text-green-600">
                                High
                              </p>
                            </div>
                            <div className="rounded-md bg-yellow-50 px-2 py-1">
                              <p className="text-lg font-bold text-yellow-700">
                                {moderateConfidenceCount}
                              </p>
                              <p className="text-[10px] font-medium uppercase text-yellow-600">
                                Moderate
                              </p>
                            </div>
                            <div className="rounded-md bg-red-50 px-2 py-1">
                              <p className="text-lg font-bold text-red-700">
                                {lowConfidenceCount}
                              </p>
                              <p className="text-[10px] font-medium uppercase text-red-600">
                                Low
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {words.length === 0 && documentType === "docx" && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                        <p className="text-sm font-medium text-gray-700">
                          Text Extraction Complete
                        </p>
                        <p className="mt-2 text-sm leading-6 text-gray-500">
                          DOCX processing extracts digital text directly and does not generate OCR confidence data.
                        </p>
                      </div>
                    )}
                  </div>
                </section>

                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-stretch justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:px-5">
                        <p className="text-xs text-gray-500">Review the highlighted words, then continue to Layer 3.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setReviewFinished(true);
                            setReviewOpen(false);
                          }}
                          className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                        >
                          Finish Review →
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* LAYER 3 */}

                {reviewFinished && <section className="mb-6 overflow-hidden rounded-xl border border-green-200 bg-white shadow-sm">

                  <div className="border-b border-green-100 bg-green-50 p-4 sm:p-6">

                    <p className="text-xs font-bold uppercase tracking-wider text-green-600">
                      Layer 3
                    </p>

                    <h2 className="mt-0.5 text-base font-bold text-gray-800 sm:text-lg">
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

                </section>}

                {/* SAVE */}

                <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">

                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                    <div>

                      <h2 className="text-base font-semibold text-gray-800 sm:text-lg">
                        Save Document
                      </h2>

                      <p className="mt-0.5 text-xs leading-5 text-gray-500">
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

      {status === "processing" &&
        documentType === "image" &&
        preview && (
          <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-2 backdrop-blur-[2px] sm:p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2.5 sm:px-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Klaro OCR Scan
                  </p>
                  <h2 className="mt-0.5 text-base font-bold text-gray-800 sm:text-lg">
                    Processing your document
                  </h2>
                </div>

                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  {progress}%
                </span>
              </div>

              <div className="bg-gray-950 p-2 sm:p-3">
                <div className="relative mx-auto overflow-hidden rounded-lg bg-black shadow-inner">
                  <div className="flex max-h-[32vh] items-center justify-center sm:max-h-[36vh]">
                    <Image
                      src={preview}
                      alt="Document being processed"
                      width={1400}
                      height={1200}
                      unoptimized
                      className="max-h-[32vh] w-full object-contain sm:max-h-[36vh]"
                    />
                  </div>

                  <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
                    <div
                      className="klaro-scanline absolute left-0 right-0 h-10 bg-gradient-to-b from-transparent via-blue-400/20 to-transparent"
                      style={{
                        boxShadow:
                          "0 0 20px rgba(96,165,250,0.30)",
                      }}
                    />
                    <div className="pointer-events-none absolute inset-2 sm:inset-3">
                      <div className="absolute left-0 top-0 h-5 w-5 border-l-2 border-t-2 border-blue-400/90" />
                      <div className="absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-blue-400/90" />
                      <div className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-blue-400/90" />
                      <div className="absolute bottom-0 right-0 h-5 w-5 border-b-2 border-r-2 border-blue-400/90" />
                    </div>
                  </div>
                </div>

                <div className="mx-auto mt-3 max-w-md text-center">
                  <p className="text-sm font-semibold text-white">
                    {scanStage}
                  </p>
                  <p className="mt-1 text-[11px] leading-4 text-gray-400">
                    Klaro is reading the image and preparing the OCR results.
                  </p>
                </div>

                <div className="mx-auto mt-3 max-w-md">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{
                        width: `${progress}%`,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                    <span>Image OCR</span>
                    <span>{progress}%</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 bg-white px-4 py-3 text-center sm:px-5">
                <p className="text-xs text-gray-400">
                  Please keep this window open while OCR is processing.
                </p>
              </div>
            </div>
          </div>
        )}

      {cameraOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-3 sm:p-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2.5 sm:px-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                  Camera Input
                </p>

                <h2 className="text-base font-bold text-gray-800 sm:text-lg">
                  Capture Clinic Document
                </h2>
              </div>

              <button
                type="button"
                onClick={closeCamera}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="bg-gray-950 p-3 sm:p-4">
              <div className="overflow-hidden rounded-xl bg-black">
                {cameraStarting ? (
                  <div className="flex min-h-[280px] items-center justify-center px-6 py-16 text-center text-sm text-gray-300 sm:min-h-[420px]">
                    Opening camera...
                  </div>
                ) : cameraError ? (
                  <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-16 text-center sm:min-h-[420px]">
                    <p className="max-w-md text-sm leading-6 text-red-300">
                      {cameraError}
                    </p>

                    <button
                      type="button"
                      onClick={openCamera}
                      className="mt-4 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-100"
                    >
                      Try Camera Again
                    </button>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="aspect-[4/3] h-auto w-full object-cover sm:max-h-[65vh]"
                  />
                )}
              </div>

              <p className="mt-3 text-center text-xs leading-5 text-gray-400">
                Position the clinic document inside the frame, then capture it.
              </p>
            </div>

            <div className="flex flex-col gap-2 border-t border-gray-200 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
              <button
                type="button"
                onClick={closeCamera}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={captureCameraImage}
                disabled={
                  cameraStarting ||
                  Boolean(cameraError) ||
                  !cameraStreamRef.current
                }
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                Capture Image
              </button>
            </div>
          </div>
        </div>
      )}
      <style jsx>{`
        @keyframes klaro-scanline {
          0% {
            transform: translateY(-80%);
            opacity: 0;
          }

          12% {
            opacity: 1;
          }

          88% {
            opacity: 1;
          }

          100% {
            transform: translateY(620%);
            opacity: 0;
          }
        }

        .klaro-scanline {
          animation: klaro-scanline 2.2s ease-in-out infinite;
          will-change: transform, opacity;
        }

        @media (prefers-reduced-motion: reduce) {
          .klaro-scanline {
            animation: none;
            top: 50%;
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}