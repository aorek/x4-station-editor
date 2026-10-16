import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { describeModule } from "../src/catalog/modules";
import { parseConstructionPlans } from "../src/plan/parse";
import { entryQuaternion } from "../src/plan/transform";
import type { PlanEntry } from "../src/plan/types";

const sample = readFileSync(resolve(__dirname, "../src/samples/ARG_EnCells_2C.xml"), "utf8");
const [plan] = parseConstructionPlans(sample);
const byIndex = new Map(plan.entries.map((e) => [e.index, e]));

/** Position and outward axis of a connection snap, in plan coordinates. */
function snapInPlan(entry: PlanEntry, connection: string) {
  const snap = describeModule(entry.macro).snaps[connection.toLowerCase()];
  expect(snap, `${entry.macro} has no ${connection}`).toBeDefined();
  const rotation = new THREE.Quaternion().fromArray(entryQuaternion(entry));
  const position = new THREE.Vector3(...snap.position)
    .applyQuaternion(rotation)
    .add(new THREE.Vector3(entry.position.x, entry.position.y, entry.position.z));
  const forward = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(rotation.multiply(new THREE.Quaternion().fromArray(snap.quaternion)));
  return { position, forward };
}

describe("game data", () => {
  it("has real dimensions for every module in the sample plan", () => {
    const missing = plan.entries.filter((e) => !describeModule(e.macro).measured).map((e) => e.macro);
    expect(missing).toEqual([]);
  });

  it("uses the main part's box, even when off-centre", () => {
    const cross = describeModule("struct_arg_cross_01_macro").shape;
    expect(cross.kind).toBe("box");
    cross.size.forEach((s) => expect(s).toBeCloseTo(400, -1));
    const storage = describeModule("storage_arg_m_container_01_macro").shape;
    expect(storage.size[2]).toBeCloseTo(800, -1);
    expect(storage.center?.[0]).toBeCloseTo(-115, 0);
  });

  it("unknown macros still get an estimated shape", () => {
    const info = describeModule("prod_mod_madeup_macro");
    expect(info.measured).toBe(false);
    expect(info.category).toBe("production");
  });
});

describe("sample plan connection snaps", () => {
  const linked = plan.entries.filter((e) => e.predecessor);

  // If positions and rotations are read correctly, each module's snap sits on
  // its predecessor's and the two face opposite ways.
  it.each(linked.map((e) => [e.index, e.macro, e] as const))("#%s %s fits its predecessor", (_, __, entry) => {
    const parent = byIndex.get(entry.predecessor!.index)!;
    const own = snapInPlan(entry, entry.connection!);
    const other = snapInPlan(parent, entry.predecessor!.connection!);
    expect(own.position.distanceTo(other.position)).toBeLessThan(0.5);
    expect(own.forward.dot(other.forward)).toBeCloseTo(-1, 3);
  });
});
