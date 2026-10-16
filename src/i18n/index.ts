import type { CategoryId, ModuleInfo } from "../catalog/modules";
import { PlanParseError } from "../plan/parse";
import { en } from "./en";
import { es } from "./es";
import type { Messages } from "./types";
import generatedTexts from "./texts.generated.json";

export const DICTIONARIES = { en, es } satisfies Record<string, Messages>;
export type Locale = keyof typeof DICTIONARIES;
export const LOCALES = Object.keys(DICTIONARIES) as Locale[];

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && value in DICTIONARIES;
}

/** First browser language we have a dictionary for, else English. */
export function detectLocale(languages: readonly string[] = browserLanguages()): Locale {
  for (const language of languages) {
    const short = language.toLowerCase().split("-")[0];
    if (isLocale(short)) return short;
  }
  return "en";
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === "undefined") return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

const STORAGE_KEY = "x4sv.locale";

/** Language picked in the selector, if any. Storage may be unavailable (private mode, blocked site data). */
function savedLocale(): Locale | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLocale(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** The browser language sets the default; the selector can override it. */
let current: Locale = savedLocale() ?? detectLocale();
const listeners = new Set<(locale: Locale) => void>();

export function getLocale(): Locale {
  return current;
}

export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Not remembered; it still applies until the page is reloaded.
  }
  for (const listener of listeners) listener(locale);
}

export function onLocaleChange(listener: (locale: Locale) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Name of each language in that language, for the selector. */
export function localeNames(): Array<{ locale: Locale; name: string }> {
  return LOCALES.map((locale) => ({ locale, name: DICTIONARIES[locale].languageName }));
}

function messages(): Messages {
  return DICTIONARIES[current];
}

function format(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

export type UiKey = keyof Messages["ui"];

export function t(key: UiKey, params?: Record<string, string | number>): string {
  return format(messages().ui[key], params);
}

export function categoryLabel(id: CategoryId): string {
  return messages().categories[id];
}

/** Names taken from the game texts by `pnpm extract-game-data`. */
interface GameTexts {
  wares: Record<string, string>;
  modules: Record<string, string>;
  races: Record<string, string>;
}

const GAME_TEXTS = generatedTexts as unknown as Record<Locale, GameTexts>;

/** Ware name from the game; unknown ids are shown as-is. */
export function wareName(id: string): string {
  return GAME_TEXTS[current].wares[id] ?? id;
}

/** Race name from the game; unknown ids are shown as-is. */
export function raceName(id: string): string {
  return GAME_TEXTS[current].races[id] ?? id;
}

export function cargoTypeName(type: string): string {
  return messages().cargoTypes[type] ?? type;
}

/** Formats a number for the current language (thousands separators, at most `digits` decimals). */
export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat(current, { maximumFractionDigits: digits }).format(value);
}

/**
 * Module name from the game texts, or, for macros the game data does not know
 * (e.g. mods), one built from its kind, ware and size class.
 */
export function moduleName(info: Pick<ModuleInfo, "kind" | "size" | "ware" | "macro">): string {
  const gameName = GAME_TEXTS[current].modules[info.macro.toLowerCase()];
  if (gameName) return gameName;
  const name = format(messages().modules[info.kind], {
    ware: info.ware ? wareName(info.ware) : "?",
    macro: info.macro,
  });
  return info.size ? `${name} ${info.size.toUpperCase()}` : name;
}

export function errorMessage(error: unknown): string {
  if (error instanceof PlanParseError) return messages().errors[error.code];
  return error instanceof Error ? error.message : String(error);
}

/**
 * Fills static texts in the page from `data-i18n*` attributes:
 * `data-i18n` (text), `data-i18n-html` (trusted dictionary HTML) and
 * `data-i18n-aria-label`.
 */
export function applyStaticTexts(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n as UiKey);
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-html]")) {
    el.innerHTML = t(el.dataset.i18nHtml as UiKey);
  }
  for (const el of root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel as UiKey));
  }
  document.documentElement.lang = current;
  document.title = t("title");
}
