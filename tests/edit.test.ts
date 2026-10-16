import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { removeEntry } from "../src/plan/edit";
import { parseConstructionPlans } from "../src/plan/parse";
import { summarizePlan } from "../src/plan/summary";

const sample = readFileSync(resolve(__dirname, "../src/samples/ARG_EnCells_2C.xml"), "utf8");
const [plan] = parseConstructionPlans(sample);

describe("removeEntry", () => {
  const followers = plan.entries.filter((e) => e.predecessor?.index === "2").map((e) => e.index);
  const edited = removeEntry(plan, "2");

  it("drops the entry and leaves the original plan untouched", () => {
    expect(edited.entries).toHaveLength(36);
    expect(edited.entries.some((e) => e.index === "2")).toBe(false);
    expect(plan.entries).toHaveLength(37);
  });

  it("detaches the modules attached to it, keeping their position", () => {
    expect(followers.length).toBeGreaterThan(0);
    for (const index of followers) {
      const before = plan.entries.find((e) => e.index === index)!;
      const after = edited.entries.find((e) => e.index === index)!;
      expect(after.predecessor).toBeNull();
      expect(after.position).toEqual(before.position);
    }
    expect(summarizePlan(edited).unlinked).toEqual(expect.arrayContaining(followers));
  });

  it("returns an equal plan for an unknown index", () => {
    expect(removeEntry(plan, "999").entries).toEqual(plan.entries);
  });
});
