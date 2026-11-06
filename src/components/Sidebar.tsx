
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  FolderOpen,
  ClipboardList,
  Pill,
  FileText,
  LogOut,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

type SidebarProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

const menuItems = [
  {
    name: "Patient List",
    href: "/patients",
    icon: Users,
  },
  {
    name: "Clinic Folder",
    href: "/clinic-folder",
    icon: FolderOpen,
  },
  {
    name: "Visitation Log",
    href: "/visitation-log",
    icon: ClipboardList,
  },
  {
    name: "Medicine Log",
    href: "/medicine-log",
    icon: Pill,
  },
  {
    name: "Report",
    href: "/reports",
    icon: FileText,
  },
];

export default function Sidebar({
  isOpen = false,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  function handleClose() {
    onClose?.();
  }

  async function handleLogout() {
    try {
      const { error } = await authClient.signOut();

      if (error) {
        console.error("Logout failed:", error.message);
        return;
      }

      handleClose();
      router.replace("/auth");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }

  function isActive(href: string) {
    if (href === "/patients") {
      return (
        pathname === "/patients" ||
        (pathname.startsWith("/patients/") &&
          !pathname.startsWith("/patients/add") &&
          !pathname.startsWith("/patients/manual"))
      );
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <>
      {/* MOBILE OVERLAY */}
      {isOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={handleClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
          group
          fixed
          left-0
          top-0
          z-50
          flex
          h-screen
          w-64
          flex-col
          overflow-hidden
          border-r
          border-gray-200
          bg-white
          shadow-lg
          transition-[width,transform,box-shadow]
          duration-300
          ease-[cubic-bezier(0.22,1,0.36,1)]
          dark:border-gray-700
          dark:bg-gray-900
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          lg:w-[76px]
          lg:shadow-sm
          lg:hover:w-64
          lg:hover:shadow-xl
          lg:focus-within:w-64
        `}
      >
        {/* LOGO / DASHBOARD LINK */}
        <div className="flex h-20 shrink-0 items-center border-b border-gray-200 px-4 dark:border-gray-700 lg:justify-center lg:group-hover:justify-start lg:group-hover:px-6">
          {/* COLLAPSED LOGO */}
          <Link
            href="/dashboard"
            onClick={handleClose}
            title="Go to Dashboard"
            aria-label="Klaro Dashboard"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-2xl font-extrabold text-white shadow-md shadow-blue-600/20 transition-all duration-200 hover:scale-105 hover:bg-blue-700 lg:group-hover:hidden"
          >
            K
          </Link>

          {/* EXPANDED LOGO */}
          <Link
            href="/dashboard"
            onClick={handleClose}
            title="Go to Dashboard"
            className="hidden min-w-0 rounded-lg transition-colors hover:opacity-80 lg:group-hover:block lg:group-focus-within:block"
          >
            <h1 className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
              Klaro
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              School Clinic
            </p>
          </Link>

          {/* MOBILE LOGO */}
          <div className="flex min-w-0 flex-1 items-center justify-between lg:hidden">
            <Link href="/dashboard" onClick={handleClose}>
              <h1 className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                Klaro
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                School Clinic
              </p>
            </Link>

            <button
              type="button"
              onClick={handleClose}
              aria-label="Close menu"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-6">
          <p className="mb-4 hidden px-3 text-xs font-semibold uppercase tracking-wider text-gray-400 lg:group-hover:block lg:group-focus-within:block">
            Main Menu
          </p>

          <div className="space-y-2">
            {menuItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.name}
                  onClick={handleClose}
                  aria-current={active ? "page" : undefined}
                  className={`
                    relative
                    flex
                    h-12
                    items-center
                    gap-3
                    rounded-xl
                    px-3
                    transition-all
                    duration-200
                    ease-out
                    lg:justify-center
                    lg:group-hover:justify-start
                    lg:group-focus-within:justify-start
                    lg:group-hover:px-3
                    lg:group-focus-within:px-3
                    ${
                      active
                        ? "bg-blue-50 font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
                        : "text-gray-600 hover:bg-gray-100 hover:text-blue-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                    }
                  `}
                >
                  {/* ACTIVE INDICATOR */}
                  {active && (
                    <span className="absolute left-0 top-2 h-8 w-1 rounded-r-full bg-blue-600" />
                  )}

                  {/* ICON */}
                  <span
                    className={`
                      flex
                      h-7
                      w-7
                      shrink-0
                      items-center
                      justify-center
                      transition-transform
                      duration-200
                      ${active ? "text-blue-600 dark:text-blue-400" : ""}
                    `}
                  >
                    <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                  </span>

                  {/* MENU LABEL */}
                  <span
                    className="
                      whitespace-nowrap
                      text-sm
                      opacity-100
                      transition-all
                      duration-200
                      lg:pointer-events-none
                      lg:absolute
                      lg:left-14
                      lg:translate-x-2
                      lg:opacity-0
                      lg:group-hover:pointer-events-auto
                      lg:group-hover:translate-x-0
                      lg:group-hover:opacity-100
                      lg:group-focus-within:pointer-events-auto
                      lg:group-focus-within:translate-x-0
                      lg:group-focus-within:opacity-100
                    "
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* SIDEBAR FOOTER */}
        <div className="shrink-0 border-t border-gray-200 px-3 py-4 dark:border-gray-700">
          {/* LOGOUT */}
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="
              flex
              h-12
              w-full
              items-center
              gap-3
              rounded-xl
              px-3
              text-sm
              font-medium
              text-red-600
              transition-all
              duration-200
              hover:bg-red-50
              dark:text-red-400
              dark:hover:bg-red-950/40
              lg:justify-center
              lg:group-hover:justify-start
              lg:group-focus-within:justify-start
            "
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
              <LogOut size={21} strokeWidth={1.9} />
            </span>

            <span className="whitespace-nowrap opacity-100 transition-opacity duration-200 lg:pointer-events-none lg:absolute lg:left-14 lg:opacity-0 lg:group-hover:pointer-events-auto lg:group-hover:opacity-100 lg:group-focus-within:pointer-events-auto lg:group-focus-within:opacity-100">
              Logout
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
