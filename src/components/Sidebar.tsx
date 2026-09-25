"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

const menuItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: "⌂",
  },
  {
    name: "Patients",
    href: "/patients",
    icon: "♙",
  },
  {
    name: "Add Patient",
    href: "/patients/add",
    icon: "+",
  },
  {
    name: "Clinic Visit",
    href: "/patients/manual",
    icon: "☷",
  },
  {
    name: "OCR Input",
    href: "/ocr",
    icon: "▣",
  },
];

export default function Sidebar({
  isOpen = false,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();

  function handleClose() {
    if (onClose) {
      onClose();
    }
  }

  return (
    <>
      {/* MOBILE OVERLAY */}

      {isOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={handleClose}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`
          fixed
          left-0
          top-0
          z-50
          flex
          h-screen
          w-64
          flex-col
          border-r
          border-gray-200
          bg-white
          shadow-sm
          transition-transform
          duration-300
          ease-in-out
          dark:border-gray-700
          dark:bg-gray-900

          ${
            isOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }

          lg:translate-x-0
        `}
      >

        {/* LOGO */}

        <div className="flex h-20 shrink-0 items-center justify-between border-b border-gray-200 px-6 dark:border-gray-700">
          <div>
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              Klaro
            </h1>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              School Clinic
            </p>
          </div>

          {/* MOBILE CLOSE BUTTON */}

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 lg:hidden dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            ×
          </button>
        </div>

        {/* NAVIGATION */}

        <nav className="flex-1 overflow-y-auto px-4 py-6">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Main Menu
          </p>

          <div className="space-y-1">
            {menuItems.map((item) => {
              let active = false;

              if (item.href === "/patients") {
                active =
                  pathname === "/patients" ||
                  (
                    pathname.startsWith("/patients/") &&
                    !pathname.startsWith("/patients/add") &&
                    !pathname.startsWith("/patients/manual")
                  );
              } else {
                active = pathname === item.href;
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={handleClose}
                  className={`
                    flex
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    py-3
                    text-sm
                    font-medium
                    transition

                    ${
                      active
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                    }
                  `}
                >
                  <span className="flex h-6 w-6 items-center justify-center text-lg">
                    {item.icon}
                  </span>

                  <span>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* PROTOTYPE NOTICE */}

        <div className="m-4 shrink-0 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            Prototype Version
          </p>

          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
            Authentication and advanced security are not
            implemented yet.
          </p>
        </div>
      </aside>
    </>
  );
}