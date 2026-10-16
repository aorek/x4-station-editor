import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { removeEntries, sequenceOf } from "../src/plan/edit";
import { parseConstructionPlans } from "../src/plan/parse";
import type { ConstructionPlan, PlanEntry } from "../src/plan/types";

const sample = readFileSync(resolve(__dirname, "../src/samples/ARG_EnCells_2C.xml"), "utf8");
const [plan] = parseConstructionPlans(sample);

/** Plan from `index → predecessor index` pairs. */
function chain(links: Record<string, string | null>): ConstructionPlan {
  const entries = Object.entries(links).map(
    ([index, pred]): PlanEntry => ({
      index,
      macro: "x",
      connection: null,
      predecessor: pred ? { index: pred, connection: null } : null,
      position: { x: 0, y: 0, z: 0 },
      rotation: null,
      quaternion: null,
    }),
  );
  return { id: "p", name: "", description: "", entries, source: "<plan/>" };
}

describe("sequenceOf", () => {
  it("is just the module when nothing is attached to it", () => {
    const leaf = plan.entries.find((e) => !plan.entries.some((f) => f.predecessor?.index === e.index))!;
    expect(sequenceOf(plan, leaf.index)).toEqual([leaf.index]);
  });

  it("follows followers of followers, in plan order", () => {
    //   1 ─ 2 ─ 3 ─ 5
    //        └─ 4
    //   6 (loose)
    const tree = chain({ "1": null, "2": "1", "3": "2", "4": "2", "5": "3", "6": null });
    expect(sequenceOf(tree, "2")).toEqual(["2", "3", "4", "5"]);
    expect(sequenceOf(tree, "1")).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("ends on predecessor cycles and is empty for unknown indices", () => {
    expect(sequenceOf(chain({ "1": "2", "2": "1" }), "1")).toEqual(["1", "2"]);
    expect(sequenceOf(plan, "999")).toEqual([]);
  });

  it("from the anchor covers every linked module of the sample", () => {
    const unlinked = plan.entries.slice(1).filter((e) => !e.predecessor).length;
    expect(sequenceOf(plan, "1").length).toBeLessThanOrEqual(plan.entries.length - unlinked);
  });
});

describe("removeEntries", () => {
  it("drops the entries and leaves the original plan untouched", () => {
    const edited = removeEntries(plan, sequenceOf(plan, "28"));
    expect(edited.entries.map((e) => e.index)).not.toContain("28");
    expect(edited.entries.length).toBe(plan.entries.length - sequenceOf(plan, "28").length);
    expect(plan.entries).toHaveLength(37);
  });

  it("leaves no entry pointing at a removed one when removing a whole sequence", () => {
    const edited = removeEntries(plan, sequenceOf(plan, "6"));
    const left = new Set(edited.entries.map((e) => e.index));
    expect(edited.entries.every((e) => !e.predecessor || left.has(e.predecessor.index))).toBe(true);
  });
});
