"use client";

import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "lumi.theme";

/**
 * Runs before paint (inline in <head>) so a saved choice never flashes the other theme.
 * Without a saved choice, the OS preference decides (globals.css).
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

type Theme = "dark" | "light";

function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "dark" || chosen === "light") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Night ↔ dawn. Remembers the choice on this device. */
export function ThemeToggle({ toDawn, toNight }: { toDawn: string; toNight: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => setTheme(currentTheme()), []);

  const toggle = () => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage disabled: the choice lasts for this page view only.
    }
    setTheme(next);
  };

  const label = theme === "dark" ? toDawn : toNight;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme ? label : toDawn}
      title={theme ? label : undefined}
      className="flex size-11 items-center justify-center rounded-pill border border-line text-muted transition-colors duration-200 hover:border-glow hover:text-text"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      >
        {theme === "light" ? (
          // A crescent: "switch to night".
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
        ) : (
          // A small sun: "switch to dawn".
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
          </>
        )}
      </svg>
    </button>
  );
}
