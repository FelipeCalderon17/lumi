import { describe, expect, it } from "vitest";
import { formatNoteDate } from "./dates";

describe("formatNoteDate", () => {
  it("shows the wall-clock time the device wrote, whatever the viewer's time zone", () => {
    const en = formatNoteDate("2026-10-28T23:10:00-05:00", "en");
    expect(en).toContain("Oct 28, 2026");
    expect(en).toMatch(/11:10\s?PM/);
  });

  it("localizes in Spanish", () => {
    const es = formatNoteDate("2026-10-28T23:10:00-05:00", "es");
    expect(es).toContain("28");
    expect(es.toLowerCase()).toContain("oct");
    expect(es).toContain("2026");
  });

  it("returns an unparseable value as is", () => {
    expect(formatNoteDate("yesterday", "en")).toBe("yesterday");
  });
});
