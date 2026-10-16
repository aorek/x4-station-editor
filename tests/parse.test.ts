import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseConstructionPlans, PlanParseError } from "../src/plan/parse";
import { summarizePlan } from "../src/plan/summary";

const sample = readFileSync(resolve(__dirname, "../src/samples/ARG_EnCells_2C.xml"), "utf8");

describe("parseConstructionPlans", () => {
  const [plan] = parseConstructionPlans(sample);
  const entry = (index: string) => plan.entries.find((e) => e.index === index)!;

  it("reads the sample plan", () => {
    expect(plan.name).toBe("ARG EnCells 2C");
    expect(plan.id).toBe("player_1724483268");
    expect(plan.entries).toHaveLength(37);
  });

  it("reads the anchor entry without a predecessor", () => {
    const anchor = entry("1");
    expect(anchor.macro).toBe("pier_arg_harbor_01_macro");
    expect(anchor.predecessor).toBeNull();
    expect(anchor.position.x).toBeCloseTo(-1560.089);
  });

  it("reads predecessor and connection snaps", () => {
    expect(entry("2").connection).toBe("connectionsnap005");
    expect(entry("2").predecessor).toEqual({ index: "1", connection: "connectionsnap003" });
  });

  it("reads rotations in degrees, missing values as 0", () => {
    expect(entry("3").rotation).toEqual({ yaw: -90, pitch: 0, roll: 0 });
    expect(entry("15").rotation).toEqual({ yaw: 90, pitch: 0, roll: -179.99998 });
  });

  it("reads quaternions with qw defaulting to 1 and the rest to 0", () => {
    expect(entry("5").quaternion).toEqual({ x: -0.707107, y: 0, z: 0, w: 0.707107 });
    expect(entry("5").rotation).toBeNull();
  });

  it("accepts a file with several plans and skips empty ones", () => {
    const xml = `<?xml version="1.0"?>
      <plans>
        <plan id="a" name="One"><entry index="1" macro="struct_arg_cross_01_macro"><offset><position x="1" y="2" z="3"/></offset></entry></plan>
        <plan id="b" name="Empty"></plan>
        <plan id="c"><entry index="1" macro="hab_arg_s_01_macro"/></plan>
      </plans>`;
    const plans = parseConstructionPlans(xml);
    expect(plans.map((p) => p.name)).toEqual(["One", "c"]);
    expect(plans[1].entries[0].position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("leaves the name empty when the plan has neither name nor id", () => {
    const [unnamed] = parseConstructionPlans(`<plans><plan><entry index="1" macro="x"/></plan></plans>`);
    expect(unnamed.name).toBe("");
  });

  it("rejects malformed XML", () => {
    expect(() => parseConstructionPlans("<plans><plan>")).toThrow(
      expect.objectContaining({ name: "PlanParseError", code: "invalidXml" }),
    );
  });

  it("rejects XML without plans", () => {
    expect(() => parseConstructionPlans("<savegame/>")).toThrow(PlanParseError);
    expect(() => parseConstructionPlans("<savegame/>")).toThrow(expect.objectContaining({ code: "noPlans" }));
  });
});

describe("summarizePlan", () => {
  const summary = summarizePlan(parseConstructionPlans(sample)[0]);

  it("counts modules per category", () => {
    expect(summary.moduleCount).toBe(37);
    expect(summary.byCategory).toEqual({
      pier: 1,
      structure: 14,
      storage: 4,
      production: 10,
      dock: 2,
      habitat: 3,
      defence: 3,
    });
  });

  it("groups production by ware id with hourly output", () => {
    // 10 modules × 175 cells every 60 s; +43 % at full workforce.
    expect(summary.production).toEqual([
      { ware: "energycells", count: 10, perHour: 105_000, perHourWithWorkforce: expect.closeTo(150_150, 6) },
    ]);
  });

  it("adds up housed and needed workforce", () => {
    // 2 Argon S habitats (250) + 1 Argon M (500); 10 energy cell modules × 90.
    expect(summary.workforce).toEqual({ capacity: 1000, needed: 900 });
  });

  it("finds modules without a predecessor besides the anchor", () => {
    expect(summary.unlinked).toEqual(["28", "29"]);
  });
});
