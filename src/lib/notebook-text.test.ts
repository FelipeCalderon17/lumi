import { describe, expect, it } from "vitest";
import { notebookPlainText } from "./notebook-text";

describe("notebookPlainText", () => {
  it("keeps every note verbatim, line breaks included, under its heading and date", () => {
    const text = notebookPlainText({
      title: "Notes for my child's care team",
      subtitle: "Prepared on October 31, 2026",
      safety: ["If this is happening now, call 911."],
      groups: [
        {
          heading: "Sleep",
          notes: [{ date: "Oct 28, 2026, 11:10 PM", text: "Woke at 3.\nCried  a lot." }],
        },
        { heading: "Other notes", notes: [{ date: "Oct 29, 2026, 8:00 AM", text: "6 seizures?" }] },
      ],
    });
    expect(text).toBe(
      [
        "Notes for my child's care team",
        "Prepared on October 31, 2026",
        "",
        "If this is happening now, call 911.",
        "",
        "Sleep",
        "- Oct 28, 2026, 11:10 PM",
        "  Woke at 3.",
        "  Cried  a lot.",
        "",
        "Other notes",
        "- Oct 29, 2026, 8:00 AM",
        "  6 seizures?",
      ].join("\n"),
    );
  });
});
