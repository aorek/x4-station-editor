import { CATEGORIES, CATEGORY_ORDER, type CategoryId } from "../catalog/modules";
import type { PlanSummary } from "../plan/summary";
import type { ConstructionPlan } from "../plan/types";
import type { ModulePick } from "../viewer/StationViewer";

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id} en index.html`);
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

export const panel = {
  planName: byId<HTMLHeadingElement>("plan-name"),
  planSelect: byId<HTMLSelectElement>("plan-select"),
  legend: byId<HTMLUListElement>("legend"),
  productionSection: byId<HTMLElement>("production-section"),
  productionList: byId<HTMLUListElement>("production-list"),
  detail: byId<HTMLDivElement>("detail"),
  error: byId<HTMLParagraphElement>("error"),
  tip: byId<HTMLDivElement>("tip"),

  renderPlanList(plans: ConstructionPlan[]): void {
    this.planSelect.replaceChildren(
      ...plans.map((p, i) => el("option", { value: String(i) }, `${p.name} (${p.entries.length})`)),
    );
    this.planSelect.hidden = plans.length < 2;
  },

  renderSummary(
    plan: ConstructionPlan,
    summary: PlanSummary,
    sizeMeters: [number, number, number],
    onToggleCategory: (category: CategoryId, visible: boolean) => void,
  ): void {
    this.planName.textContent = plan.name;
    byId("stat-modules").textContent = String(summary.moduleCount);
    byId("stat-production").textContent = String(summary.byCategory.production ?? 0);
    byId("stat-size").textContent = sizeMeters.map((m) => (m / 1000).toFixed(1)).join("×");

    this.legend.replaceChildren(
      ...CATEGORY_ORDER.filter((id) => summary.byCategory[id]).map((id) => {
        const category = CATEGORIES[id];
        const button = el(
          "button",
          { type: "button" },
          el("span", { className: "chip" }),
          el("span", {}, category.label),
          el("span", { className: "count" }, String(summary.byCategory[id])),
        );
        (button.firstChild as HTMLElement).style.background = hex(category.color);
        button.setAttribute("aria-pressed", "true");
        button.addEventListener("click", () => {
          const visible = button.getAttribute("aria-pressed") !== "true";
          button.setAttribute("aria-pressed", String(visible));
          onToggleCategory(id, visible);
        });
        return el("li", {}, button);
      }),
    );

    this.productionSection.hidden = summary.production.length === 0;
    this.productionList.replaceChildren(
      ...summary.production.map(({ ware, count }) =>
        el("li", {}, el("span", {}, ware), el("span", { className: "count" }, `×${count}`)),
      ),
    );
  },

  renderDetail(pick: ModulePick | null, plan: ConstructionPlan | null, onGoTo: (index: string) => void): void {
    if (!pick || !plan) {
      this.detail.replaceChildren(el("p", { className: "empty" }, "Haz clic en un módulo del visor."));
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
      : ["Ninguno (ancla o módulo suelto)"];

    const followers = plan.entries.filter((e) => e.predecessor?.index === entry.index).map((e) => link(e.index));

    const row = (label: string, ...value: Array<Node | string>) => [el("dt", {}, label), el("dd", {}, ...value)];

    this.detail.replaceChildren(
      el("h3", {}, info.name),
      el("code", {}, entry.macro),
      el(
        "dl",
        { className: "kv" },
        ...row("Índice", `#${entry.index}`),
        ...row("Posición", `${[entry.position.x, entry.position.y, entry.position.z].map(round).join(", ")} m`),
        ...row("Rotación", rotation),
        ...row("Unido a", ...attached),
        ...row("Le siguen", ...(followers.length ? followers : ["—"])),
      ),
    );
  },

  showTip(pick: ModulePick | null, x: number, y: number): void {
    if (!pick) {
      this.tip.hidden = true;
      return;
    }
    this.tip.replaceChildren(pick.info.name, el("small", {}, `#${pick.entry.index} · ${pick.entry.macro}`));
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${y}px`;
    this.tip.hidden = false;
  },

  showError(message: string | null): void {
    this.error.textContent = message ?? "";
    this.error.hidden = !message;
  },
};
