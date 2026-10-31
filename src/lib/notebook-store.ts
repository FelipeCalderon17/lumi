import { config } from "@/server/config";

/**
 * The parent's notebook, stored ONLY in this browser's localStorage (ADR 0005). Nothing here
 * talks to the server. Corrupt or foreign data never crashes the page: valid notes are kept,
 * the rest is dropped, and the caller is told so it can say something calm.
 */

export type StoredNote = { id: string; text: string; createdAt: string };

export const NOTEBOOK_STORAGE_KEY = "lumi.notebook.v1";
export const MAX_NOTE_CHARS = config.limits.notebook.maxNoteChars;

/** The subset of Storage we use, so tests can pass a fake. */
export type NoteStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type LoadResult = { notes: StoredNote[]; recovered: boolean };
export type WriteResult = { ok: true; notes: StoredNote[] } | { ok: false; reason: WriteError };
export type WriteError = "empty" | "too_long" | "storage";

function isNote(value: unknown): value is StoredNote {
  if (typeof value !== "object" || value === null) return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.id === "string" &&
    typeof note.text === "string" &&
    note.text.trim() !== "" &&
    typeof note.createdAt === "string" &&
    !Number.isNaN(Date.parse(note.createdAt))
  );
}

/** Notes, oldest first. Never throws. */
export function loadNotes(storage: NoteStorage | null): LoadResult {
  let raw: string | null;
  try {
    raw = storage?.getItem(NOTEBOOK_STORAGE_KEY) ?? null;
  } catch {
    return { notes: [], recovered: false };
  }
  if (raw === null) return { notes: [], recovered: false };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { notes: [], recovered: true };
  }
  if (!Array.isArray(parsed)) return { notes: [], recovered: true };
  const notes = parsed.filter(isNote);
  return { notes: sortByDate(notes), recovered: notes.length !== parsed.length };
}

function sortByDate(notes: StoredNote[]): StoredNote[] {
  return [...notes].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function save(storage: NoteStorage | null, notes: StoredNote[]): WriteResult {
  try {
    if (!storage) return { ok: false, reason: "storage" };
    storage.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(notes));
    return { ok: true, notes };
  } catch {
    // Quota exceeded, or storage disabled (some private modes).
    return { ok: false, reason: "storage" };
  }
}

/** Adds a note (text kept as typed, only trimmed at the ends) with the device's local time. */
export function addNote(
  storage: NoteStorage | null,
  text: string,
  now: Date = new Date(),
): WriteResult {
  const clean = text.trim();
  if (clean === "") return { ok: false, reason: "empty" };
  if (clean.length > MAX_NOTE_CHARS) return { ok: false, reason: "too_long" };
  const { notes } = loadNotes(storage);
  const note: StoredNote = { id: newId(), text: clean, createdAt: localIsoString(now) };
  return save(storage, sortByDate([...notes, note]));
}

export function deleteNote(storage: NoteStorage | null, id: string): WriteResult {
  const { notes } = loadNotes(storage);
  return save(
    storage,
    notes.filter((note) => note.id !== id),
  );
}

export function clearNotes(storage: NoteStorage | null): WriteResult {
  try {
    storage?.removeItem(NOTEBOOK_STORAGE_KEY);
    return { ok: true, notes: [] };
  } catch {
    return { ok: false, reason: "storage" };
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * "2026-10-28T23:10:00-05:00": ISO 8601 with the device's own offset, so the server and the
 * printed page show the parent's local date and time, not UTC's.
 */
export function localIsoString(date: Date): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

/** localStorage, or null where it's unavailable (server render, disabled storage). */
export function browserStorage(): NoteStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
