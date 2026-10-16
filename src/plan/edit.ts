import type { ConstructionPlan } from "./types";

/**
 * Indices of an entry and of every module attached to it, directly or through
 * other followers, in plan order.
 */
export function sequenceOf(plan: ConstructionPlan, index: string): string[] {
  const followers = new Map<string, string[]>();
  for (const entry of plan.entries) {
    if (!entry.predecessor) continue;
    const siblings = followers.get(entry.predecessor.index) ?? [];
    followers.set(entry.predecessor.index, [...siblings, entry.index]);
  }
  const found = new Set<string>();
  const pending = plan.entries.some((e) => e.index === index) ? [index] : [];
  // `found` also guards against predecessor cycles in hand-edited files.
  while (pending.length) {
    const next = pending.pop()!;
    if (found.has(next)) continue;
    found.add(next);
    pending.push(...(followers.get(next) ?? []));
  }
  return plan.entries.filter((e) => found.has(e.index)).map((e) => e.index);
}

/** Returns a copy of the plan without the given entries. */
export function removeEntries(plan: ConstructionPlan, indices: Iterable<string>): ConstructionPlan {
  const removed = new Set(indices);
  return { ...plan, entries: plan.entries.filter((entry) => !removed.has(entry.index)) };
}
