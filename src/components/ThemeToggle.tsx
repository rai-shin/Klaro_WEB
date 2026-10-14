"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const darkMode =
      document.documentElement.classList.contains("dark");

    setIsDark(darkMode);
  }, []);

  function toggleTheme() {
    const nextTheme = !isDark;

    document.documentElement.classList.toggle(
      "dark",
      nextTheme
    );

    localStorage.setItem(
      "klaro-theme",
      nextTheme ? "dark" : "light"
    );

    setIsDark(nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isDark}
      aria-label={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      title={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      className="
        inline-flex
        items-center
        gap-2
        rounded-lg
        border
        border-gray-200
        bg-white
        px-3
        py-2
        text-sm
        font-medium
        text-gray-700
        shadow-sm
        transition
        hover:bg-gray-50
        dark:border-gray-600
        dark:bg-gray-800
        dark:text-gray-200
        dark:hover:bg-gray-700
      "
    >
      <span className="text-base">
        {isDark ? "☀" : "☾"}
      </span>

      <span className="hidden sm:inline">
        {isDark ? "Light Mode" : "Dark Mode"}
      </span>
    </button>
  );
}