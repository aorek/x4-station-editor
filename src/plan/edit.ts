import type { ConstructionPlan } from "./types";

/**
 * Returns a copy of the plan without the entry `index`. Modules attached to it
 * keep their position but lose their predecessor, so they become loose
 * modules (as the summary's `unlinked` reports them).
 */
export function removeEntry(plan: ConstructionPlan, index: string): ConstructionPlan {
  return {
    ...plan,
    entries: plan.entries
      .filter((entry) => entry.index !== index)
      .map((entry) => (entry.predecessor?.index === index ? { ...entry, predecessor: null } : entry)),
  };
}
