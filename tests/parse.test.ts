import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseConstructionPlans, PlanParseError } from "../src/plan/parse";
import { summarizePlan } from "../src/plan/summary";

const sample = readFileSync(new URL("../src/samples/ARG_EnCells_2C.xml", import.meta.url), "utf8");

describe("parseConstructionPlans", () => {
  const [plan] = parseConstructionPlans(sample);
  const entry = (index: string) => plan.entries.find((e) => e.index === index)!;

  it("lee el plano de ejemplo", () => {
    expect(plan.name).toBe("ARG EnCells 2C");
    expect(plan.id).toBe("player_1724483268");
    expect(plan.entries).toHaveLength(37);
  });

  it("lee la entrada ancla sin predecesor", () => {
    const anchor = entry("1");
    expect(anchor.macro).toBe("pier_arg_harbor_01_macro");
    expect(anchor.predecessor).toBeNull();
    expect(anchor.position.x).toBeCloseTo(-1560.089);
  });

  it("lee predecesor y puntos de anclaje", () => {
    expect(entry("2").connection).toBe("connectionsnap005");
    expect(entry("2").predecessor).toEqual({ index: "1", connection: "connectionsnap003" });
  });

  it("lee rotaciones en grados con valores ausentes a 0", () => {
    expect(entry("3").rotation).toEqual({ yaw: -90, pitch: 0, roll: 0 });
    expect(entry("15").rotation).toEqual({ yaw: 90, pitch: 0, roll: -179.99998 });
  });

  it("lee cuaterniones con qw por defecto a 1 y el resto a 0", () => {
    expect(entry("5").quaternion).toEqual({ x: -0.707107, y: 0, z: 0, w: 0.707107 });
    expect(entry("5").rotation).toBeNull();
  });

  it("acepta un archivo con varios planos e ignora los vacíos", () => {
    const xml = `<?xml version="1.0"?>
      <plans>
        <plan id="a" name="Uno"><entry index="1" macro="struct_arg_cross_01_macro"><offset><position x="1" y="2" z="3"/></offset></entry></plan>
        <plan id="b" name="Vacío"></plan>
        <plan id="c"><entry index="1" macro="hab_arg_s_01_macro"/></plan>
      </plans>`;
    const plans = parseConstructionPlans(xml);
    expect(plans.map((p) => p.name)).toEqual(["Uno", "c"]);
    expect(plans[1].entries[0].position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it("rechaza XML mal formado", () => {
    expect(() => parseConstructionPlans("<plans><plan>")).toThrow(PlanParseError);
  });

  it("rechaza un XML sin planos", () => {
    expect(() => parseConstructionPlans("<savegame/>")).toThrow(/plan/);
  });
});

describe("summarizePlan", () => {
  const summary = summarizePlan(parseConstructionPlans(sample)[0]);

  it("cuenta módulos por categoría", () => {
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

  it("agrupa la producción por mercancía", () => {
    expect(summary.production).toEqual([{ ware: "Celdas de energía", count: 10 }]);
  });

  it("detecta módulos sin predecesor aparte del ancla", () => {
    expect(summary.unlinked).toEqual(["28", "29"]);
  });
});
