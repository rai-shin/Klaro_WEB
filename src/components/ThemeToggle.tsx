
"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      const darkMode =
        document.documentElement.classList.contains("dark");

      setIsDark(darkMode);
    });
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
      aria-label={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      aria-pressed={isDark}
      title={
        isDark
          ? "Switch to light mode"
          : "Switch to dark mode"
      }
      className="
        relative
        h-9
        w-16
        shrink-0
        rounded-full
        border
        border-gray-200
        bg-white
        p-1
        shadow-sm
        transition-colors
        duration-200

        dark:border-gray-600
        dark:bg-gray-800
      "
    >
      {/* SLIDING CIRCLE */}

      <span
        className={`
          absolute
          top-1
          flex
          h-7
          w-7
          items-center
          justify-center
          rounded-full
          shadow-sm
          transition-transform
          duration-200
          ease-in-out

          ${
            isDark
              ? "translate-x-7 bg-gray-100 text-gray-800"
              : "translate-x-0 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          }
        `}
      >
        {isDark ? (
          <Moon size={16} strokeWidth={2} />
        ) : (
          <Sun size={16} strokeWidth={2} />
        )}
      </span>
    </button>
  );
}
