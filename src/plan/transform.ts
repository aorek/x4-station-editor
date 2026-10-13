import type { PlanEntry } from "./types";

export type QuatTuple = [x: number, y: number, z: number, w: number];

const DEG = Math.PI / 180;

/**
 * Convierte `<rotation yaw pitch roll>` (grados) a cuaternión.
 *
 * Convención asumida: yaw gira sobre Y, pitch sobre X y roll sobre Z, aplicados
 * en orden Y → X → Z (equivale a `THREE.Euler(pitch, yaw, roll, "YXZ")`).
 * Los planos de prueba solo usan yaw y roll de ±90/180°, así que el orden aún
 * no está verificado con rotaciones combinadas arbitrarias.
 */
export function eulerDegToQuaternion(yaw: number, pitch: number, roll: number): QuatTuple {
  const x = pitch * DEG;
  const y = yaw * DEG;
  const z = roll * DEG;
  const c1 = Math.cos(x / 2), s1 = Math.sin(x / 2);
  const c2 = Math.cos(y / 2), s2 = Math.sin(y / 2);
  const c3 = Math.cos(z / 2), s3 = Math.sin(z / 2);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 - s1 * s2 * c3,
    c1 * c2 * c3 + s1 * s2 * s3,
  ];
}

/** Rotación de una entrada como cuaternión normalizado, en coordenadas de X4. */
export function entryQuaternion(entry: PlanEntry): QuatTuple {
  if (entry.quaternion) {
    const { x, y, z, w } = entry.quaternion;
    const len = Math.hypot(x, y, z, w) || 1;
    return [x / len, y / len, z / len, w / len];
  }
  if (entry.rotation) {
    const { yaw, pitch, roll } = entry.rotation;
    return eulerDegToQuaternion(yaw, pitch, roll);
  }
  return [0, 0, 0, 1];
}
