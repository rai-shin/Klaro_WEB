"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function AddPatientPage() {
  const router = useRouter();

  // ----------------------------------------
  // MOBILE SIDEBAR
  // ----------------------------------------

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  // ----------------------------------------
  // FORM STATES
  // ----------------------------------------

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

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

  // ----------------------------------------
  // HANDLE INPUT CHANGE
  // ----------------------------------------

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement |
        HTMLSelectElement |
        HTMLTextAreaElement
    >
  ) {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  // ----------------------------------------
  // SUBMIT
  // ----------------------------------------

  async function handleSubmit(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/patients",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(form),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to create patient."
        );
      }

      setMessage(
        "Patient successfully added."
      );

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

  // ----------------------------------------
  // PAGE
  // ----------------------------------------

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

          <div className="mx-auto max-w-5xl">

            {/* PAGE TITLE */}

            <div className="mb-6">

              <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">
                Add Patient
              </h1>

              <p className="mt-1 text-sm leading-6 text-gray-500">
                Create a new school clinic
                patient record.
              </p>

            </div>

            {/* FORM */}

            <form
              onSubmit={handleSubmit}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8"
            >

              {/* STUDENT INFORMATION */}

              <div className="mb-8">

                <h2 className="mb-5 text-base font-semibold text-gray-800 sm:text-lg">
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

                  {/* SEX */}

                  <div>

                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Sex
                    </label>

                    <select
                      name="sex"
                      value={form.sex}
                      onChange={handleChange}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">
                        Select sex
                      </option>

                      <option value="Male">
                        Male
                      </option>

                      <option value="Female">
                        Female
                      </option>

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
                    placeholder="e.g. Block 1"
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

              {/* CONTACT INFORMATION */}

              <div className="mb-8">

                <h2 className="mb-5 text-base font-semibold text-gray-800 sm:text-lg">
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
                  className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

              </div>

              {/* SUCCESS */}

              {message && (

                <div className="mb-5 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>

              )}

              {/* ERROR */}

              {error && (

                <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>

              )}

              {/* BUTTONS */}

              <div className="flex flex-col gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={() =>
                    router.push("/patients")
                  }
                  className="w-full rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {loading
                    ? "Saving..."
                    : "Save Patient"}
                </button>

              </div>

            </form>

          </div>

        </div>

      </main>

    </div>
  );
}


// ----------------------------------------
// INPUT COMPONENT
// ----------------------------------------

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
          <span className="text-red-500">
            {" *"}
          </span>
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
        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />

    </div>
  );
}