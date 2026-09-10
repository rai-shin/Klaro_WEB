
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

type ClinicRecord = {
  id: number;
  visitDate: string;
  chiefComplaint: string | null;
  symptoms: string | null;
  temperature: string | null;
  bloodPressure: string | null;
  diagnosis: string | null;
  treatment: string | null;
  medication: string | null;
  remarks: string | null;
};

type OCRResult = {
  id: number;
  originalText: string;
  correctedText: string;
  confidence: number | null;
  status: string;
  processingMethod: string | null;
  correctedAt: string | null;
  createdAt: string;
};

type Document = {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number | null;
  filePath: string | null;
  documentType: string | null;
  processingMethod: string | null;
  createdAt: string;
  ocrResult: OCRResult | null;
};

type Patient = {
  id: number;
  studentId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string | null;
  age: number | null;
  sex: string | null;
  grade: string | null;
  section: string | null;
  contactNumber: string | null;
  address: string | null;
  clinicRecords: ClinicRecord[];
  documents: Document[];
};

export default function PatientDetailPage() {
  const params = useParams();

  const patientId = params.id;

  const [patient, setPatient] =
    useState<Patient | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [selectedDocument, setSelectedDocument] =
    useState<Document | null>(null);

  useEffect(() => {
    if (!patientId) {
      return;
    }

    async function fetchPatient() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/patients/${patientId}`
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load patient."
          );
        }

        setPatient(data);
      } catch (error) {
        console.error(error);

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load patient."
        );
      } finally {
        setLoading(false);
      }
    }

    fetchPatient();
  }, [patientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() =>
            setSidebarOpen(false)
          }
        />

        <main className="min-h-screen lg:ml-64">

          <Header
            onMenuClick={() =>
              setSidebarOpen(true)
            }
          />

          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:p-8">
            <p className="text-sm text-gray-500">
              Loading patient...
            </p>
          </div>

        </main>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen bg-gray-50">

        <Sidebar
          isOpen={sidebarOpen}
          onClose={() =>
            setSidebarOpen(false)
          }
        />

        <main className="min-h-screen lg:ml-64">

          <Header
            onMenuClick={() =>
              setSidebarOpen(true)
            }
          />

          <div className="px-4 py-5 sm:px-6 sm:py-6 lg:p-8">

            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 sm:p-6">
              {error ||
                "Patient not found."}
            </div>

          </div>

        </main>
      </div>
    );
  }

  const fullName = [
    patient.firstName,
    patient.middleName,
    patient.lastName,
  ]
    .filter(Boolean)
    .join(" ");

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

          <div className="mx-auto max-w-6xl">

            {/* PAGE HEADER */}

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              <div className="min-w-0">

                <h1 className="break-words text-xl font-bold text-gray-800 sm:text-2xl">
                  {fullName}
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  Student ID:{" "}
                  {patient.studentId}
                </p>

              </div>

              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">

                <Link
                  href="/patients/manual"
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
                >
                  + Clinic Record
                </Link>

                <Link
                  href="/ocr"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Document Input
                </Link>

                <Link
                  href="/patients"
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Back
                </Link>

              </div>

            </div>

            {/* PATIENT INFORMATION */}

            <section className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">

              <h2 className="mb-5 text-base font-semibold text-gray-800 sm:text-lg">
                Patient Information
              </h2>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">

                <Info
                  label="Student ID"
                  value={
                    patient.studentId
                  }
                />

                <Info
                  label="Full Name"
                  value={fullName}
                />

                <Info
                  label="Age"
                  value={
                    patient.age !==
                    null
                      ? String(
                          patient.age
                        )
                      : "—"
                  }
                />

                <Info
                  label="Sex"
                  value={
                    patient.sex ||
                    "—"
                  }
                />

                <Info
                  label="Year / Level"
                  value={
                    patient.grade ||
                    "—"
                  }
                />

                <Info
                  label="Section"
                  value={
                    patient.section ||
                    "—"
                  }
                />

                <Info
                  label="Contact Number"
                  value={
                    patient.contactNumber ||
                    "—"
                  }
                />

                <div className="sm:col-span-2 lg:col-span-2">
                  <Info
                    label="Address"
                    value={
                      patient.address ||
                      "—"
                    }
                  />
                </div>

              </div>

            </section>

            {/* CLINIC HISTORY */}

            <section className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

              <div className="border-b border-gray-200 p-4 sm:p-6">

                <h2 className="text-base font-semibold text-gray-800 sm:text-lg">
                  Clinic History
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Previous clinic visits and medical
                  records.
                </p>

              </div>

              {patient.clinicRecords.length ===
              0 ? (
                <div className="p-6 text-center sm:p-10">

                  <p className="text-sm font-medium text-gray-700">
                    No clinic records yet.
                  </p>

                  <p className="mt-1 text-sm text-gray-400">
                    Create a manual clinic record
                    to see it here.
                  </p>

                </div>
              ) : (
                <div className="divide-y divide-gray-100">

                  {patient.clinicRecords.map(
                    (record) => (
                      <div
                        key={record.id}
                        className="p-4 sm:p-6"
                      >

                        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                          <h3 className="font-semibold text-gray-800">
                            Clinic Visit
                          </h3>

                          <p className="text-sm text-gray-500">
                            {new Date(
                              record.visitDate
                            ).toLocaleDateString()}
                          </p>

                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                          <Info
                            label="Chief Complaint"
                            value={
                              record.chiefComplaint ||
                              "—"
                            }
                          />

                          <Info
                            label="Symptoms"
                            value={
                              record.symptoms ||
                              "—"
                            }
                          />

                          <Info
                            label="Temperature"
                            value={
                              record.temperature ||
                              "—"
                            }
                          />

                          <Info
                            label="Blood Pressure"
                            value={
                              record.bloodPressure ||
                              "—"
                            }
                          />

                          <Info
                            label="Diagnosis"
                            value={
                              record.diagnosis ||
                              "—"
                            }
                          />

                          <Info
                            label="Treatment"
                            value={
                              record.treatment ||
                              "—"
                            }
                          />

                          <Info
                            label="Medication"
                            value={
                              record.medication ||
                              "—"
                            }
                          />

                          <Info
                            label="Remarks"
                            value={
                              record.remarks ||
                              "—"
                            }
                          />

                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

            </section>

            {/* DOCUMENTS */}

            <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

              <div className="border-b border-gray-200 p-4 sm:p-6">

                <h2 className="text-base font-semibold text-gray-800 sm:text-lg">
                  Documents & OCR Results
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Original uploaded files and their
                  processing results.
                </p>

              </div>

              {patient.documents.length ===
              0 ? (
                <div className="p-6 text-center sm:p-10">

                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-400">
                    DOC
                  </div>

                  <p className="text-sm font-medium text-gray-700">
                    No documents yet.
                  </p>

                  <p className="mt-1 text-sm text-gray-400">
                    Upload a document for this patient
                    from Document Input.
                  </p>

                  <Link
                    href="/ocr"
                    className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                  >
                    Upload Document
                  </Link>

                </div>
              ) : (
                <div className="divide-y divide-gray-100">

                  {patient.documents.map(
                    (document) => {
                      const ocr =
                        document.ocrResult;

                      return (
                        <div
                          key={document.id}
                          className="p-4 sm:p-6"
                        >

                          {/* DOCUMENT HEADER */}

                          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

                            <div className="min-w-0">

                              <div className="flex items-start gap-3">

                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-xs font-semibold text-blue-600">
                                  DOC
                                </div>

                                <div className="min-w-0">

                                  <h3 className="break-all text-sm font-semibold text-gray-800 sm:text-base">
                                    {
                                      document.fileName
                                    }
                                  </h3>

                                  <p className="mt-1 break-all text-xs text-gray-400">
                                    {
                                      document.fileType
                                    }
                                  </p>

                                </div>

                              </div>

                              {/* BADGES */}

                              <div className="mt-4 flex flex-wrap gap-2">

                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                                  {
                                    document.documentType ||
                                    "General Document"
                                  }
                                </span>

                                {document.processingMethod && (
                                  <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                                    {
                                      document.processingMethod
                                    }
                                  </span>
                                )}

                                {ocr && (
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                                      ocr.status ===
                                      "CORRECTED"
                                        ? "bg-green-50 text-green-700"
                                        : ocr.status ===
                                            "EXTRACTED"
                                          ? "bg-blue-50 text-blue-700"
                                          : "bg-yellow-50 text-yellow-700"
                                    }`}
                                  >
                                    {
                                      ocr.status
                                    }
                                  </span>
                                )}

                              </div>

                            </div>

                            {/* ACTIONS */}

                            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap lg:shrink-0">

                              {document.filePath && (
                                <a
                                  href={
                                    document.filePath
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                                >
                                  Open Original
                                </a>
                              )}

                              {ocr && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedDocument(
                                      document
                                    )
                                  }
                                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
                                >
                                  View OCR
                                </button>
                              )}

                            </div>

                          </div>

                          {/* METADATA */}

                          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                            <Info
                              label="File Size"
                              value={
                                document.fileSize !==
                                null
                                  ? formatFileSize(
                                      document.fileSize
                                    )
                                  : "—"
                              }
                            />

                            <Info
                              label="Uploaded"
                              value={new Date(
                                document.createdAt
                              ).toLocaleString()}
                            />

                            <Info
                              label="OCR Confidence"
                              value={
                                ocr?.confidence !==
                                null &&
                                ocr?.confidence !==
                                  undefined
                                  ? `${ocr.confidence.toFixed(
                                      1
                                    )}%`
                                  : "Not applicable"
                              }
                            />

                            <Info
                              label="Result Status"
                              value={
                                ocr?.status ||
                                "Not processed"
                              }
                            />

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </section>

          </div>

        </div>

      </main>

      {/* OCR MODAL */}

      {selectedDocument && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">

          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-5xl sm:rounded-xl">

            {/* MODAL HEADER */}

            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-gray-200 bg-white p-4 sm:p-6">

              <div className="min-w-0">

                <h2 className="text-base font-semibold text-gray-800 sm:text-lg">
                  Document OCR Result
                </h2>

                <p className="mt-1 truncate text-sm text-gray-500">
                  {
                    selectedDocument.fileName
                  }
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedDocument(
                    null
                  )
                }
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50"
              >
                Close
              </button>

            </div>

            {/* MODAL CONTENT */}

            <div className="space-y-6 p-4 sm:p-6">

              {/* ORIGINAL FILE */}

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                  <div className="min-w-0">

                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                      Original File
                    </p>

                    <p className="mt-1 break-all text-sm font-semibold text-gray-800">
                      {
                        selectedDocument.fileName
                      }
                    </p>

                  </div>

                  {selectedDocument.filePath && (
                    <a
                      href={
                        selectedDocument.filePath
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full rounded-lg bg-gray-800 px-4 py-2.5 text-center text-sm font-medium text-white transition hover:bg-gray-900 sm:w-auto"
                    >
                      Open Original File
                    </a>
                  )}

                </div>

              </div>

              {/* OCR INFORMATION */}

              {selectedDocument.ocrResult ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                    <Info
                      label="Confidence"
                      value={
                        selectedDocument.ocrResult
                          .confidence !==
                        null
                          ? `${selectedDocument.ocrResult.confidence.toFixed(
                              1
                            )}%`
                          : "Not applicable"
                      }
                    />

                    <Info
                      label="Status"
                      value={
                        selectedDocument.ocrResult
                          .status
                      }
                    />

                    <Info
                      label="Processing"
                      value={
                        selectedDocument.ocrResult
                          .processingMethod ||
                        "—"
                      }
                    />

                    <Info
                      label="Saved"
                      value={new Date(
                        selectedDocument.ocrResult.createdAt
                      ).toLocaleString()}
                    />

                  </div>

                  {/* ORIGINAL / CORRECTED */}

                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">

                    <div>

                      <p className="mb-2 text-sm font-medium text-gray-700">
                        Original OCR / Extracted Text
                      </p>

                      <textarea
                        readOnly
                        value={
                          selectedDocument
                            .ocrResult
                            .originalText
                        }
                        rows={16}
                        className="w-full resize-y rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700 outline-none"
                      />

                    </div>

                    <div>

                      <p className="mb-2 text-sm font-medium text-gray-700">
                        Corrected Text
                      </p>

                      <textarea
                        readOnly
                        value={
                          selectedDocument
                            .ocrResult
                            .correctedText
                        }
                        rows={16}
                        className="w-full resize-y rounded-lg border border-blue-200 bg-blue-50/30 px-4 py-3 text-sm leading-6 text-gray-700 outline-none"
                      />

                    </div>

                  </div>

                </>
              ) : (
                <div className="rounded-lg bg-gray-50 p-6 text-center sm:p-8">

                  <p className="text-sm font-medium text-gray-700">
                    This document has not been processed yet.
                  </p>

                </div>
              )}

            </div>

          </div>

        </div>
      )}

    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">

      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm leading-6 text-gray-700">
        {value}
      </p>

    </div>
  );
}

function formatFileSize(
  bytes: number
) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  return `${(
    bytes /
    (1024 * 1024 * 1024)
  ).toFixed(1)} GB`;
}

