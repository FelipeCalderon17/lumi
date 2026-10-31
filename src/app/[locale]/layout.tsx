import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Fraunces } from "next/font/google";
import { notFound } from "next/navigation";
import Script from "next/script";
import { EmergencyStrip } from "@/components/emergency-strip";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { THEME_INIT_SCRIPT } from "@/components/theme-toggle";
import { getDictionary, isLocale, locales } from "@/i18n";
import "../globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
  // next/font has no metrics for this family yet; skip the generated fallback explicitly.
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#12112a" },
    { media: "(prefers-color-scheme: light)", color: "#fbf6ec" },
  ],
};

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = getDictionary(locale);
  return {
    title: { default: t.meta.title, template: `%s · Lumi` },
    description: t.meta.description,
    alternates: { languages: { en: "/en", es: "/es" } },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDictionary(locale);

  return (
    // The theme script may set data-theme before React hydrates.
    <html
      lang={locale}
      className={`${fraunces.variable} ${atkinson.variable}`}
      suppressHydrationWarning
    >
      <body className="flex flex-col">
        {/* Applies a saved night/dawn choice before first paint (a fixed string, no user input). */}
        <Script id="lumi-theme" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <a
          href="#main"
          className="sr-only z-50 rounded-pill bg-lantern px-4 py-2 font-semibold text-on-lantern focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
        >
          {t.nav.skipToContent}
        </a>
        <EmergencyStrip t={t} />
        <SiteHeader locale={locale} t={t} />
        <main id="main" className="w-full flex-1">
          {children}
        </main>
        <SiteFooter locale={locale} t={t} />
      </body>
    </html>
  );
}
