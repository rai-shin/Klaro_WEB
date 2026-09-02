"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-20 items-center border-b border-gray-200 px-6">
        <div>
          <h1 className="text-2xl font-bold text-blue-600">Klaro</h1>
          <p className="text-xs text-gray-500">School Clinic</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Main Menu
        </p>

        <div className="space-y-1">
          {menuItems.map((item) => {
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                  active
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="flex h-6 w-6 items-center justify-center text-lg">
                  {item.icon}
                </span>

                {item.name}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Prototype notice */}
      <div className="m-4 rounded-lg bg-gray-50 p-4">
        <p className="text-xs font-semibold text-gray-700">
          Prototype Version
        </p>

        <p className="mt-1 text-xs text-gray-500">
          Authentication and advanced security are not implemented yet.
        </p>
      </div>
    </aside>
  );
}