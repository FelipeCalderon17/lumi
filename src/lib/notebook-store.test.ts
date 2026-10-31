import { describe, expect, it } from "vitest";
import {
  addNote,
  clearNotes,
  deleteNote,
  loadNotes,
  localIsoString,
  MAX_NOTE_CHARS,
  NOTEBOOK_STORAGE_KEY,
  type NoteStorage,
  restoreNote,
} from "./notebook-store";

function memoryStorage(initial?: string): NoteStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(NOTEBOOK_STORAGE_KEY, initial);
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("notebook store", () => {
  it("starts empty", () => {
    expect(loadNotes(memoryStorage())).toEqual({ notes: [], recovered: false });
  });

  it("adds notes in date order, keeping the text exactly as typed (ends included)", () => {
    const storage = memoryStorage();
    addNote(storage, "  Slept badly.\n  Woke at 3.  \n", new Date(2026, 9, 29, 23, 0));
    addNote(storage, "Ask about school", new Date(2026, 9, 28, 8, 0));
    const { notes } = loadNotes(storage);
    expect(notes.map((n) => n.text)).toEqual([
      "Ask about school",
      "  Slept badly.\n  Woke at 3.  \n",
    ]);
    expect(new Set(notes.map((n) => n.id)).size).toBe(2);
  });

  it("refuses empty and over-long notes without touching storage", () => {
    const storage = memoryStorage();
    expect(addNote(storage, "   ")).toEqual({ ok: false, reason: "empty" });
    expect(addNote(storage, "x".repeat(MAX_NOTE_CHARS + 1))).toEqual({
      ok: false,
      reason: "too_long",
    });
    expect(storage.data.size).toBe(0);
  });

  it("deletes one note and clears everything", () => {
    const storage = memoryStorage();
    addNote(storage, "one");
    addNote(storage, "two");
    const [first] = loadNotes(storage).notes;
    const after = deleteNote(storage, first?.id ?? "");
    expect(after.ok && after.notes.map((n) => n.text)).toEqual(["two"]);
    expect(clearNotes(storage)).toEqual({ ok: true, notes: [] });
    expect(storage.data.has(NOTEBOOK_STORAGE_KEY)).toBe(false);
  });

  it("undo puts a deleted note back in place, once", () => {
    const storage = memoryStorage();
    addNote(storage, "first", new Date(2026, 9, 1));
    addNote(storage, "second", new Date(2026, 9, 2));
    const [first] = loadNotes(storage).notes;
    if (!first) throw new Error("missing note");
    deleteNote(storage, first.id);
    restoreNote(storage, first);
    restoreNote(storage, first);
    expect(loadNotes(storage).notes.map((n) => n.text)).toEqual(["first", "second"]);
  });

  it("recovers from corrupt data: invalid JSON, a non-array, or bad entries", () => {
    expect(loadNotes(memoryStorage("{not json"))).toEqual({ notes: [], recovered: true });
    expect(loadNotes(memoryStorage('{"a":1}'))).toEqual({ notes: [], recovered: true });
    const mixed = JSON.stringify([
      { id: "a", text: "kept", createdAt: "2026-10-28T23:10:00-05:00" },
      { id: "b", text: "", createdAt: "2026-10-28T23:10:00-05:00" },
      { id: "c", text: "bad date", createdAt: "yesterday" },
      null,
      "string",
    ]);
    const result = loadNotes(memoryStorage(mixed));
    expect(result.recovered).toBe(true);
    expect(result.notes.map((n) => n.id)).toEqual(["a"]);
  });

  it("adding after corruption keeps the valid notes", () => {
    const storage = memoryStorage("{not json");
    const result = addNote(storage, "fresh start");
    expect(result.ok && result.notes.map((n) => n.text)).toEqual(["fresh start"]);
  });

  it("reports storage failures instead of throwing (quota, disabled storage)", () => {
    const broken: NoteStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(loadNotes(broken)).toEqual({ notes: [], recovered: false });
    expect(addNote(broken, "hi")).toEqual({ ok: false, reason: "storage" });
    expect(clearNotes(broken)).toEqual({ ok: false, reason: "storage" });
    expect(addNote(null, "hi")).toEqual({ ok: false, reason: "storage" });
  });
});

describe("localIsoString", () => {
  it("writes the local wall time with the device's offset", () => {
    const date = new Date(2026, 9, 28, 23, 10, 5);
    const iso = localIsoString(date);
    expect(iso).toMatch(/^2026-10-28T23:10:05[+-]\d{2}:\d{2}$/);
    expect(Date.parse(iso)).toBe(date.getTime());
  });
});
