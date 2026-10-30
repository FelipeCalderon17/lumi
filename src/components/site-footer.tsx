import type { Dictionary } from "@/i18n";

export function SiteFooter({ t }: { t: Dictionary }) {
  return (
    <footer className="mx-auto w-full max-w-5xl px-5 py-10 text-sm text-muted">
      <p>{t.footer.fictional}</p>
    </footer>
  );
}
