import { describeModule, type CategoryId } from "../catalog/modules";
import type { ConstructionPlan } from "./types";

export interface PlanSummary {
  moduleCount: number;
  byCategory: Partial<Record<CategoryId, number>>;
  /** Número de módulos por mercancía producida, de mayor a menor. */
  production: Array<{ ware: string; count: number }>;
  /** Entradas sin predecesor aparte de la primera (ancla). */
  unlinked: string[];
}

export function summarizePlan(plan: ConstructionPlan): PlanSummary {
  const byCategory: Partial<Record<CategoryId, number>> = {};
  const wares = new Map<string, number>();

  for (const entry of plan.entries) {
    const info = describeModule(entry.macro);
    byCategory[info.category] = (byCategory[info.category] ?? 0) + 1;
    if (info.ware) wares.set(info.ware, (wares.get(info.ware) ?? 0) + 1);
  }

  const unlinked = plan.entries.slice(1).filter((e) => !e.predecessor).map((e) => e.index);

  return {
    moduleCount: plan.entries.length,
    byCategory,
    production: [...wares].map(([ware, count]) => ({ ware, count })).sort((a, b) => b.count - a.count),
    unlinked,
  };
}
