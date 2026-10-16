/**
 * Ware recipes from `wares.generated.json` (built by `pnpm extract-game-data`).
 */

import generated from "./wares.generated.json";

export interface Recipe {
  /** Cycle length in seconds. */
  time: number;
  /** Units produced per cycle. */
  amount: number;
  /** Units consumed per cycle, by ware id. */
  inputs: Record<string, number>;
  /** Extra output at full workforce, as a fraction (0.37 → +37 %). */
  workBonus?: number;
}

export interface WareData {
  transport: string;
  volume: number;
  price?: { min: number; average: number; max: number };
  /** Recipes by method (`default`, `teladi`, `recycling`…). */
  recipes: Record<string, Recipe>;
}

const WARES = generated as unknown as Record<string, WareData>;

export function wareData(id: string): WareData | null {
  return WARES[id] ?? null;
}

export interface ProductionRate {
  ware: string;
  /** Output per hour without workforce. */
  perHour: number;
  /** Output per hour at full workforce. */
  perHourWithWorkforce: number;
  /** Consumption per hour by ware id (does not change with workforce). */
  inputsPerHour: Record<string, number>;
}

/** Hourly output and input of one module making `ware` with `method`, or null if the recipe is unknown. */
export function productionRate(ware: string, method = "default"): ProductionRate | null {
  const recipe = WARES[ware]?.recipes[method] ?? WARES[ware]?.recipes.default;
  if (!recipe || !recipe.time) return null;
  const cycles = 3600 / recipe.time;
  return {
    ware,
    perHour: recipe.amount * cycles,
    perHourWithWorkforce: recipe.amount * cycles * (1 + (recipe.workBonus ?? 0)),
    inputsPerHour: Object.fromEntries(Object.entries(recipe.inputs).map(([id, amount]) => [id, amount * cycles])),
  };
}
