
import Link from "next/link";

import AppLayout from "@/components/AppLayout";

const stats = [
  {
    title: "Total Patients",
    value: "0",
    description: "Registered patients",
  },
  {
    title: "Clinic Records",
    value: "0",
    description: "Stored clinic records",
  },
  {
    title: "Documents",
    value: "0",
    description: "Uploaded documents",
  },
  {
    title: "OCR Processed",
    value: "0",
    description: "Documents processed",
  },
];

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">

          {/* Welcome */}

          <section className="mb-6 sm:mb-8">
            <h1 className="text-xl font-bold text-gray-800 sm:text-2xl">
              Welcome to Klaro
            </h1>

            <p className="mt-1 text-sm text-gray-500 sm:text-base">
              Manage school clinic patient records and documents
              efficiently.
            </p>
          </section>

          {/* Statistics */}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.title}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6"
              >
                <p className="text-sm font-medium text-gray-500">
                  {stat.title}
                </p>

                <p className="mt-3 text-2xl font-bold text-gray-800 sm:text-3xl">
                  {stat.value}
                </p>

                <p className="mt-2 text-xs text-gray-400">
                  {stat.description}
                </p>
              </div>
            ))}
          </section>

          {/* Quick Actions */}

          <section className="mt-6 sm:mt-8">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              Quick Actions
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">

              {/* Add Patient */}

              <Link
                href="/patients/add"
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md md:p-6 md:hover:-translate-y-1"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-xl text-blue-600">
                  +
                </div>

                <h3 className="font-semibold text-gray-800">
                  Add Patient
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Create a new patient record.
                </p>
              </Link>

              {/* Manual Input */}

              <Link
                href="/patients/manual"
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md md:p-6 md:hover:-translate-y-1"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-50 text-xl text-green-600">
                  ☷
                </div>

                <h3 className="font-semibold text-gray-800">
                  Manual Input
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Enter a clinic record manually.
                </p>
              </Link>

              {/* OCR */}

              <Link
                href="/ocr"
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md md:p-6 md:hover:-translate-y-1"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50 text-xl text-purple-600">
                  ▣
                </div>

                <h3 className="font-semibold text-gray-800">
                  OCR Document
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  Upload a document and extract its text.
                </p>
              </Link>
            </div>
          </section>

          {/* Prototype Information */}

          <section className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5 sm:mt-8 sm:p-6">
            <h2 className="font-semibold text-blue-800">
              Prototype Information
            </h2>

            <p className="mt-2 text-sm leading-6 text-blue-700">
              Klaro is currently a prototype of a school clinic
              document management system. OCR, confidence-based
              error detection, document processing, and PostgreSQL
              storage will be implemented progressively.
            </p>
          </section>

        </div>
      </div>
    </AppLayout>
  );
}

