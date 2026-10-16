/**
 * Module catalog.
 *
 * Dimensions, connection snaps and gameplay stats come from
 * `modules.generated.json`, which `pnpm extract-game-data` builds from the
 * game files. Macros missing from it (e.g. from mods) get an ESTIMATED shape
 * based on the macro name and no stats.
 *
 * Nothing here is user-facing text: the i18n layer names modules from the
 * game texts, or from `kind`, `size` and `ware` when there are none.
 */

import generated from "./modules.generated.json";

export type CategoryId =
  | "production"
  | "storage"
  | "habitat"
  | "structure"
  | "dock"
  | "pier"
  | "defence"
  | "other";

export interface Category {
  id: CategoryId;
  color: number;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  production: { id: "production", color: 0xf0a64b },
  storage: { id: "storage", color: 0x4fb3a9 },
  habitat: { id: "habitat", color: 0xe58fb0 },
  structure: { id: "structure", color: 0x7f93ad },
  dock: { id: "dock", color: 0x9d8cf0 },
  pier: { id: "pier", color: 0x6cb6f5 },
  defence: { id: "defence", color: 0xe0614f },
  other: { id: "other", color: 0xb7b7b7 },
};

export const CATEGORY_ORDER: CategoryId[] = [
  "production",
  "storage",
  "habitat",
  "structure",
  "dock",
  "pier",
  "defence",
  "other",
];

/** What a module is, used to pick its display name. */
export type ModuleKind =
  | "production"
  | "storage"
  | "storageContainer"
  | "storageLiquid"
  | "storageSolid"
  | "habitat"
  | "crossConnector"
  | "verticalConnectorShort"
  | "verticalConnectorLong"
  | "straightConnectorShort"
  | "straightConnectorLong"
  | "structure"
  | "dock"
  | "pier"
  | "harborPier"
  | "defence"
  | "other";

export type SizeClass = "s" | "m" | "l" | "xl";

export type Vec3Tuple = [x: number, y: number, z: number];

/**
 * Module shape in its local space, in metres: `size` is [x, y, z] and
 * `center` is the shape's centre relative to the module origin (0 by default).
 */
export interface ModuleShape {
  kind: "box" | "cylinderY" | "cylinderZ";
  size: Vec3Tuple;
  center?: Vec3Tuple;
}

/** Connection snap in the module's local space (X4 coordinates). */
export interface ModuleSnap {
  position: Vec3Tuple;
  quaternion: [x: number, y: number, z: number, w: number];
}

/** Mount size as the game tags it. */
export type MountSize = "small" | "medium" | "large" | "extralarge";

/** Gameplay properties from the game data. Absent fields do not apply to the module. */
export interface ModuleStats {
  /** Race id of the maker (`argon`, `teladi`…). */
  race?: string;
  hull?: number;
  /** Workers a habitat houses, and of which race. */
  workforce?: { capacity: number; race: string | null };
  /** Workers a production module needs to reach full output. */
  workforceNeeded?: number;
  /** Storage capacity in m³ and the transport types it takes (`container`, `liquid`, `solid`…). */
  cargo?: { capacity: number; types: string[] };
  /** Wares produced and the recipe (`method`) each one uses. */
  production?: Array<{ ware: string; method: string }>;
  /** External docking bays by ship size group (`"s"`, `"m"`, `"l+xl"`…). */
  docks?: Record<string, number>;
  turrets?: Partial<Record<MountSize, number>>;
  shields?: Partial<Record<MountSize, number>>;
}

interface GeneratedModule extends ModuleStats {
  class: string;
  box: { center: Vec3Tuple; size: Vec3Tuple };
  snaps: Record<string, ModuleSnap>;
}

const GAME_DATA = generated as unknown as Record<string, GeneratedModule>;

const CLASS_CATEGORY: Record<string, CategoryId> = {
  production: "production",
  storage: "storage",
  habitation: "habitat",
  connectionmodule: "structure",
  dockarea: "dock",
  pier: "pier",
  defencemodule: "defence",
};

