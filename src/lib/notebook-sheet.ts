import type { NotebookResponse, NotebookSafetyNotice, NotebookTopic } from "@/server/notebook";
import type { EmergencyKind } from "@/server/safety";
import { localSafetyNotices, noticeKinds } from "./notebook-safety";
import type { StoredNote } from "./notebook-store";

/** What the notebook page shows: the server's prepared page, or the notes by date (no AI). */
export type SheetData =
  | { kind: "prepared"; response: NotebookResponse; preparedAt: Date }
  /**
   * When preparing failed or the device is offline. `serverNotices` are the notices that came
   * back with the error, if any; only their kinds are used (their indexes refer to the request).
   */
  | {
      kind: "byDate";
      notes: StoredNote[];
      preparedAt: Date;
      serverNotices: NotebookSafetyNotice[];
    };

export type SheetNote = { key: string; text: string; createdAt: string; flagged: boolean };
export type SheetGroup = { topic: NotebookTopic | null; notes: SheetNote[] };
export type SheetModel = { kinds: EmergencyKind[]; groups: SheetGroup[] };

/**
 * The notices and groups for any sheet. Every variant merges the server's notices with the
 * same deterministic check run here, so no sheet (by date, offline, prepared) loses a notice.
 * Note text is passed through untouched.
 */
export function sheetModel(data: SheetData): SheetModel {
  const notes =
    data.kind === "prepared"
      ? data.response.result.groups.flatMap((group) =>
          group.notes.map((note) => ({
            key: String(note.index),
            serverIndex: note.index,
            topic: group.topic as NotebookTopic | null,
            text: note.text,
            createdAt: note.createdAt,
          })),
        )
      : data.notes.map((note) => ({
          key: note.id,
          serverIndex: null,
          topic: null,
          text: note.text,
          createdAt: note.createdAt,
        }));
  const serverNotices = data.kind === "prepared" ? data.response.safetyNotices : data.serverNotices;
  const serverFlagged = new Set(
    data.kind === "prepared" ? serverNotices.map((notice) => notice.noteIndex) : [],
  );
  const localNotices = localSafetyNotices(notes);
  const localFlagged = new Set(localNotices.map((notice) => notice.noteIndex));

  const groups: SheetGroup[] = [];
  notes.forEach((note, i) => {
    let group = groups.find((g) => g.topic === note.topic);
    if (!group) {
      group = { topic: note.topic, notes: [] };
      groups.push(group);
    }
    group.notes.push({
      key: note.key,
      text: note.text,
      createdAt: note.createdAt,
      flagged:
        (note.serverIndex !== null && serverFlagged.has(note.serverIndex)) || localFlagged.has(i),
    });
  });
  return { kinds: noticeKinds(serverNotices, localNotices), groups };
}
