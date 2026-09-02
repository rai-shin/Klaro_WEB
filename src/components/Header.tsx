"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/patients": "Patient List",
  "/patients/add": "Add Patient",
  "/patients/manual": "Clinic Visit",
  "/ocr": "OCR Input",
};

export default function Header() {
  const pathname = usePathname();

  const title = pageTitles[pathname] || "Klaro";

  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">{title}</h2>

        <p className="text-sm text-gray-500">
          School Clinic Document Management System
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800">
            Clinic Staff
          </p>

          <p className="text-xs text-gray-500">
            Prototype Account
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-600">
          CS
        </div>
      </div>
    </header>
  );
}