import { type NextRequest, NextResponse } from "next/server";
import { isLocale, negotiateLocale } from "@/i18n/config";

/** Sends locale-less paths ("/", "/help") to "/en/…" or "/es/…" based on Accept-Language. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const firstSegment = pathname.split("/")[1] ?? "";
  if (isLocale(firstSegment)) return;

  const locale = negotiateLocale(request.headers.get("accept-language"));
  const target = new URL(`/${locale}${pathname === "/" ? "" : pathname}${search}`, request.url);
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
