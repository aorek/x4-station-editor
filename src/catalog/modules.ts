/**
 * Catálogo provisional de módulos.
 *
 * Los tamaños están ESTIMADOS a partir de las distancias entre módulos
 * conectados en planos reales. Cuando haya un extractor de datos del juego,
 * este archivo se sustituirá por medidas y puntos de anclaje reales.
 */

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
  label: string;
  color: number;
}

export const CATEGORIES: Record<CategoryId, Category> = {
  production: { id: "production", label: "Producción", color: 0xf0a64b },
  storage: { id: "storage", label: "Almacenes", color: 0x4fb3a9 },
  habitat: { id: "habitat", label: "Habitáculos", color: 0xe58fb0 },
  structure: { id: "structure", label: "Estructura", color: 0x7f93ad },
  dock: { id: "dock", label: "Muelles", color: 0x9d8cf0 },
  pier: { id: "pier", label: "Embarcaderos", color: 0x6cb6f5 },
  defence: { id: "defence", label: "Defensa", color: 0xe0614f },
  other: { id: "other", label: "Otros", color: 0xb7b7b7 },
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

/** Forma aproximada. `size` es [x, y, z] en metros en el espacio local del módulo. */
export interface ModuleShape {
  kind: "box" | "cylinderY" | "cylinderZ";
  size: [number, number, number];
}

export interface ModuleInfo {
  macro: string;
  category: CategoryId;
  name: string;
  /** Mercancía producida, solo para módulos de producción. */
  ware?: string;
  shape: ModuleShape;
}

const WARES: Record<string, string> = {
  advancedcomposites: "Compuestos avanzados",
  advancedelectronics: "Electrónica avanzada",
  antimattercells: "Celdas de antimateria",
  antimatterconverters: "Convertidores de antimateria",
  bogas: "Bogas",
  bofu: "Bofu",
  cheltmeat: "Carne de Chelt",
  claytronics: "Claytrónica",
  computronicsubstrate: "Sustrato computrónico",
  dronecomponents: "Componentes de dron",
  energycells: "Celdas de energía",
  engineparts: "Piezas de motor",
  fieldcoils: "Bobinas de campo",
  foodrations: "Raciones de comida",
  graphene: "Grafeno",
  hullparts: "Piezas de casco",
  majadust: "Polvo Maja",
  majasnails: "Caracoles Maja",
  meat: "Carne",
  medicalsupplies: "Suministros médicos",
  metallicmicrolattice: "Microrretícula metálica",
  microchips: "Microchips",
  missilecomponents: "Componentes de misil",
  nostropoil: "Aceite Nostrop",
  plankton: "Plancton",
  plasmaconductors: "Conductores de plasma",
  proteinpaste: "Pasta proteica",
  quantumtubes: "Tubos cuánticos",
  refinedmetals: "Metales refinados",
  scanningarrays: "Matrices de escaneo",
  scruffinfruits: "Frutas Scruffin",
  shieldcomponents: "Componentes de escudo",
  siliconcarbide: "Carburo de silicio",
  siliconwafers: "Obleas de silicio",
  smartchips: "Chips inteligentes",
  sojabeans: "Habas de soja",
  sojahusk: "Cáscara de soja",
  spacefuel: "Combustible espacial",
  spices: "Especias",
  stimulants: "Estimulantes",
  sunriseflowers: "Flores Amanecer",
  superfluidcoolant: "Refrigerante superfluido",
  swampplant: "Planta de pantano",
  terranmre: "Raciones terranas",
  turretcomponents: "Componentes de torreta",
  water: "Agua",
  weaponcomponents: "Componentes de armas",
  wheat: "Trigo",
};

type SizeClass = "s" | "m" | "l" | "xl" | null;

function sizeClass(id: string): SizeClass {
  const match = id.match(/_(xl|s|m|l)_/);
  return (match?.[1] as SizeClass) ?? null;
}

const SIZE_LABEL: Record<Exclude<SizeClass, null>, string> = { s: "S", m: "M", l: "L", xl: "XL" };

function withSize(name: string, size: SizeClass): string {
  return size ? `${name} ${SIZE_LABEL[size]}` : name;
}

function box(x: number, y: number, z: number): ModuleShape {
  return { kind: "box", size: [x, y, z] };
}

export function describeModule(macro: string): ModuleInfo {
  const id = macro.toLowerCase().replace(/_macro$/, "");
  const size = sizeClass(id);

  if (id.startsWith("prod_")) {
    // prod_<raza|gen>_<mercancía>[_variante]
    const wareKey = id.split("_")[2] ?? "";
    const ware = WARES[wareKey] ?? wareKey;
    return { macro, category: "production", name: `Producción: ${ware}`, ware, shape: box(2400, 500, 500) };
  }

  if (id.startsWith("storage_")) {
    const kind = id.includes("container")
      ? "de contenedores"
      : id.includes("liquid")
        ? "de líquidos"
        : id.includes("solid")
          ? "de sólidos"
          : "";
    const name = withSize(["Almacén", kind].filter(Boolean).join(" "), size);
    const shape = size === "s" ? box(300, 300, 800) : size === "l" ? box(1200, 1200, 1200) : box(800, 800, 800);
    return { macro, category: "storage", name, shape };
  }

  if (id.startsWith("hab_")) {
    const diameter = size === "s" ? 600 : size === "l" ? 1300 : 950;
    return {
      macro,
      category: "habitat",
      name: withSize("Habitáculo", size),
      shape: { kind: "cylinderY", size: [diameter, 800, diameter] },
    };
  }

  if (id.startsWith("struct_")) {
    const long = id.endsWith("_02");
    if (id.includes("cross")) return { macro, category: "structure", name: "Conector en cruz", shape: box(400, 400, 400) };
    if (id.includes("vertical")) {
      return {
        macro,
        category: "structure",
        name: `Conector vertical ${long ? "largo" : "corto"}`,
        shape: box(200, long ? 800 : 400, 200),
      };
    }
    if (id.includes("base")) {
      return {
        macro,
        category: "structure",
        name: `Conector recto ${long ? "largo" : "corto"}`,
        shape: box(200, 200, long ? 800 : 400),
      };
    }
    return { macro, category: "structure", name: "Estructura", shape: box(400, 400, 400) };
  }

  if (id.startsWith("dockarea_")) {
    return { macro, category: "dock", name: withSize("Muelle de atraque", size), shape: box(400, 250, 1600) };
  }

  if (id.startsWith("pier_")) {
    return {
      macro,
      category: "pier",
      name: id.includes("harbor") ? "Embarcadero (puerto)" : "Embarcadero",
      shape: box(1200, 400, 1200),
    };
  }

  if (id.startsWith("defence_")) {
    return {
      macro,
      category: "defence",
      name: "Plataforma de defensa",
      shape: { kind: "cylinderZ", size: [300, 300, 400] },
    };
  }

  return { macro, category: "other", name: macro, shape: box(400, 400, 400) };
}
