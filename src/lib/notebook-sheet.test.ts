import { describe, expect, it } from "vitest";
import { sheetModel } from "./notebook-sheet";
import type { StoredNote } from "./notebook-store";

const note = (id: string, text: string): StoredNote => ({
  id,
  text,
  createdAt: "2026-10-28T23:10:00-05:00",
});
const preparedAt = new Date(2026, 9, 31);

describe("sheetModel", () => {
  it("by date (offline / after an error): the local check flags notes and adds the notice", () => {
    const model = sheetModel({
      kind: "byDate",
      preparedAt,
      serverNotices: [],
      notes: [note("a", "Ask about school"), note("b", "He had a seizure at 2am")],
    });
    expect(model.kinds).toEqual(["medical_emergency"]);
    expect(model.groups).toEqual([
      {
        topic: null,
        notes: [
          {
            key: "a",
            text: "Ask about school",
            createdAt: note("a", "").createdAt,
            flagged: false,
          },
          {
            key: "b",
            text: "He had a seizure at 2am",
            createdAt: note("b", "").createdAt,
            flagged: true,
          },
        ],
      },
    ]);
  });

  it("by date keeps the notices the server returned with a 400", () => {
    const model = sheetModel({
      kind: "byDate",
      preparedAt,
      notes: [note("a", "Ask about school")],
      serverNotices: [{ kind: "self_harm", detectedBy: "safety", language: "en", noteIndex: 7 }],
    });
    expect(model.kinds).toEqual(["self_harm"]);
    // The server's index refers to the request, not to this list: no note is guessed at.
    expect(model.groups[0]?.notes[0]?.flagged).toBe(false);
  });

  it("prepared: server and local notices merge; notes stay verbatim and grouped", () => {
    const model = sheetModel({
      kind: "prepared",
      preparedAt,
      response: {
        safetyNotices: [
          { kind: "medical_emergency", detectedBy: "safety", language: "en", noteIndex: 0 },
        ],
        result: {
          kind: "organized",
          groups: [
            { topic: "sleep", notes: [{ index: 0, text: "  Woke at 3.\n", createdAt: "x" }] },
            {
              topic: "other",
              notes: [{ index: 1, text: "I want to die", createdAt: "y" }],
            },
          ],
        },
      },
    });
    expect(model.kinds).toEqual(["medical_emergency", "self_harm"]);
    expect(model.groups.map((g) => g.topic)).toEqual(["sleep", "other"]);
    expect(model.groups[0]?.notes[0]).toEqual({
      key: "0",
      text: "  Woke at 3.\n",
      createdAt: "x",
      flagged: true,
    });
    expect(model.groups[1]?.notes[0]?.flagged).toBe(true);
  });

  it("no matches → no notices", () => {
    const model = sheetModel({
      kind: "byDate",
      preparedAt,
      serverNotices: [],
      notes: [note("a", "Slept well")],
    });
    expect(model.kinds).toEqual([]);
  });
});
