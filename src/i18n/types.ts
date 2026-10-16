import type { CategoryId, ModuleKind } from "../catalog/modules";
import type { PlanParseErrorCode } from "../plan/parse";

/**
 * Shape every language dictionary must have. Strings may contain `{name}`
 * placeholders, which `t()` fills in.
 */
export interface Messages {
  /** Language name in that language, for the language selector. */
  languageName: string;
  ui: {
    title: string;
    eyebrow: string;
    choosePlan: string;
    untitledPlan: string;
    statModules: string;
    statProduction: string;
    statSize: string;
    moduleTypes: string;
    showModules: string;
    production: string;
    selectedModule: string;
    openXml: string;
    exportXml: string;
    exportTitle: string;
    exportCurrent: string;
    /** `{count}` plans loaded. */
    exportAll: string;
    copyXml: string;
    copied: string;
    copyFailed: string;
    saveXml: string;
    saved: string;
    downloaded: string;
    saveFailed: string;
    xmlFileType: string;
    close: string;
    fit: string;
    links: string;
    language: string;
    /** Trusted HTML: may contain markup. */
    note: string;
    hint: string;
    drop: string;
    emptyDetail: string;
    focusModule: string;
    deleteModule: string;
    /** Deletes a module and everything attached to it; `{count}` modules in all. */
    deleteSequence: string;
    deleteSequenceTitle: string;
    /** `{name}` and `{index}` of the module, `{count}` modules attached to it. */
    deleteSequenceMessage: string;
    /** Same with a single module attached. */
    deleteSequenceMessageOne: string;
    /** `{count}` modules in all. */
    deleteSequenceConfirm: string;
    cancel: string;
    index: string;
    position: string;
    rotation: string;
    dimensions: string;
    /** `{size}` is the dimensions; `{source}` is `measuredFromGame` or `measuredEstimated`. */
    dimensionsValue: string;
    measuredFromGame: string;
    measuredEstimated: string;
    attachedTo: string;
    followedBy: string;
    noPredecessor: string;
    race: string;
    hull: string;
    workforce: string;
    /** `{count}` workers housed, `{race}` their race. */
    workforceHoused: string;
    /** `{count}` workers needed. */
    workforceRequired: string;
    /** Summary: `{capacity}` housed of `{needed}` needed. */
    workforceBalance: string;
    storage: string;
    /** `{capacity}` in m³, `{types}` the cargo types. */
    storageValue: string;
    produces: string;
    /** `{rate}` per hour without workforce, `{max}` at full workforce. */
    perHour: string;
    consumes: string;
    docks: string;
    turrets: string;
    shields: string;
  };
  /** Storage transport types. */
  cargoTypes: Record<string, string>;
  categories: Record<CategoryId, string>;
  /**
   * Fallback module names for macros without a game name. `{ware}` and
   * `{macro}` are filled in; the size class is appended when known.
   */
  modules: Record<ModuleKind, string>;
  errors: Record<PlanParseErrorCode, string>;
}
