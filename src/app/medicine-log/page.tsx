
"use client";

import { useState } from "react";
import {
  Plus,
  Search,
  Pill,
  X,
  CalendarDays,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";

type MedicineRecord = {
  id: number;
  name: string;
  dateIn: string;
  expirationDate: string;
  totalIn: number;
  totalOut: number;
};

export default function MedicineLogPage() {
  const [records, setRecords] = useState<MedicineRecord[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    dateIn: "",
    expirationDate: "",
    totalIn: "",
    totalOut: "0",
  });

  const filteredRecords = records.filter((record) =>
    record.name.toLowerCase().includes(search.toLowerCase())
  );

  function handleAddRecord(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const totalIn = Number(formData.totalIn);
    const totalOut = Number(formData.totalOut);

    if (totalOut > totalIn) {
      alert("Total Out cannot be greater than Total In.");
      return;
    }

    const newRecord: MedicineRecord = {
      id: Date.now(),
      name: formData.name.trim(),
      dateIn: formData.dateIn,
      expirationDate: formData.expirationDate,
      totalIn,
      totalOut,
    };

    setRecords((previous) => [...previous, newRecord]);

    setFormData({
      name: "",
      dateIn: "",
      expirationDate: "",
      totalIn: "",
      totalOut: "0",
    });

    setShowForm(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* SIDEBAR */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* MAIN CONTENT */}
      <main className="min-h-screen min-w-0 p-5 transition-[margin] duration-300 sm:p-8 lg:ml-[76px]">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* MOBILE MENU BUTTON */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 shadow-sm transition hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 lg:hidden"
          >
            <span className="text-xl">☰</span>
          </button>

          {/* PAGE HEADER */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Pill size={16} />
                <span>Clinic Management</span>
              </div>

              <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                Medicine Log
              </h1>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Track medicine inventory, expiration dates, and stock movement.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={19} />
              Add Medicine Record
            </button>
          </div>

          {/* TABLE SECTION */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">

            {/* TABLE HEADER */}
            <div className="flex flex-col gap-4 border-b border-gray-200 p-5 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  Medicine Inventory Records
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {records.length} {records.length === 1 ? "record" : "records"} found
                </p>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search medicine..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:ring-blue-900"
                />
              </div>
            </div>

            {/* MEDICINE TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] border-collapse text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/70">
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Name of Medicine
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Date In
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Exp. Date
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Total In
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Total Out
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map((record) => (
                      <tr
                        key={record.id}
                        className="transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {record.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {record.dateIn}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {record.expirationDate}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {record.totalIn}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {record.totalOut}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                          <Pill size={26} />
                        </div>

                        <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-white">
                          {search
                            ? "No matching records found"
                            : "No medicine records yet"}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {search
                            ? "Try searching with a different medicine name."
                            : "Medicine records will appear here once added."}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* ADD MEDICINE MODAL */}
      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900">

            <div className="flex items-center justify-between border-b border-gray-200 p-5 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Add Medicine Record
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Enter the medicine inventory details.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label="Close form"
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddRecord} className="space-y-4 p-5">

              {/* MEDICINE NAME */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Name of Medicine
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter medicine name"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              {/* DATES */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Date In
                  </label>
                  <div className="relative">
                    <CalendarDays
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      required
                      type="date"
                      value={formData.dateIn}
                      onChange={(e) =>
                        setFormData({ ...formData, dateIn: e.target.value })
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Expiration Date
                  </label>
                  <div className="relative">
                    <CalendarDays
                      size={17}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      required
                      type="date"
                      min={formData.dateIn || undefined}
                      value={formData.expirationDate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          expirationDate: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* QUANTITIES */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total In
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={formData.totalIn}
                    onChange={(e) =>
                      setFormData({ ...formData, totalIn: e.target.value })
                    }
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Total Out
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={formData.totalOut}
                    onChange={(e) =>
                      setFormData({ ...formData, totalOut: e.target.value })
                    }
                    placeholder="0"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Plus size={18} />
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
