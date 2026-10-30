import { config, modelCatalog } from "./config";
import { withTimeout } from "./context";
import { type GapRecord, type GapStore, listGapsForStaff } from "./gaps";
import { summarizeTotals, type UsageReader, type UsageSummary } from "./ledger";

/**
 * What the staff view shows: consented gaps (purged past retention first) and usage aggregated
 * in SQL over the whole window, with cost DERIVED from the current price catalog (ADR 0013).
 * Each half degrades on its own.
 */
export type StaffOverview = {
  gaps: { status: "ok"; items: GapRecord[] } | { status: "unavailable" | "failed" };
  usage: /** Every ledger row in the window is counted (aggregated in SQL, no row limit). */
    | { status: "ok"; windowDays: number; complete: true; summary: UsageSummary }
    /**
     * More step × model groups than config.staff.usageMaxGroups: only the first ones are
     * shown, so the totals are partial and must not be presented as complete.
     */
    | {
        status: "ok";
        windowDays: number;
        complete: false;
        incompleteReason: "too_many_groups";
        summary: UsageSummary;
      }
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
  const maxGroups = config.staff.usageMaxGroups;
  const usage: StaffOverview["usage"] = stores.usage
    ? await withTimeout(stores.usage.totalsSince(cutoff, maxGroups), config.timeouts.dbMs)
        .then((totals): StaffOverview["usage"] => {
          if (totals.groups.length <= maxGroups) {
            return {
              status: "ok",
              windowDays,
              complete: true,
              summary: summarizeTotals(totals, modelCatalog),
            };
          }
          const shown = { ...totals, groups: totals.groups.slice(0, maxGroups) };
          return {
            status: "ok",
            windowDays,
            complete: false,
            incompleteReason: "too_many_groups",
            summary: summarizeTotals(shown, modelCatalog),
          };
        })
        .catch(() => ({ status: "failed" as const }))
    : { status: "unavailable" };

  return { gaps, usage };
}
