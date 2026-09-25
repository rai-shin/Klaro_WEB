"use client";

import { usePathname } from "next/navigation";

type HeaderProps = {
  onMenuClick?: () => void;
};

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/patients": "Patient List",
  "/patients/add": "Add Patient",
  "/patients/manual": "Clinic Visit",
  "/ocr": "OCR Input",
};

export default function Header({
  onMenuClick,
}: HeaderProps) {
  const pathname = usePathname();

  const title =
    pageTitles[pathname] || "Klaro";

  return (
    <header className="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8 dark:border-gray-700 dark:bg-gray-900">
      
      {/* LEFT SIDE */}
      <div className="flex min-w-0 items-center gap-3">

        {/* MOBILE MENU BUTTON */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 lg:hidden dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          ☰
        </button>

        {/* PAGE TITLE */}
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-gray-800 dark:text-gray-100 sm:text-xl">
            {"School Clinic Document Management System"}
          </h2>

          {/*<p className="hidden truncate text-sm text-gray-500 dark:text-gray-400 sm:block">
            School Clinic Document Management System
          </p>*/}
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            Clinic Staff
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Prototype Account
          </p>
        </div>

        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600 dark:bg-blue-950 dark:text-blue-300 sm:h-10 sm:w-10">
          CS
        </div>

      </div>
    </header>
  );
}