import { describe, expect, it } from "vitest";
import { entryQuaternion, eulerDegToQuaternion, type QuatTuple } from "../src/plan/transform";
import type { PlanEntry } from "../src/plan/types";

/** Rotates a vector by a quaternion (q · v · q⁻¹). */
function rotate([qx, qy, qz, qw]: QuatTuple, [x, y, z]: [number, number, number]): [number, number, number] {
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}

function expectVec(actual: [number, number, number], expected: [number, number, number]) {
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 5));
}

const baseEntry: PlanEntry = {
  index: "1",
  macro: "x",
  connection: null,
  predecessor: null,
  position: { x: 0, y: 0, z: 0 },
  rotation: null,
  quaternion: null,
};

describe("eulerDegToQuaternion", () => {
  it("no rotation gives the identity", () => {
    expect(eulerDegToQuaternion(0, 0, 0)).toEqual([0, 0, 0, 1]);
  });

  it("yaw turns about Y", () => {
    // A straight connector with yaw -90 goes from lying along Z to lying along X.
    expectVec(rotate(eulerDegToQuaternion(-90, 0, 0), [0, 0, 1]), [-1, 0, 0]);
    expectVec(rotate(eulerDegToQuaternion(-90, 0, 0), [0, 1, 0]), [0, 1, 0]);
  });

  it("pitch turns about X and roll about Z", () => {
    expectVec(rotate(eulerDegToQuaternion(0, 90, 0), [1, 0, 0]), [1, 0, 0]);
    expectVec(rotate(eulerDegToQuaternion(0, 0, 90), [0, 0, 1]), [0, 0, 1]);
  });
});

describe("entryQuaternion", () => {
  it("uses the plan quaternion, normalized", () => {
    const q = entryQuaternion({ ...baseEntry, quaternion: { x: -0.707107, y: 0, z: 0, w: 0.707107 } });
    expect(Math.hypot(...q)).toBeCloseTo(1, 10);
    // The sample S storage goes from lying along Z to standing upright.
    expectVec(rotate(q, [0, 0, 1]), [0, 1, 0]);
  });

  it("returns the identity without rotation", () => {
    expect(entryQuaternion(baseEntry)).toEqual([0, 0, 0, 1]);
  });
});
