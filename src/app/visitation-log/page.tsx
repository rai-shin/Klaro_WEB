
"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Menu,
  Plus,
  Search,
  X,
  ClipboardList,
} from "lucide-react";

type Patient = {
  id: number;
  studentId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  grade: string | null;
  section: string | null;
};

type VisitationRecord = {
  id: number;
  patientId: number;
  visitDate: string;
  timeIn: string;
  courseYearBlock: string | null;
  complaint: string | null;
  signature: string | null;
  medicineGiven: string | null;
  quantity: string | null;
  adviserInformed: string;
  guardianInformed: string;
  finalEvaluation: string | null;
  timeOut: string | null;
  nod: string | null;
  patient: Patient;
};

type VisitationForm = {
  patientId: string;
  date: string;
  time: string;
  course: string;
  complaint: string;
  signature: string;
  medicineGiven: string;
  qty: string;
  adviserInformed: string;
  guardianInformed: string;
  finalEvaluation: string;
  timeOut: string;
  nod: string;
};

const emptyForm: VisitationForm = {
  patientId: "",
  date: "",
  time: "",
  course: "",
  complaint: "",
  signature: "",
  medicineGiven: "",
  qty: "",
  adviserInformed: "No",
  guardianInformed: "No",
  finalEvaluation: "",
  timeOut: "",
  nod: "",
};

const fieldClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-900";