export interface ModuleInfo {
  macro: string;
  category: CategoryId;
  kind: ModuleKind;
  /** Size class shown next to the name (storage, habitats, docks), or null. */
  size: SizeClass | null;
  /** Id of the ware produced (e.g. `energycells`), production modules only. */
  ware?: string;
  shape: ModuleShape;
  /** `true` if shape and snaps come from game data; `false` if estimated. */
  measured: boolean;
  /** Connection snaps by lowercase name (`connectionsnap001`…). Empty without game data. */
  snaps: Record<string, ModuleSnap>;
  /** Gameplay stats; empty without game data. */
  stats: ModuleStats;
}

type EstimatedInfo = Omit<ModuleInfo, "measured" | "snaps" | "stats">;

function sizeClass(id: string): SizeClass | null {
  const match = id.match(/_(xl|s|m|l)_/);
  return (match?.[1] as SizeClass) ?? null;
}

function box(x: number, y: number, z: number): ModuleShape {
  return { kind: "box", size: [x, y, z] };
}

export function describeModule(macro: string): ModuleInfo {
  const estimated = estimateModule(macro);
  const data = GAME_DATA[macro.toLowerCase()];
  if (!data) return { ...estimated, measured: false, snaps: {}, stats: {} };

  const { class: cls, box, snaps, ...stats } = data;
  const category = CLASS_CATEGORY[cls] ?? estimated.category;
  const ware = stats.production?.[0]?.ware ?? estimated.ware;
  return {
    ...estimated,
    category,
    kind: category === "production" ? "production" : estimated.kind,
    ...(ware ? { ware } : {}),
    shape: { kind: "box", size: box.size, center: box.center },
    measured: true,
    snaps,
    stats,
  };
}

/** Info deduced from the macro name alone, with an approximate shape. */
function estimateModule(macro: string): EstimatedInfo {
  const id = macro.toLowerCase().replace(/_macro$/, "");
  const size = sizeClass(id);
  const base = { macro, size: null };

  if (id.startsWith("prod_")) {
    // prod_<race|gen>_<ware>[_variant]
    const ware = id.split("_")[2] || undefined;
    return { ...base, category: "production", kind: "production", ware, shape: box(2400, 500, 500) };
  }

  if (id.startsWith("storage_")) {
    const kind: ModuleKind = id.includes("container")
      ? "storageContainer"
      : id.includes("liquid")
        ? "storageLiquid"
        : id.includes("solid")
          ? "storageSolid"
          : "storage";
    const shape = size === "s" ? box(300, 300, 800) : size === "l" ? box(1200, 1200, 1200) : box(800, 800, 800);
    return { ...base, category: "storage", kind, size, shape };
  }

  if (id.startsWith("hab_")) {
    const diameter = size === "s" ? 600 : size === "l" ? 1300 : 950;
    return {
      ...base,
      category: "habitat",
      kind: "habitat",
      size,
      shape: { kind: "cylinderY", size: [diameter, 800, diameter] },
    };
  }

  if (id.startsWith("struct_")) {
    const long = id.endsWith("_02");
    if (id.includes("cross")) return { ...base, category: "structure", kind: "crossConnector", shape: box(400, 400, 400) };
    if (id.includes("vertical")) {
      return {
        ...base,
        category: "structure",
        kind: long ? "verticalConnectorLong" : "verticalConnectorShort",
        shape: box(200, long ? 800 : 400, 200),
      };
    }
    if (id.includes("base")) {
      return {
        ...base,
        category: "structure",
        kind: long ? "straightConnectorLong" : "straightConnectorShort",
        shape: box(200, 200, long ? 800 : 400),
      };
    }
    return { ...base, category: "structure", kind: "structure", shape: box(400, 400, 400) };
  }

  if (id.startsWith("dockarea_")) {
    return { ...base, category: "dock", kind: "dock", size, shape: box(400, 250, 1600) };
  }

  if (id.startsWith("pier_")) {
    return {
      ...base,
      category: "pier",
      kind: id.includes("harbor") ? "harborPier" : "pier",
      shape: box(1200, 400, 1200),
    };
  }

  if (id.startsWith("defence_")) {
    return {
      ...base,
      category: "defence",
      kind: "defence",
      shape: { kind: "cylinderZ", size: [300, 300, 400] },
    };
  }

  return { ...base, category: "other", kind: "other", shape: box(400, 400, 400) };
}
