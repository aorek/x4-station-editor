#!/usr/bin/env node
/**
 * Extracts the data the viewer needs from the game install.
 *
 *   pnpm extract-game-data "<X4 Foundations folder>"
 *
 * Reads the .cat/.dat catalogs of the base game and extensions directly (no
 * XRCatTool needed) and writes:
 *
 * - src/catalog/modules.generated.json: class, gameplay stats (workforce,
 *   cargo, production, docks, turrets…), bounding box and connection snaps of
 *   every station module.
 * - src/catalog/wares.generated.json: transport, volume, prices and recipes
 *   of every economy ware.
 * - src/i18n/texts.generated.json: ware, module and race names in each
 *   supported language.
 *
 * No models or other game assets are copied.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

/** Macro classes that are station modules. */
const MODULE_CLASSES = new Set([
  "buildmodule",
  "connectionmodule",
  "defencemodule",
  "dockarea",
  "habitation",
  "pier",
  "processingmodule",
  "production",
  "storage",
  "welfaremodule",
]);

/** Supported locale → X4 language id (the NNN in t/0001-lNNN.xml). */
const LANGUAGES = { en: 44, es: 34 };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODULES_OUTPUT = path.join(ROOT, "src/catalog/modules.generated.json");
const WARES_OUTPUT = path.join(ROOT, "src/catalog/wares.generated.json");
const TEXTS_OUTPUT = path.join(ROOT, "src/i18n/texts.generated.json");

const gameDir = process.argv[2];
if (!gameDir || !fs.existsSync(path.join(gameDir, "01.cat"))) {
  console.error('Usage: pnpm extract-game-data "<X4 Foundations folder>" (the one containing 01.cat)');
  process.exit(1);
}

// --- Catalogs ----------------------------------------------------------------

/** Virtual path (lowercase, with /) → where it lives inside a .dat. */
const files = new Map();

function loadCatalogs(dir, prefix) {
  const cats = fs
    .readdirSync(dir)
    .filter((f) => /^(ext_)?\d+\.cat$/i.test(f))
    .sort();
  for (const cat of cats) {
    const dat = path.join(dir, cat.replace(/\.cat$/i, ".dat"));
    let offset = 0;
    for (const line of fs.readFileSync(path.join(dir, cat), "utf8").split("\n")) {
      // <path, may contain spaces> <size> <timestamp> <md5>
      const m = line.match(/^(.+) (\d+) (\d+) [0-9a-f]{32}\s*$/i);
      if (!m) continue;
      const size = Number(m[2]);
      files.set((prefix + m[1]).toLowerCase(), { dat, offset, size });
      offset += size;
    }
  }
}

