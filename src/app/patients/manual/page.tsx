"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

type Patient = {
  id: number;
  studentId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
};

export default function ManualInputPage() {
  const router = useRouter();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    patientId: "",
    visitDate: "",
    chiefComplaint: "",
    symptoms: "",
    temperature: "",
    bloodPressure: "",
    diagnosis: "",
    treatment: "",
    medication: "",
    remarks: "",
  });

  useEffect(() => {
    fetchPatients();
  }, []);

  async function fetchPatients() {
    try {
      const response = await fetch("/api/patients");

      if (!response.ok) {
        throw new Error("Failed to fetch patients.");
      }

      const data = await response.json();

      setPatients(data);
    } catch (error) {
      console.error(error);
      setError("Unable to load patients.");
    } finally {
      setLoadingPatients(false);
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/clinic-records", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to create clinic record."
        );
      }

      setMessage("Clinic record successfully saved.");

      setTimeout(() => {
        router.push("/patients");
      }, 1000);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className="ml-64">
        <Header />

        <div className="p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">
                Manual Input
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Record a patient's clinic visit manually.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
            >
              {/* Patient and Visit */}

              <div className="mb-8">
                <h2 className="mb-5 text-lg font-semibold text-gray-800">
                  Visit Information
                </h2>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Patient
                      <span className="text-red-500"> *</span>
                    </label>

                    <select
                      name="patientId"
                      value={form.patientId}
                      onChange={handleChange}
                      required
                      disabled={loadingPatients}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                    >
                      <option value="">
                        {loadingPatients
                          ? "Loading patients..."
                          : "Select patient"}
                      </option>

                      {patients.map((patient) => (
                        <option
                          key={patient.id}
                          value={patient.id}
                        >
                          {patient.studentId} -{" "}
                          {patient.firstName}{" "}
                          {patient.middleName
                            ? `${patient.middleName} `
                            : ""}
                          {patient.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Visit Date
                      <span className="text-red-500"> *</span>
                    </label>

                    <input
                      type="date"
                      name="visitDate"
                      value={form.visitDate}
                      onChange={handleChange}
                      required
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>

              {/* Complaint */}

              <div className="mb-8">
                <h2 className="mb-5 text-lg font-semibold text-gray-800">
                  Clinical Information
                </h2>

                <div className="space-y-5">
                  <TextArea
                    label="Chief Complaint"
                    name="chiefComplaint"
                    value={form.chiefComplaint}
                    onChange={handleChange}
                    placeholder="What is the patient's main complaint?"
                  />

                  <TextArea
                    label="Symptoms"
                    name="symptoms"
                    value={form.symptoms}
                    onChange={handleChange}
                    placeholder="Describe the patient's symptoms."
                  />

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Input
                      label="Temperature"
                      name="temperature"
                      value={form.temperature}
                      onChange={handleChange}
                      placeholder="e.g. 37.2 °C"
                    />

                    <Input
                      label="Blood Pressure"
                      name="bloodPressure"
                      value={form.bloodPressure}
                      onChange={handleChange}
                      placeholder="e.g. 120/80 mmHg"
                    />
                  </div>

                  <TextArea
                    label="Diagnosis"
                    name="diagnosis"
                    value={form.diagnosis}
                    onChange={handleChange}
                    placeholder="Enter diagnosis or assessment."
                  />

                  <TextArea
                    label="Treatment"
                    name="treatment"
                    value={form.treatment}
                    onChange={handleChange}
                    placeholder="Enter treatment provided."
                  />

                  <TextArea
                    label="Medication"
                    name="medication"
                    value={form.medication}
                    onChange={handleChange}
                    placeholder="Enter medication, if any."
                  />

                  <TextArea
                    label="Remarks"
                    name="remarks"
                    value={form.remarks}
                    onChange={handleChange}
                    placeholder="Additional notes or observations."
                  />
                </div>
              </div>

              {/* Messages */}

              {message && (
                <div className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>
              )}

              {error && (
                <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Buttons */}

              <div className="flex justify-end gap-3 border-t border-gray-100 pt-6">
                <button
                  type="button"
                  onClick={() => router.push("/patients")}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading || patients.length === 0}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Clinic Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

function Input({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}

function TextArea({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={3}
        placeholder={placeholder}
        className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}