function VisitationLogContent() {
  const searchParams = useSearchParams();
  const patientIdFromUrl = searchParams.get("patientId");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [records, setRecords] = useState<VisitationRecord[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const getPatientName = (patient: Patient) =>
    [
      patient.firstName,
      patient.middleName,
      patient.lastName,
    ]
      .filter(Boolean)
      .join(" ");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [patientsResponse, recordsResponse] = await Promise.all([
        fetch("/api/patients", { cache: "no-store" }),
        fetch("/api/visitation-logs", { cache: "no-store" }),
      ]);

      const patientsData = await patientsResponse.json();
      const recordsData = await recordsResponse.json();

      if (!patientsResponse.ok) {
        throw new Error(
          patientsData.message || "Failed to load patients."
        );
      }

      if (!recordsResponse.ok) {
        throw new Error(
          recordsData.message || "Failed to load visitation records."
        );
      }

      setPatients(
        Array.isArray(patientsData)
          ? patientsData
          : patientsData.patients || []
      );

      setRecords(Array.isArray(recordsData) ? recordsData : []);
    } catch (err) {
      console.error("Load visitation data error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load visitation data."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  useEffect(() => {
    if (!patientIdFromUrl || patients.length === 0) return;

    const selectedPatient = patients.find(
      (patient) => patient.id === Number(patientIdFromUrl)
    );

    if (!selectedPatient) return;

    queueMicrotask(() => {
      setForm((previous) => ({
        ...previous,
        patientId: String(selectedPatient.id),
      }));

      setIsModalOpen(true);
    });
  }, [patientIdFromUrl, patients]);

  const filteredRecords = useMemo(() => {
    const search = searchTerm.toLowerCase();

    return records.filter((record) => {
      const patientName = getPatientName(record.patient);

      return [
        patientName,
        record.patient.studentId,
        record.courseYearBlock || "",
        record.complaint || "",
        record.medicineGiven || "",
        record.nod || "",
      ].some((value) =>
        value.toLowerCase().includes(search)
      );
    });
  }, [records, searchTerm]);

  function handleChange(
    field: keyof VisitationForm,
    value: string
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function handlePatientChange(patientId: string) {
    const selectedPatient = patients.find(
      (patient) => patient.id === Number(patientId)
    );

    setForm((previous) => ({
      ...previous,
      patientId,
      course: selectedPatient
        ? [selectedPatient.grade, selectedPatient.section]
            .filter(Boolean)
            .join(" - ")
        : "",
    }));
  }

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!form.patientId) {
      setError("Please select a registered patient.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const response = await fetch("/api/visitation-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patientId: Number(form.patientId),
          visitDate: form.date,
          timeIn: form.time,
          courseYearBlock: form.course,
          complaint: form.complaint,
          signature: form.signature,
          medicineGiven: form.medicineGiven,
          quantity: form.qty,
          adviserInformed: form.adviserInformed,
          guardianInformed: form.guardianInformed,
          finalEvaluation: form.finalEvaluation,
          timeOut: form.timeOut,
          nod: form.nod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to save visitation record."
        );
      }

      setForm(emptyForm);
      setIsModalOpen(false);

      await loadData();
    } catch (err) {
      console.error("Save visitation record error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save visitation record."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function openModal() {
    setError("");

    setForm({
      ...emptyForm,
      patientId: patientIdFromUrl || "",
    });

    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setForm(emptyForm);
    setError("");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="min-h-screen min-w-0 p-5 transition-[margin] duration-300 sm:p-8 lg:ml-[76px]">
        <div className="mx-auto max-w-7xl">
          {/* Page Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open sidebar"
                className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 lg:hidden"
              >
                <Menu size={20} />
              </button>

              <div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 sm:text-2xl">
                  Visitation Log
                </h1>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Manage and monitor student clinic visits.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={openModal}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={18} />
              Add Visitation Record
            </button>
          </div>

          {error && !isModalOpen && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Records */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            {/* Search and Count */}
            <div className="flex flex-col gap-3 border-b border-gray-200 p-4 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-800 dark:text-gray-100">
                  Visitation Records
                </h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {records.length} total record(s)
                </p>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search visitation records..."
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:focus:ring-blue-900"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1600px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-blue-50 text-center font-semibold text-gray-700 dark:bg-blue-950/40 dark:text-gray-200">
                    <th
                      colSpan={6}
                      className="border border-gray-200 px-3 py-3 dark:border-gray-700"
                    >
                      TO BE ACCOMPLISHED BY THE PATIENT/CLIENT
                    </th>
                    <th
                      colSpan={7}
                      className="border border-gray-200 px-3 py-3 dark:border-gray-700"
                    >
                      TO BE ACCOMPLISHED BY NURSE
                    </th>
                  </tr>

                  <tr className="bg-gray-50 text-center font-semibold uppercase text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {[
                      "Date",
                      "Time",
                      "Fullname",
                      "Course / Yr / Bloc / Staff / Faculty",
                      "Complaint",
                      "Signature",
                      "Medicine Given",
                      "Qty",
                      "Adviser Informed",
                      "Guardian Informed",
                      "Final Evaluation",
                      "Time Out",
                      "N.O.D.",
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="border border-gray-200 px-3 py-3 dark:border-gray-700"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-6 py-16 text-center text-gray-500 dark:text-gray-400"
                      >
                        Loading visitation records...
                      </td>
                    </tr>
                  ) : filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="text-gray-700 transition hover:bg-blue-50/50 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <td className="border border-gray-200 px-3 py-3 dark:border-gray-700">
                          {record.visitDate?.slice(0, 10) || ""}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 dark:border-gray-700">
                          {record.timeIn}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 font-medium dark:border-gray-700">
                          {getPatientName(record.patient)}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 dark:border-gray-700">
                          {record.courseYearBlock || ""}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 dark:border-gray-700">
                          {record.complaint || ""}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 dark:border-gray-700">
                          {record.signature || ""}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 dark:border-gray-700">
                          {record.medicineGiven || ""}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 dark:border-gray-700">
                          {record.quantity || ""}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 text-center dark:border-gray-700">
                          {record.adviserInformed}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 text-center dark:border-gray-700">
                          {record.guardianInformed}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 dark:border-gray-700">
                          {record.finalEvaluation || ""}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 dark:border-gray-700">
                          {record.timeOut || ""}
                        </td>
                        <td className="border border-gray-200 px-3 py-3 dark:border-gray-700">
                          {record.nod || ""}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={13} className="px-6 py-16 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                          <ClipboardList size={26} />
                        </div>

                        <h3 className="mt-4 font-semibold text-gray-800 dark:text-gray-100">
                          {searchTerm
                            ? "No matching records found"
                            : "No visitation records yet"}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {searchTerm
                            ? "Try searching with a different keyword."
                            : "Add a visitation record to get started."}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Scroll horizontally to view all 13 columns.
            </div>
          </section>
        </div>
      </main>

      {/* Add Visitation Record Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-700">
              <div>
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  Add Visitation Record
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Enter the patient and nurse visitation details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close modal"
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form
              onSubmit={handleSubmit}
              className="overflow-y-auto p-5"
            >
              {error && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}

              {/* Patient / Client */}
              <div className="mb-6">
                <h3 className="mb-4 border-b border-gray-200 pb-2 text-sm font-semibold text-blue-700 dark:border-gray-700 dark:text-blue-400">
                  Patient / Client Information
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Patient" required>
                    <select
                      required
                      value={form.patientId}
                      onChange={(e) =>
                        handlePatientChange(e.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="">Select a registered patient</option>
                      {patients.map((patient) => (
                        <option
                          key={patient.id}
                          value={patient.id}
                        >
                          {getPatientName(patient)} ({patient.studentId})
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Date" required>
                    <input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) =>
                        handleChange("date", e.target.value)
                      }
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="Time" required>
                    <input
                      type="time"
                      required
                      value={form.time}
                      onChange={(e) =>
                        handleChange("time", e.target.value)
                      }
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="Course / Yr / Bloc / Staff / Faculty">
                    <input
                      type="text"
                      value={form.course}
                      onChange={(e) =>
                        handleChange("course", e.target.value)
                      }
                      placeholder="e.g. BSIT - 2A"
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="Complaint">
                    <textarea
                      value={form.complaint}
                      onChange={(e) =>
                        handleChange("complaint", e.target.value)
                      }
                      placeholder="Enter patient's complaint"
                      rows={2}
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="Signature">
                    <input
                      type="text"
                      value={form.signature}
                      onChange={(e) =>
                        handleChange("signature", e.target.value)
                      }
                      placeholder="Signature / acknowledgment"
                      className={fieldClass}
                    />
                  </FormField>
                </div>
              </div>

              {/* Nurse */}
              <div className="mb-6">
                <h3 className="mb-4 border-b border-gray-200 pb-2 text-sm font-semibold text-blue-700 dark:border-gray-700 dark:text-blue-400">
                  Nurse Information
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="Medicine Given">
                    <input
                      type="text"
                      value={form.medicineGiven}
                      onChange={(e) =>
                        handleChange("medicineGiven", e.target.value)
                      }
                      placeholder="Enter medicine"
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="Quantity">
                    <input
                      type="text"
                      value={form.qty}
                      onChange={(e) =>
                        handleChange("qty", e.target.value)
                      }
                      placeholder="Enter quantity"
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="Adviser Informed">
                    <select
                      value={form.adviserInformed}
                      onChange={(e) =>
                        handleChange("adviserInformed", e.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </FormField>

                  <FormField label="Guardian Informed">
                    <select
                      value={form.guardianInformed}
                      onChange={(e) =>
                        handleChange("guardianInformed", e.target.value)
                      }
                      className={fieldClass}
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                      <option value="N/A">N/A</option>
                    </select>
                  </FormField>

                  <FormField label="Final Evaluation">
                    <textarea
                      value={form.finalEvaluation}
                      onChange={(e) =>
                        handleChange("finalEvaluation", e.target.value)
                      }
                      placeholder="Enter final evaluation"
                      rows={2}
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="Time Out">
                    <input
                      type="time"
                      value={form.timeOut}
                      onChange={(e) =>
                        handleChange("timeOut", e.target.value)
                      }
                      className={fieldClass}
                    />
                  </FormField>

                  <FormField label="N.O.D.">
                    <input
                      type="text"
                      value={form.nod}
                      onChange={(e) =>
                        handleChange("nod", e.target.value)
                      }
                      placeholder="Nurse on duty"
                      className={fieldClass}
                    />
                  </FormField>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSaving || patients.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={16} />
                  {isSaving ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VisitationLogPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-gray-500">
          Loading visitation log...
        </div>
      }
    >
      <VisitationLogContent />
    </Suspense>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
