import { t } from "../i18n";
import { serializePlans } from "../plan/serialize";
import type { ConstructionPlan } from "../plan/types";

type Scope = "current" | "all";

/** File System Access API (Chromium); other browsers fall back to a download. */
interface SaveFilePicker {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>;
}

/** Characters Windows does not allow in file names. */
const fileName = (name: string) => `${name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "plan"}.xml`;

/** Dialog that shows the XML of the current (edited) plan, or of all loaded plans, to copy or save. */
export class ExportDialog {
  private plans: ConstructionPlan[] = [];
  private current: ConstructionPlan | null = null;
  private scope: Scope = "current";

  private readonly text: HTMLTextAreaElement;
  private readonly scopes: HTMLElement;
  private readonly status: HTMLElement;

  constructor(private readonly root: HTMLDialogElement) {
    this.text = root.querySelector("textarea")!;
    this.scopes = root.querySelector(".export-scope")!;
    this.status = root.querySelector(".dialog-status")!;
    root.querySelector(".export-copy")!.addEventListener("click", () => void this.copy());
    root.querySelector(".export-save")!.addEventListener("click", () => void this.save());
    // Clicks on the backdrop land on the dialog itself.
    root.addEventListener("click", (event) => {
      if (event.target === root) root.close();
    });
  }

  open(plans: ConstructionPlan[], current: ConstructionPlan): void {
    this.plans = plans;
    this.current = current;
    this.scope = "current";
    this.render();
    this.root.showModal();
  }

  /** Re-renders the texts built here, after a language change. */
  refreshTexts(): void {
    if (this.root.open) this.renderScopes();
  }

  private selected(): ConstructionPlan[] {
    return this.scope === "all" ? this.plans : this.current ? [this.current] : [];
  }

  private render(): void {
    this.renderScopes();
    this.text.value = serializePlans(this.selected());
    this.text.scrollTop = 0;
    this.setStatus("");
  }

  private renderScopes(): void {
    this.scopes.hidden = this.plans.length < 2;
    const options: Array<[Scope, string]> = [
      ["current", t("exportCurrent")],
      ["all", t("exportAll", { count: this.plans.length })],
    ];
    this.scopes.replaceChildren(
      ...options.map(([scope, label]) => {
        const input = Object.assign(document.createElement("input"), {
          type: "radio",
          name: "export-scope",
          checked: scope === this.scope,
        });
        input.addEventListener("change", () => {
          this.scope = scope;
          this.render();
        });
        const option = document.createElement("label");
        option.append(input, ` ${label}`);
        return option;
      }),
    );
  }

  private setStatus(message: string, error = false): void {
    this.status.textContent = message;
    this.status.classList.toggle("error", error);
  }

  private async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.text.value);
      this.setStatus(t("copied"));
    } catch {
      // No clipboard access (e.g. not a secure context): leave it ready for Ctrl+C.
      this.text.focus();
      this.text.select();
      this.setStatus(t("copyFailed"), true);
    }
  }

  private async save(): Promise<void> {
    const plans = this.selected();
    const name = plans.length === 1 ? fileName(plans[0].name || plans[0].id) : "constructionplans.xml";
    const xml = this.text.value;
    const picker = (window as SaveFilePicker).showSaveFilePicker;

    if (picker) {
      try {
        const handle = await picker({
          suggestedName: name,
          types: [{ description: t("xmlFileType"), accept: { "application/xml": [".xml"] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(xml);
        await writable.close();
        this.setStatus(t("saved"));
      } catch (error) {
        if ((error as Error).name !== "AbortError") this.setStatus(t("saveFailed"), true);
      }
      return;
    }

    const url = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: name });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.setStatus(t("downloaded"));
  }
}
