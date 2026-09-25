"use client";

import { ReactNode, useState } from "react";

import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({
  children,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
      />

      <main className="min-h-screen lg:ml-64">
        <Header
          onMenuClick={() =>
            setSidebarOpen(true)
          }
        />

        {children}
      </main>
    </div>
  );
}