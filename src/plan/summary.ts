import { describeModule, type CategoryId } from "../catalog/modules";
import { productionRate } from "../catalog/wares";
import type { ConstructionPlan } from "./types";

export interface WareProduction {
  ware: string;
  /** Modules producing this ware. */
  count: number;
  /** Total output per hour without workforce, or null if the recipe is unknown. */
  perHour: number | null;
  /** Total output per hour at full workforce, or null if the recipe is unknown. */
  perHourWithWorkforce: number | null;
}

export interface PlanSummary {
  moduleCount: number;
  byCategory: Partial<Record<CategoryId, number>>;
  /** Production per ware id, most modules first. */
  production: WareProduction[];
  /** Workers the habitats house and workers the production modules need. */
  workforce: { capacity: number; needed: number };
  /** Entries without a predecessor other than the first one (the anchor). */
  unlinked: string[];
}

export function summarizePlan(plan: ConstructionPlan): PlanSummary {
  const byCategory: Partial<Record<CategoryId, number>> = {};
  const production = new Map<string, WareProduction>();
  const workforce = { capacity: 0, needed: 0 };

  for (const entry of plan.entries) {
    const info = describeModule(entry.macro);
    byCategory[info.category] = (byCategory[info.category] ?? 0) + 1;
    workforce.capacity += info.stats.workforce?.capacity ?? 0;
    workforce.needed += info.stats.workforceNeeded ?? 0;

    // Modules with game data list what they make; estimated ones only know their ware.
    const made = info.stats.production ?? (info.ware ? [{ ware: info.ware, method: "default" }] : []);
    for (const { ware, method } of made) {
      const total = production.get(ware) ?? { ware, count: 0, perHour: 0, perHourWithWorkforce: 0 };
      const rate = productionRate(ware, method);
      total.count += 1;
      total.perHour = rate && total.perHour !== null ? total.perHour + rate.perHour : null;
      total.perHourWithWorkforce =
        rate && total.perHourWithWorkforce !== null ? total.perHourWithWorkforce + rate.perHourWithWorkforce : null;
      production.set(ware, total);
    }
  }

  const unlinked = plan.entries.slice(1).filter((e) => !e.predecessor).map((e) => e.index);

  return {
    moduleCount: plan.entries.length,
    byCategory,
    production: [...production.values()].sort((a, b) => b.count - a.count),
    workforce,
    unlinked,
  };
}
