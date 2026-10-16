/** Vector in X4 coordinates (left-handed, Y up, metres). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Rotation in degrees, as in `<rotation yaw pitch roll>`. */
export interface EulerDeg {
  yaw: number;
  pitch: number;
  roll: number;
}

/** Rotation as in `<quaternion qx qy qz qw>`. */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Predecessor {
  /** Index of the entry this module attaches to. */
  index: string;
  /** Connection snap on the predecessor module (e.g. `connectionsnap003`). */
  connection: string | null;
}

export interface PlanEntry {
  index: string;
  macro: string;
  /** Own connection snap used to attach to the predecessor. */
  connection: string | null;
  predecessor: Predecessor | null;
  /** Absolute position relative to the plan origin. */
  position: Vec3;
  rotation: EulerDeg | null;
  quaternion: Quat | null;
}

export interface ConstructionPlan {
  id: string;
  name: string;
  description: string;
  entries: PlanEntry[];
}
