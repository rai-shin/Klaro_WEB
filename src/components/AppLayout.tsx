
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="min-h-screen min-w-0 transition-[margin] duration-300 lg:ml-[76px]">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
        />

        {children}
      </main>
    </div>
  );
}
