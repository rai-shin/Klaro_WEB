"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function AddPatientPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    studentId: "",
    firstName: "",
    middleName: "",
    lastName: "",
    dateOfBirth: "",
    age: "",
    sex: "",
    grade: "",
    section: "",
    contactNumber: "",
    address: "",
  });

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
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
      const response = await fetch("/api/patients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to create patient."
        );
      }

      setMessage("Patient successfully added.");

      setTimeout(() => {
        router.push("/patients");
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
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
            {/* Page Title */}

            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">
                Add Patient
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                Create a new school clinic patient record.
              </p>
            </div>

            {/* Form */}

            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm"
            >
              {/* Student Information */}

              <div className="mb-8">
                <h2 className="mb-5 text-lg font-semibold text-gray-800">
                  Student Information
                </h2>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Input
                    label="Student ID"
                    name="studentId"
                    value={form.studentId}
                    onChange={handleChange}
                    required
                    placeholder="e.g. 2026-001"
                  />

                  <Input
                    label="First Name"
                    name="firstName"
                    value={form.firstName}
                    onChange={handleChange}
                    required
                    placeholder="Enter first name"
                  />

                  <Input
                    label="Middle Name"
                    name="middleName"
                    value={form.middleName}
                    onChange={handleChange}
                    placeholder="Enter middle name"
                  />

                  <Input
                    label="Last Name"
                    name="lastName"
                    value={form.lastName}
                    onChange={handleChange}
                    required
                    placeholder="Enter last name"
                  />

                  <Input
                    label="Date of Birth"
                    name="dateOfBirth"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={handleChange}
                  />

                  <Input
                    label="Age"
                    name="age"
                    type="number"
                    value={form.age}
                    onChange={handleChange}
                    min="1"
                    max="100"
                    placeholder="Enter age"
                  />

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Sex
                    </label>

                    <select
                      name="sex"
                      value={form.sex}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select sex</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <Input
                    label="Grade / Year"
                    name="grade"
                    value={form.grade}
                    onChange={handleChange}
                    placeholder="e.g. First Year"
                  />

                  <Input
                    label="Section"
                    name="section"
                    value={form.section}
                    onChange={handleChange}
                    placeholder="e.g. Bloc 1"
                  />

                  <Input
                    label="Contact Number"
                    name="contactNumber"
                    value={form.contactNumber}
                    onChange={handleChange}
                    placeholder="09XXXXXXXXX"
                  />
                </div>
              </div>

              {/* Address */}

              <div className="mb-8">
                <h2 className="mb-5 text-lg font-semibold text-gray-800">
                  Contact Information
                </h2>

                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Address
                </label>

                <textarea
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Enter student's address"
                  className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Success */}

              {message && (
                <div className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>
              )}

              {/* Error */}

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
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Patient"}
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
  type = "text",
  required = false,
  placeholder,
  min,
  max,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="text-red-500"> *</span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}