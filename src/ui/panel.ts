import { CATEGORIES, CATEGORY_ORDER, describeModule, type CategoryId, type ModuleStats } from "../catalog/modules";
import { productionRate } from "../catalog/wares";
import { FLAGS } from "../i18n/flags";
import {
  cargoTypeName,
  categoryLabel,
  errorMessage,
  formatNumber,
  getLocale,
  localeNames,
  moduleName,
  raceName,
  t,
  wareName,
  type Locale,
} from "../i18n";
import type { PlanSummary } from "../plan/summary";
import type { ConstructionPlan } from "../plan/types";
import type { ModulePick } from "../viewer/StationViewer";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id} in index.html`);
  return el as T;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
const round = (v: number) => Math.round(v).toString();
const fixed = (v: number, digits: number) => String(+v.toFixed(digits));

const SIZE_LABEL: Record<string, string> = { small: "S", medium: "M", large: "L", extralarge: "XL" };

/** `{ m: 1, s: 6 }` → "M ×1 · S ×6"; keys are ship sizes (`s`, `l+xl`) or mount sizes (`large`). */
function sizeCounts(counts: Partial<Record<string, number>>): string {
  return Object.entries(counts)
    .map(([size, n]) => `${SIZE_LABEL[size] ?? size.toUpperCase().replace("+", "/")} ×${n}`)
    .join(" · ");
}

type Row = (label: string, ...value: Array<Node | string>) => HTMLElement[];

/** Detail rows for the module's gameplay stats, only for the ones it has. */
function statRows(stats: ModuleStats, row: Row): HTMLElement[] {
  const rows: HTMLElement[] = [];
  if (stats.race) rows.push(...row(t("race"), raceName(stats.race)));
  if (stats.hull) rows.push(...row(t("hull"), formatNumber(stats.hull)));
  if (stats.workforce) {
    const { capacity, race } = stats.workforce;
    rows.push(...row(t("workforce"), t("workforceHoused", { count: formatNumber(capacity), race: race ? raceName(race) : "—" })));
  }
  if (stats.workforceNeeded) {
    rows.push(...row(t("workforce"), t("workforceRequired", { count: formatNumber(stats.workforceNeeded) })));
  }
  if (stats.cargo) {
    const types = stats.cargo.types.map(cargoTypeName).join(", ");
    rows.push(...row(t("storage"), t("storageValue", { capacity: formatNumber(stats.cargo.capacity), types })));
  }
  for (const { ware, method } of stats.production ?? []) {
    const rate = productionRate(ware, method);
    const amount = rate
      ? ` · ${t("perHour", { rate: formatNumber(rate.perHour), max: formatNumber(rate.perHourWithWorkforce) })}`
      : "";
    rows.push(...row(t("produces"), `${wareName(ware)}${amount}`));
    const inputs = Object.entries(rate?.inputsPerHour ?? {});
    if (inputs.length) {
      rows.push(
        ...row(
          t("consumes"),
          ...inputs.map(([id, perHour]) => el("div", {}, `${wareName(id)} · ${formatNumber(perHour)}/h`)),
        ),
      );
    }
  }
  if (stats.docks) rows.push(...row(t("docks"), sizeCounts(stats.docks)));
  if (stats.turrets) rows.push(...row(t("turrets"), sizeCounts(stats.turrets)));
  if (stats.shields) rows.push(...row(t("shields"), sizeCounts(stats.shields)));
  return rows;
}

/** Show/hide button of the legend: colour chip, label and module count. */
function legendToggle(color: string, label: string, count: number): HTMLButtonElement {
  const chip = el("span", { className: "chip" });
  chip.style.backgroundColor = color;
  return el(
    "button",
    { type: "button", className: "legend-toggle" },
    chip,
    el("span", {}, label),
    el("span", { className: "count" }, String(count)),
  );
}

export const panel = {
  planName: byId<HTMLHeadingElement>("plan-name"),
  planSelect: byId<HTMLSelectElement>("plan-select"),
  legend: byId<HTMLUListElement>("legend"),
  productionSection: byId<HTMLElement>("production-section"),
  productionList: byId<HTMLUListElement>("production-list"),
  workforceSection: byId<HTMLElement>("workforce-section"),
  workforceBalance: byId<HTMLParagraphElement>("workforce-balance"),
  detail: byId<HTMLDivElement>("detail"),
  error: byId<HTMLParagraphElement>("error"),
  tip: byId<HTMLDivElement>("tip"),
  localeSelect: byId<HTMLDivElement>("lang-select"),
  lastError: null as unknown,
  /** Categories whose module list is unfolded; kept across plans and language changes. */
  expanded: new Set<CategoryId>(),

  renderPlanList(plans: ConstructionPlan[], selected = 0): void {
    this.planSelect.replaceChildren(
      ...plans.map((p, i) => el("option", { value: String(i) }, `${p.name || t("untitledPlan")} (${p.entries.length})`)),
    );
    this.planSelect.value = String(selected);
    this.planSelect.hidden = plans.length < 2;
  },

  /** One button per language, with its flag; the current one is checked. */
  renderLocaleSelect(onChange: (locale: Locale) => void): void {
    this.localeSelect.replaceChildren(
      ...localeNames().map(({ locale, name }) => {
        const flag = el("span", { className: "flag", innerHTML: FLAGS[locale] });
        const button = el("button", { type: "button", lang: locale }, flag, el("span", {}, name));
        const checked = locale === getLocale();
        button.setAttribute("role", "radio");
        button.setAttribute("aria-checked", String(checked));
        button.addEventListener("click", () => onChange(locale));
        return button;
      }),
    );
  },

  renderSummary(
    plan: ConstructionPlan,
    summary: PlanSummary,
    sizeMeters: [number, number, number],
    isMacroVisible: (macro: string) => boolean,
    onToggleMacros: (macros: string[], visible: boolean) => void,
  ): void {
    this.planName.textContent = plan.name || t("untitledPlan");
    byId("stat-modules").textContent = String(summary.moduleCount);
    byId("stat-production").textContent = String(summary.byCategory.production ?? 0);
    byId("stat-size").textContent = sizeMeters.map((m) => (m / 1000).toFixed(1)).join("×");

    // Every toggle re-reads visibility after a click, so a category and its modules stay in sync.
    const syncs: Array<() => void> = [];
    const sync = () => syncs.forEach((update) => update());

    this.legend.replaceChildren(
      ...CATEGORY_ORDER.filter((id) => summary.macrosByCategory[id]).map((id) => {
        const color = hex(CATEGORIES[id].color);
        const macros = summary.macrosByCategory[id]!;
        const all = macros.map((m) => m.macro);

        const sub = el(
          "ul",
          { className: "legend-sub", id: `legend-${id}`, hidden: !this.expanded.has(id) },
          ...macros.map(({ macro, count }) => {
            const button = legendToggle(color, moduleName(describeModule(macro)), count);
            syncs.push(() => button.setAttribute("aria-pressed", String(isMacroVisible(macro))));
            button.addEventListener("click", () => {
              onToggleMacros([macro], !isMacroVisible(macro));
              sync();
            });
            return el("li", {}, button);
          }),
        );

        const label = categoryLabel(id);
        const toggle = legendToggle(color, label, summary.byCategory[id] ?? 0);
        syncs.push(() => {
          const shown = all.filter(isMacroVisible).length;
          toggle.setAttribute("aria-pressed", shown === all.length ? "true" : shown === 0 ? "false" : "mixed");
        });
        // All shown → hide them all; otherwise show them all.
        toggle.addEventListener("click", () => {
          onToggleMacros(all, !all.every(isMacroVisible));
          sync();
        });

        const expander = el("button", { type: "button", className: "expander" });
        expander.setAttribute("aria-expanded", String(!sub.hidden));
        expander.setAttribute("aria-controls", sub.id);
        expander.setAttribute("aria-label", t("showModules", { category: label }));
        expander.addEventListener("click", () => {
          sub.hidden = !sub.hidden;
          if (sub.hidden) this.expanded.delete(id);
          else this.expanded.add(id);
          expander.setAttribute("aria-expanded", String(!sub.hidden));
        });

        return el("li", {}, el("div", { className: "legend-row" }, expander, toggle), sub);
      }),
    );
    sync();

    this.productionSection.hidden = summary.production.length === 0;
    this.productionList.replaceChildren(
      ...summary.production.map(({ ware, count, perHour, perHourWithWorkforce }) =>
        el(
          "li",
          {},
          el("span", {}, wareName(ware)),
          el("span", { className: "count" }, `×${count}`),
          ...(perHour !== null && perHourWithWorkforce !== null
            ? [el("small", {}, t("perHour", { rate: formatNumber(perHour), max: formatNumber(perHourWithWorkforce) }))]
            : []),
        ),
      ),
    );

    const { capacity, needed } = summary.workforce;
    this.workforceSection.hidden = capacity === 0 && needed === 0;
    this.workforceBalance.textContent = t("workforceBalance", {
      capacity: formatNumber(capacity),
      needed: formatNumber(needed),
    });
    this.workforceBalance.classList.toggle("short", capacity < needed);
  },

  renderDetail(pick: ModulePick | null, plan: ConstructionPlan | null, onGoTo: (index: string) => void): void {
    if (!pick || !plan) {
      this.detail.replaceChildren(el("p", { className: "empty" }, t("emptyDetail")));
      return;
    }
    const { entry, info } = pick;
    const link = (index: string) => {
      const b = el("button", { type: "button", className: "link" }, `#${index}`);
      b.addEventListener("click", () => onGoTo(index));
      return b;
    };

    const rotation = entry.quaternion
      ? `q(${[entry.quaternion.x, entry.quaternion.y, entry.quaternion.z, entry.quaternion.w].map((v) => fixed(v, 3)).join(", ")})`
      : entry.rotation
        ? `yaw ${fixed(entry.rotation.yaw, 1)}° · pitch ${fixed(entry.rotation.pitch, 1)}° · roll ${fixed(entry.rotation.roll, 1)}°`
        : "—";

    const attached = entry.predecessor
      ? [link(entry.predecessor.index), ` ${entry.predecessor.connection ?? "?"} ↔ ${entry.connection ?? "?"}`]
      : [t("noPredecessor")];

    const followers = plan.entries.filter((e) => e.predecessor?.index === entry.index).map((e) => link(e.index));

    const row = (label: string, ...value: Array<Node | string>) => [el("dt", {}, label), el("dd", {}, ...value)];

    this.detail.replaceChildren(
      el("h3", {}, moduleName(info)),
      el("code", {}, entry.macro),
      el(
        "dl",
        { className: "kv" },
        ...statRows(info.stats, row),
        ...row(t("index"), `#${entry.index}`),
        ...row(t("position"), `${[entry.position.x, entry.position.y, entry.position.z].map(round).join(", ")} m`),
        ...row(t("rotation"), rotation),
        ...row(
          t("dimensions"),
          t("dimensionsValue", {
            size: info.shape.size.map(round).join(" × "),
            source: t(info.measured ? "measuredFromGame" : "measuredEstimated"),
          }),
        ),
        ...row(t("attachedTo"), ...attached),
        ...row(t("followedBy"), ...(followers.length ? followers : ["—"])),
      ),
    );
  },

  showTip(pick: ModulePick | null, x: number, y: number): void {
    if (!pick) {
      this.tip.hidden = true;
      return;
    }
    this.tip.replaceChildren(moduleName(pick.info), el("small", {}, `#${pick.entry.index} · ${pick.entry.macro}`));
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${y}px`;
    this.tip.hidden = false;
  },

  /** Shows a load error (translated if it is a `PlanParseError`), or hides it with `null`. */
  showError(error: unknown): void {
    this.lastError = error;
    const message = error == null ? "" : errorMessage(error);
    this.error.textContent = message;
    this.error.hidden = !message;
  },
};