function readFile(virtualPath) {
  const entry = files.get(virtualPath.toLowerCase().replace(/\\/g, "/"));
  if (!entry) return null;
  const buffer = Buffer.alloc(entry.size);
  const fd = fs.openSync(entry.dat, "r");
  try {
    fs.readSync(fd, buffer, 0, entry.size, entry.offset);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString("utf8").replace(/^﻿/, "");
}

loadCatalogs(gameDir, "");
const extensionsDir = path.join(gameDir, "extensions");
const extensions = fs.existsSync(extensionsDir)
  ? fs.readdirSync(extensionsDir).filter((d) => fs.statSync(path.join(extensionsDir, d)).isDirectory())
  : [];
for (const ext of extensions) loadCatalogs(path.join(extensionsDir, ext), `extensions/${ext}/`);

// --- Indexes -----------------------------------------------------------------

/**
 * Reads index/macros.xml or index/components.xml from the base game and each
 * extension. Extensions ship them as <diff> patches, but entries have the
 * same shape, so collecting every <entry name value> is enough.
 */
function loadIndex(name) {
  const index = new Map();
  const sources = [`index/${name}.xml`, ...extensions.map((ext) => `extensions/${ext}/index/${name}.xml`)];
  for (const source of sources) {
    const text = readFile(source);
    if (!text) continue;
    for (const m of text.matchAll(/<entry\s+name="([^"]+)"\s+value="([^"]+)"/g)) {
      index.set(m[1].toLowerCase(), m[2].replace(/\\/g, "/"));
    }
  }
  return index;
}

const macroIndex = loadIndex("macros");
const componentIndex = loadIndex("components");

// --- XML ---------------------------------------------------------------------

const parser = new new JSDOM("").window.DOMParser();

function parseXml(text) {
  const doc = parser.parseFromString(text, "application/xml");
  return doc.querySelector("parsererror") ? null : doc;
}

const num = (el, attr, fallback = 0) => {
  const value = el?.getAttribute(attr);
  return value == null || value === "" ? fallback : Number(value);
};

/** Rounds so the JSON carries no floating-point noise. */
const round = (n, digits = 3) => {
  const r = Number(n.toFixed(digits));
  return Object.is(r, -0) ? 0 : r;
};

const vec = (el) => [round(num(el, "x")), round(num(el, "y")), round(num(el, "z"))];

function quat(el) {
  if (!el) return [0, 0, 0, 1];
  const q = [num(el, "qx"), num(el, "qy"), num(el, "qz"), num(el, "qw", 1)];
  const len = Math.hypot(...q) || 1;
  // q and -q are the same rotation: store it with w ≥ 0 so output is stable.
  const sign = q[3] < 0 ? -1 : 1;
  return q.map((c) => round((sign * c) / len, 6));
}

// --- Extraction --------------------------------------------------------------

/**
 * Module bounding box in its local space: that of the main part
 * (`part_main`) or, if there is none, the union of the parts with collision.
 */
function moduleBox(component) {
  const parts = [];
  for (const connection of component.querySelectorAll(":scope > connections > connection")) {
    const tags = (connection.getAttribute("tags") ?? "").split(/\s+/);
    if (!tags.includes("part")) continue;
    const offset = connection.querySelector(":scope > offset > position");
    for (const part of connection.querySelectorAll(":scope > parts > part")) {
      const size = part.querySelector(":scope > size");
      if (!size) continue;
      const max = vec(size.querySelector("max"));
      const center = vec(size.querySelector("center"));
      const shift = vec(offset);
      parts.push({
        name: part.getAttribute("name"),
        solid: !tags.includes("nocollision"),
        min: center.map((c, i) => c + shift[i] - max[i]),
        max: center.map((c, i) => c + shift[i] + max[i]),
      });
    }
  }
  const main = parts.filter((p) => p.name === "part_main");
  const chosen = main.length ? main : parts.filter((p) => p.solid);
  if (!chosen.length) return null;
  const min = [0, 1, 2].map((i) => Math.min(...chosen.map((p) => p.min[i])));
  const max = [0, 1, 2].map((i) => Math.max(...chosen.map((p) => p.max[i])));
  return {
    center: min.map((v, i) => round((v + max[i]) / 2, 2)),
    size: min.map((v, i) => round(max[i] - v, 2)),
  };
}

/** Connection snaps (`ConnectionSnapNNN`), with lowercase names as in plans. */
function moduleSnaps(component) {
  const snaps = {};
  for (const connection of component.querySelectorAll(":scope > connections > connection")) {
    const tags = (connection.getAttribute("tags") ?? "").split(/\s+/);
    if (!tags.includes("snap")) continue;
    const offset = connection.querySelector(":scope > offset");
    snaps[connection.getAttribute("name").toLowerCase()] = {
      position: vec(offset?.querySelector("position")),
      quaternion: quat(offset?.querySelector("quaternion")),
    };
  }
  return snaps;
}

const tagsOf = (el) => (el?.getAttribute("tags") ?? "").split(/\s+/).filter(Boolean);

/** Reads a macro by name, or null. */
function readMacro(name) {
  const macroPath = macroIndex.get(name.toLowerCase());
  const text = macroPath && readFile(`${macroPath}.xml`);
  return (text && parseXml(text)?.querySelector("macros > macro")) || null;
}

const SHIP_SIZES = ["xs", "s", "m", "l", "xl"];
const dockSizeCache = new Map();

/**
 * Ship sizes an external docking bay macro takes, e.g. `["m"]` or `["l", "xl"]`.
 * Internal hangars (`<dock external="0" storage="1">`) do not count.
 */
function dockSizes(bayMacro) {
  if (!dockSizeCache.has(bayMacro)) {
    const macro = readMacro(bayMacro);
    const dock = macro?.querySelector(":scope > properties > dock");
    const sizes =
      macro?.getAttribute("class") === "dockingbay" && dock?.getAttribute("external") !== "0"
        ? tagsOf(macro.querySelector(":scope > properties > docksize"))
            .map((tag) => tag.replace(/^dock_/, ""))
            .filter((size) => SHIP_SIZES.includes(size))
            .sort((a, b) => SHIP_SIZES.indexOf(a) - SHIP_SIZES.indexOf(b))
        : [];
    dockSizeCache.set(bayMacro, sizes);
  }
  return dockSizeCache.get(bayMacro);
}

/** Docking bays by size group (`"m"`, `"l+xl"`…), excluding XS drone docks. */
function moduleDocks(macro) {
  const docks = {};
  for (const ref of macro.querySelectorAll(":scope > connections > connection > macro[ref]")) {
    const sizes = dockSizes(ref.getAttribute("ref")).filter((size) => size !== "xs");
    if (!sizes.length) continue;
    const key = sizes.join("+");
    docks[key] = (docks[key] ?? 0) + 1;
  }
  return docks;
}

/** Turret and shield mount points by size, anywhere in the component. */
function moduleMounts(component) {
  const turrets = {};
  const shields = {};
  for (const connection of component.querySelectorAll("connection[tags]")) {
    const tags = tagsOf(connection);
    const target = tags.includes("turret") ? turrets : tags.includes("shield") ? shields : null;
    const size = ["small", "medium", "large", "extralarge"].find((s) => tags.includes(s));
    if (target && size) target[size] = (target[size] ?? 0) + 1;
  }
  return { turrets, shields };
}

/** Gameplay properties of a module macro; absent fields are omitted. */
function moduleStats(macro) {
  const props = macro.querySelector(":scope > properties");
  const identification = props?.querySelector(":scope > identification");
  const workforce = props?.querySelector(":scope > workforce");
  const cargo = props?.querySelector(":scope > cargo");
  const production = props?.querySelector(":scope > production");
  const stats = {};

  const race = identification?.getAttribute("makerrace");
  if (race) stats.race = race;
  const hull = num(props?.querySelector(":scope > hull"), "max");
  if (hull) stats.hull = hull;

  if (workforce?.hasAttribute("capacity")) {
    stats.workforce = { capacity: num(workforce, "capacity"), race: workforce.getAttribute("race") ?? race ?? null };
  }
  if (workforce?.hasAttribute("max")) stats.workforceNeeded = num(workforce, "max");

  if (cargo) stats.cargo = { capacity: num(cargo, "max"), types: tagsOf(cargo) };

  if (production) {
    // Each <queue> item is a ware and its recipe; an empty queue means every listed ware with the default recipe.
    const queued = [...production.querySelectorAll(":scope > queue[ware], :scope > queue > [ware]")].map((item) => ({
      ware: item.getAttribute("ware"),
      method: item.getAttribute("method") || "default",
    }));
    const listed = (production.getAttribute("wares") ?? "").split(/\s+/).filter(Boolean);
    stats.production = queued.length ? queued : listed.map((ware) => ({ ware, method: "default" }));
  }
  return stats;
}

const modules = {};
const moduleNameRefs = {};
const skipped = [];

for (const [macroName, macroPath] of [...macroIndex].sort(([a], [b]) => a.localeCompare(b))) {
  if (!macroPath.includes("assets/structures/")) continue;
  const macro = readMacro(macroName);
  const cls = macro?.getAttribute("class");
  if (!macro || !MODULE_CLASSES.has(cls)) continue;

  const componentName = macro.querySelector(":scope > component")?.getAttribute("ref")?.toLowerCase();
  const componentPath = componentName && componentIndex.get(componentName);
  const componentText = componentPath && readFile(`${componentPath}.xml`);
  const component = componentText && parseXml(componentText)?.querySelector("components > component");
  const box = component && moduleBox(component);
  if (!box) {
    skipped.push(macroName);
    continue;
  }

  const { turrets, shields } = moduleMounts(component);
  const docks = moduleDocks(macro);
  modules[macroName] = {
    class: cls,
    ...moduleStats(macro),
    ...(Object.keys(docks).length ? { docks } : {}),
    ...(Object.keys(turrets).length ? { turrets } : {}),
    ...(Object.keys(shields).length ? { shields } : {}),
    box,
    snaps: moduleSnaps(component),
  };
  const nameRef = macro.querySelector(":scope > properties > identification")?.getAttribute("name");
  if (nameRef) moduleNameRefs[macroName] = nameRef;
}

const byClass = {};
for (const m of Object.values(modules)) byClass[m.class] = (byClass[m.class] ?? 0) + 1;

fs.writeFileSync(MODULES_OUTPUT, JSON.stringify(modules, null, 1) + "\n");
console.log(`${Object.keys(modules).length} modules → ${path.relative(process.cwd(), MODULES_OUTPUT)}`);
console.log(byClass);
if (skipped.length) console.log(`No bounding box (skipped): ${skipped.join(", ")}`);

// --- Wares -------------------------------------------------------------------

/** Elements matching `selector` in a library file of the base game and every DLC patch. */
function libraryElements(file, selector) {
  const elements = [];
  for (const source of [file, ...extensions.map((ext) => `extensions/${ext}/${file}`)]) {
    const text = readFile(source);
    if (text) elements.push(...(parseXml(text)?.querySelectorAll(selector) ?? []));
  }
  return elements;
}

/** `<ware>` elements by id; later DLC definitions replace earlier ones. */
const allWares = new Map(libraryElements("libraries/wares.xml", "ware[id]").map((w) => [w.getAttribute("id"), w]));

// Only goods that are traded and produced: wares tagged `economy`.
const economyWares = [...allWares]
  .filter(([, ware]) => tagsOf(ware).includes("economy"))
  .sort(([a], [b]) => a.localeCompare(b));

const wares = {};
for (const [id, ware] of economyWares) {
  const price = ware.querySelector(":scope > price");
  const recipes = {};
  for (const production of ware.querySelectorAll(":scope > production")) {
    const inputs = {};
    for (const input of production.querySelectorAll(":scope > primary > ware")) {
      inputs[input.getAttribute("ware")] = num(input, "amount");
    }
    const work = production.querySelector(':scope > effects > effect[type="work"]');
    recipes[production.getAttribute("method") || "default"] = {
      time: num(production, "time"),
      amount: num(production, "amount"),
      inputs,
      // Output bonus at full workforce (0.37 → +37 %).
      ...(work ? { workBonus: num(work, "product") } : {}),
    };
  }
  wares[id] = {
    transport: ware.getAttribute("transport"),
    volume: num(ware, "volume"),
    ...(price ? { price: { min: num(price, "min"), average: num(price, "average"), max: num(price, "max") } } : {}),
    recipes,
  };
}

fs.writeFileSync(WARES_OUTPUT, JSON.stringify(wares, null, 1) + "\n");
console.log(`${Object.keys(wares).length} wares → ${path.relative(process.cwd(), WARES_OUTPUT)}`);

// --- Texts -------------------------------------------------------------------

/**
 * Text pages of one language: page id → text id → raw string. DLC texts ship
 * in the base game's files, but extension files are merged too in case they
 * add pages.
 */
function loadTexts(languageId) {
  const file = `t/0001-l${String(languageId).padStart(3, "0")}.xml`;
  const pages = new Map();
  for (const source of [file, ...extensions.map((ext) => `extensions/${ext}/${file}`)]) {
    const text = readFile(source);
    if (!text) continue;
    for (const page of parseXml(text)?.querySelectorAll("page") ?? []) {
      const entries = pages.get(page.getAttribute("id")) ?? new Map();
      for (const t of page.querySelectorAll(":scope > t")) entries.set(t.getAttribute("id"), t.textContent ?? "");
      pages.set(page.getAttribute("id"), entries);
    }
  }
  return pages;
}

/**
 * Resolves a text the way the game shows it: expands `{page,id}` references,
 * drops `(comments)` meant for translators and unescapes `\(` and `\)`.
 * Returns null if it cannot be resolved.
 */
function resolveText(pages, raw, depth = 0) {
  if (!raw || depth > 10) return null;
  const expanded = raw.replace(/\{(\d+),\s*(\d+)\}/g, (match, page, id) => {
    const value = pages.get(page)?.get(id);
    return value == null ? match : (resolveText(pages, value, depth + 1) ?? match);
  });
  const text = expanded
    .replace(/(?<!\\)\([^()]*?(?<!\\)\)/g, "")
    .replace(/\\([()])/g, "$1")
    .trim();
  return text && !/\{\d+,\s*\d+\}/.test(text) ? text : null;
}

const raceNameRefs = Object.fromEntries(
  libraryElements("libraries/races.xml", "race[id][name]").map((r) => [r.getAttribute("id"), r.getAttribute("name")]),
);

/** Resolves every `id → {page,id}` reference in `refs`, dropping the ones without text. */
function resolveAll(pages, refs) {
  const out = {};
  for (const [id, ref] of Object.entries(refs)) {
    const text = resolveText(pages, ref);
    if (text) out[id] = text;
  }
  return out;
}

const texts = {};
for (const [locale, languageId] of Object.entries(LANGUAGES)) {
  const pages = loadTexts(languageId);
  texts[locale] = {
    wares: resolveAll(pages, Object.fromEntries(economyWares.map(([id, w]) => [id, w.getAttribute("name")]))),
    modules: resolveAll(pages, moduleNameRefs),
    races: resolveAll(pages, raceNameRefs),
  };
}

fs.writeFileSync(TEXTS_OUTPUT, JSON.stringify(texts, null, 1) + "\n");
console.log(
  `Texts → ${path.relative(process.cwd(), TEXTS_OUTPUT)}:`,
  Object.entries(texts)
    .map(([locale, t]) => `${locale} (${Object.entries(t).map(([k, v]) => `${Object.keys(v).length} ${k}`).join(", ")})`)
    .join("; "),
);
