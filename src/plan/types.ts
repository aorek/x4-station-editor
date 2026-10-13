/** Vector en el sistema de coordenadas de X4 (mano izquierda, Y hacia arriba, metros). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Rotación en grados tal como aparece en `<rotation yaw pitch roll>`. */
export interface EulerDeg {
  yaw: number;
  pitch: number;
  roll: number;
}

/** Rotación tal como aparece en `<quaternion qx qy qz qw>`. */
export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Predecessor {
  /** Índice de la entrada a la que se engancha este módulo. */
  index: string;
  /** Punto de anclaje del módulo predecesor (p. ej. `connectionsnap003`). */
  connection: string | null;
}

export interface PlanEntry {
  index: string;
  macro: string;
  /** Punto de anclaje propio con el que se une al predecesor. */
  connection: string | null;
  predecessor: Predecessor | null;
  /** Posición absoluta respecto al origen del plano. */
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
