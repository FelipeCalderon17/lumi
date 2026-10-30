import { config, modelCatalog } from "./config";
import { withTimeout } from "./context";
import { type GapRecord, type GapStore, listGapsForStaff } from "./gaps";
import { summarizeUsage, type UsageReader, type UsageSummary } from "./ledger";

/**
 * What the staff view shows: consented gaps (purged past retention first) and aggregated usage
 * with cost DERIVED from the current price catalog (ADR 0013). Each half degrades on its own.
 */
export type StaffOverview = {
  gaps: { status: "ok"; items: GapRecord[] } | { status: "unavailable" | "failed" };
  usage:
    | { status: "ok"; windowDays: number; summary: UsageSummary }
    | { status: "unavailable" | "failed" };
};

export async function staffOverview(
  stores: { gaps: GapStore | null; usage: UsageReader | null },
  now: Date = new Date(),
): Promise<StaffOverview> {
  const gaps: StaffOverview["gaps"] = stores.gaps
    ? await listGapsForStaff(stores.gaps, now).then(
        (items) => ({ status: "ok" as const, items }),
        () => ({ status: "failed" as const }),
      )
    : { status: "unavailable" };

  const windowDays = config.staff.usageWindowDays;
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const usage: StaffOverview["usage"] = stores.usage
    ? await withTimeout(stores.usage.since(cutoff, config.staff.usageMaxRows), config.timeouts.dbMs)
        .then((rows) => ({
          status: "ok" as const,
          windowDays,
          summary: summarizeUsage(rows, modelCatalog),
        }))
        .catch(() => ({ status: "failed" as const }))
    : { status: "unavailable" };

  return { gaps, usage };
}
