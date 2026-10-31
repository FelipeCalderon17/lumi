"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import type { NavItem } from "./nav-items";

function isCurrent(pathname: string, href: string): boolean {
  const depth = href.split("/").length;
  // Home matches only itself; sections match their sub-pages too (guides/[id]).
  return depth <= 2 ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop navigation: the current page gets a small amber "firefly" under it. */
export function DesktopNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const current = isCurrent(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`relative flex min-h-11 items-center rounded-pill px-3 text-[0.98rem] transition-colors duration-200 ${
                  current ? "text-text" : "text-muted hover:text-text"
                }`}
              >
                {item.label}
                {current && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-pill bg-lantern shadow-[0_0_10px_2px_rgb(246_190_79/0.7)]"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Mobile navigation: a <details> disclosure, so it opens even before (or without) JavaScript.
 * Closes itself on navigation and on Escape.
 */
export function MobileNav({
  items,
  label,
  menu,
  closeMenu,
}: {
  items: NavItem[];
  label: string;
  menu: string;
  closeMenu: string;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close whenever the route changes.
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <details ref={ref} className="group lg:hidden">
      <summary
        aria-label={menu}
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-pill border border-line px-4 text-[0.98rem] hover:border-glow [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className="flex flex-col gap-[5px]">
          <span className="block h-[2px] w-4 rounded-pill bg-current transition-transform duration-200 group-open:translate-y-[3.5px] group-open:rotate-45" />
          <span className="block h-[2px] w-4 rounded-pill bg-current transition-transform duration-200 group-open:-translate-y-[3.5px] group-open:-rotate-45" />
        </span>
        <span className="group-open:hidden">{menu}</span>
        <span className="hidden group-open:inline">{closeMenu}</span>
      </summary>
      <nav
        aria-label={label}
        className="absolute inset-x-0 top-full z-40 border-y border-line bg-bg/97 px-5 pt-2 pb-6 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.6)] backdrop-blur"
      >
        <ul className="mx-auto max-w-6xl divide-y divide-line/60">
          {items.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  className="flex min-h-14 items-center justify-between font-display text-2xl"
                >
                  {item.label}
                  {current && (
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-pill bg-lantern shadow-[0_0_10px_2px_rgb(246_190_79/0.7)]"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </details>
  );
}
