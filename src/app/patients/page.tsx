"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";


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

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const filteredPatients = patients.filter((patient) => {
    const searchValue = search.toLowerCase();

    const fullName =
      `${patient.firstName} ${patient.middleName ?? ""} ${patient.lastName}`
        .toLowerCase();

    return (
      fullName.includes(searchValue) ||
      patient.studentId.toLowerCase().includes(searchValue) ||
      (patient.grade ?? "").toLowerCase().includes(searchValue) ||
      (patient.section ?? "").toLowerCase().includes(searchValue)
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className="ml-64">
        <Header />

        <div className="p-8">
          <div className="mx-auto max-w-7xl">
            {/* Header */}

            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  Patient List
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  View and manage school clinic patients.
                </p>
              </div>

              <Link
                href="/patients/add"
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-medium text-white transition hover:bg-blue-700"
              >
                + Add Patient
              </Link>
            </div>

            {/* Search */}

            <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <input
                type="text"
                placeholder="Search by name, Student ID, grade, or section..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {/* Error */}

            {error && (
              <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Table */}

            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-gray-200 bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Student ID
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Name
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Grade
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Section
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Sex
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-12 text-center text-sm text-gray-500"
                        >
                          Loading patients...
                        </td>
                      </tr>
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
                            Add a patient to begin building the
                            clinic record.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredPatients.map((patient) => (
                        <tr
                          key={patient.id}
                          className="transition hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 text-sm font-medium text-gray-800">
                            {patient.studentId}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-700">
                            {patient.firstName}{" "}
                            {patient.middleName
                              ? `${patient.middleName} `
                              : ""}
                            {patient.lastName}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {patient.grade || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {patient.section || "—"}
                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">
                            {patient.sex || "—"}
                          </td>

                          <td className="px-6 py-4 text-right">
                            <Link
                                href={`/patients/${patient.id}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                >
                                View
                                </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}

              {!loading && (
                <div className="border-t border-gray-100 px-6 py-4">
                  <p className="text-sm text-gray-500">
                    Showing{" "}
                    <span className="font-medium text-gray-700">
                      {filteredPatients.length}
                    </span>{" "}
                    of{" "}
                    <span className="font-medium text-gray-700">
                      {patients.length}
                    </span>{" "}
                    patients
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}