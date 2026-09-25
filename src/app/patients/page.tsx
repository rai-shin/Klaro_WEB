"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import AppLayout from "@/components/AppLayout";

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
  createdAt: string;
  updatedAt: string;
};

const ITEMS_PER_PAGE = 10;

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [currentPage, setCurrentPage] = useState(1);

  // ----------------------------------------
  // FETCH PATIENTS
  // ----------------------------------------

  useEffect(() => {
    fetchPatients();
  }, []);

  async function fetchPatients() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/patients");

      if (!response.ok) {
        throw new Error("Failed to fetch patients.");
      }

      const data = await response.json();

      setPatients(data);
    } catch (error) {
      console.error(error);

      setError("Unable to load patient records.");
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------------------
  // FILTER PATIENTS
  // ----------------------------------------

  const filteredPatients = patients.filter((patient) => {
    const searchValue = search.toLowerCase();

    const fullName =
      `${patient.firstName} ${
        patient.middleName ?? ""
      } ${patient.lastName}`.toLowerCase();

    return (
      fullName.includes(searchValue) ||
      patient.studentId
        .toLowerCase()
        .includes(searchValue) ||
      (patient.grade ?? "")
        .toLowerCase()
        .includes(searchValue) ||
      (patient.section ?? "")
        .toLowerCase()
        .includes(searchValue)
    );
  });

  // ----------------------------------------
  // PAGINATION
  // ----------------------------------------

  const totalPages = Math.ceil(
    filteredPatients.length / ITEMS_PER_PAGE
  );

  const startIndex =
    (currentPage - 1) * ITEMS_PER_PAGE;

  const endIndex =
    startIndex + ITEMS_PER_PAGE;

  const paginatedPatients =
    filteredPatients.slice(
      startIndex,
      endIndex
    );

  // ----------------------------------------
  // SEARCH HANDLER
  // ----------------------------------------

  function handleSearchChange(
    value: string
  ) {
    setSearch(value);
    setCurrentPage(1);
  }

  // ----------------------------------------
  // PAGINATION HANDLERS
  // ----------------------------------------

  function goToPreviousPage() {
    setCurrentPage((page) =>
      Math.max(page - 1, 1)
    );
  }

  function goToNextPage() {
    setCurrentPage((page) =>
      Math.min(page + 1, totalPages)
    );
  }

  // ----------------------------------------
  // KEEP PAGE VALID
  // ----------------------------------------

  useEffect(() => {
    if (
      totalPages > 0 &&
      currentPage > totalPages
    ) {
      setCurrentPage(totalPages);
    }

    if (
      totalPages === 0 &&
      currentPage !== 1
    ) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // ----------------------------------------
  // DISPLAY RANGE
  // ----------------------------------------

  const showingStart =
    filteredPatients.length === 0
      ? 0
      : startIndex + 1;

  const showingEnd =
    Math.min(
      endIndex,
      filteredPatients.length
    );

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}

          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">
                Patient List
              </h1>

              <p className="mt-1 text-sm text-gray-500">
                View and manage school clinic patients.
              </p>
            </div>

            <Link
              href="/patients/add"
              className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-medium text-white transition hover:bg-blue-700 sm:w-auto"
            >
              + Add Patient
            </Link>
          </div>

          {/* SEARCH */}

          <div className="mb-5 rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
            <input
              type="text"
              placeholder="Search by name, Student ID, grade, or section..."
              value={search}
              onChange={(e) =>
                handleSearchChange(e.target.value)
              }
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* ERROR */}

          {error && (
            <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* PATIENT TABLE */}

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            {/* MOBILE SCROLL HINT */}

            <div className="border-b border-gray-100 px-4 py-3 text-xs text-gray-400 md:hidden">
              Swipe left or right to view more details.
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[750px] w-full">

                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                      Student ID
                    </th>

                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                      Name
                    </th>

                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                      Grade
                    </th>

                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                      Section
                    </th>

                    <th className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                      Sex
                    </th>

                    <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-6">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">

                  {/* LOADING */}

                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-sm text-gray-500"
                      >
                        Loading patients...
                      </td>
                    </tr>

                  /* EMPTY */

                  ) : filteredPatients.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center"
                      >
                        <p className="text-sm font-medium text-gray-700">
                          No patients found
                        </p>

                        <p className="mt-1 text-sm text-gray-400">
                          {search
                            ? "Try a different search term."
                            : "Add a patient to begin building the clinic record."}
                        </p>
                      </td>
                    </tr>

                  /* PATIENTS */

                  ) : (
                    paginatedPatients.map(
                      (patient) => (
                        <tr
                          key={patient.id}
                          className="transition hover:bg-gray-50"
                        >
                          <td className="px-4 py-4 text-sm font-medium text-gray-800 sm:px-6">
                            {patient.studentId}
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-700 sm:px-6">
                            {patient.firstName}{" "}

                            {patient.middleName
                              ? `${patient.middleName} `
                              : ""}

                            {patient.lastName}
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-600 sm:px-6">
                            {patient.grade || "—"}
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-600 sm:px-6">
                            {patient.section || "—"}
                          </td>

                          <td className="px-4 py-4 text-sm text-gray-600 sm:px-6">
                            {patient.sex || "—"}
                          </td>

                          <td className="px-4 py-4 text-right sm:px-6">
                            <Link
                              href={`/patients/${patient.id}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* TABLE FOOTER */}

            {!loading && filteredPatients.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-gray-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">

                {/* SHOWING */}

                <p className="text-sm text-gray-500">
                  Showing{" "}
                  <span className="font-medium text-gray-700">
                    {showingStart}
                  </span>
                  {" – "}
                  <span className="font-medium text-gray-700">
                    {showingEnd}
                  </span>
                  {" of "}
                  <span className="font-medium text-gray-700">
                    {filteredPatients.length}
                  </span>
                  {" patients"}
                </p>

                {/* PAGINATION */}

                {totalPages > 1 && (
                  <div className="flex items-center gap-2">

                    <button
                      type="button"
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>

                    <span className="px-2 text-sm text-gray-600">
                      Page{" "}
                      <span className="font-semibold text-gray-800">
                        {currentPage}
                      </span>
                      {" of "}
                      <span className="font-semibold text-gray-800">
                        {totalPages}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={goToNextPage}
                      disabled={
                        currentPage === totalPages
                      }
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>

                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      </div>
    </AppLayout>
  );
}