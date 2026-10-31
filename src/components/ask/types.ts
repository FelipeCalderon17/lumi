import type { TerminalEvent } from "@/server/events";

export type GapTopicFromEvent = Extract<TerminalEvent, { type: "abstained" }>["topic"];
