import { describe, expect, it } from "vitest";
import modules from "../src/catalog/modules.generated.json";
import texts from "../src/i18n/texts.generated.json";
import { describeModule } from "../src/catalog/modules";
import { DICTIONARIES, detectLocale, errorMessage, moduleName } from "../src/i18n";
import { PlanParseError } from "../src/plan/parse";

/** Every key path in an object, e.g. `ui.title`. */
function keyPaths(value: object, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object" && child !== null ? keyPaths(child, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe("dictionaries", () => {
  it("all languages have the same keys", () => {
    const [reference, ...others] = Object.values(DICTIONARIES).map((d) => keyPaths(d).sort());
    for (const keys of others) expect(keys).toEqual(reference);
  });

  it("have game ware names for every ware a module produces", () => {
    const produced = new Set(
      Object.values(modules as Record<string, { production?: Array<{ ware: string }> }>).flatMap(
        (m) => m.production?.map((p) => p.ware) ?? [],
      ),
    );
    for (const locale of Object.keys(DICTIONARIES)) {
      const names = (texts as Record<string, { wares: Record<string, string> }>)[locale]?.wares;
      expect(names, locale).toBeDefined();
      expect([...produced].filter((w) => !names[w]), locale).toEqual([]);
    }
  });
});

describe("detectLocale", () => {
  it("takes the first browser language with a dictionary", () => {
    expect(detectLocale(["es-ES", "en"])).toBe("es");
    expect(detectLocale(["fr-FR", "en-GB"])).toBe("en");
  });

  it("falls back to English", () => {
    expect(detectLocale(["fr", "de"])).toBe("en");
    expect(detectLocale([])).toBe("en");
  });
});

// jsdom reports an English browser, so these use the English dictionary.
describe("translated names", () => {
  it("uses the game's module names", () => {
    expect(moduleName(describeModule("prod_gen_energycells_macro"))).toBe("Energy Cell Production");
    expect(moduleName(describeModule("hab_arg_m_01_macro"))).toBe("Argon M Habitat");
  });

  it("builds a name for macros the game data does not know", () => {
    expect(moduleName(describeModule("prod_mod_madeup_macro"))).toBe("Production: madeup");
    expect(moduleName(describeModule("storage_mod_m_container_01_macro"))).toBe("Container Storage M");
  });

  it("translates parse errors by code", () => {
    expect(errorMessage(new PlanParseError("noPlans"))).toBe(DICTIONARIES.en.errors.noPlans);
  });
});
