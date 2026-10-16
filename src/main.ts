import "./style.css";
import sampleXml from "./samples/ARG_EnCells_2C.xml?raw";
import { applyStaticTexts, moduleName, onLocaleChange, setLocale, t } from "./i18n";
import { removeEntries, sequenceOf } from "./plan/edit";
import { parseConstructionPlans } from "./plan/parse";
import { summarizePlan } from "./plan/summary";
import type { ConstructionPlan } from "./plan/types";
import { ConfirmDialog } from "./ui/confirmDialog";
import { ContextMenu } from "./ui/contextMenu";
import { ExportDialog } from "./ui/exportDialog";
import { panel } from "./ui/panel";
import { StationViewer } from "./viewer/StationViewer";

applyStaticTexts();
panel.renderLocaleSelect(setLocale);

const viewer = new StationViewer(document.getElementById("canvas-host")!);
const menu = new ContextMenu(document.getElementById("context-menu")!);
const confirmDialog = new ConfirmDialog(document.getElementById("confirm-dialog") as HTMLDialogElement);
const exportDialog = new ExportDialog(document.getElementById("export-dialog") as HTMLDialogElement);
let plans: ConstructionPlan[] = [];
let current: ConstructionPlan | null = null;

function goTo(index: string) {
  viewer.select(index, true);
}

viewer.onHover = (pick, x, y) => {
  if (!menu.isOpen) panel.showTip(pick, x, y);
};
viewer.onSelect = (pick) => panel.renderDetail(pick, current, goTo);
viewer.onContextMenu = ({ entry, info }, x, y) => {
  if (!current) return;
  // A module with followers can only go together with everything hanging from it.
  const sequence = sequenceOf(current, entry.index);
  panel.showTip(null, 0, 0);
  menu.show(
    moduleName(info),
    `#${entry.index} · ${entry.macro}`,
    [
      { label: t("focusModule"), onSelect: () => goTo(entry.index) },
      {
        label: sequence.length > 1 ? t("deleteSequence", { count: sequence.length }) : t("deleteModule"),
        danger: true,
        // An empty plan has nothing to show; keep at least one module.
        disabled: sequence.length >= current.entries.length,
        onSelect: () => {
          if (sequence.length > 1) void confirmSequenceDeletion(sequence, moduleName(info), entry.index);
          else deleteModules(sequence);
        },
      },
    ],
    x,
    y,
  );
};

function renderSummary(plan: ConstructionPlan) {
  panel.renderSummary(
    plan,
    summarizePlan(plan),
    viewer.size(),
    (macro) => viewer.isMacroVisible(macro),
    (macros, visible) => viewer.setMacrosVisible(macros, visible),
  );
}

function showPlan(plan: ConstructionPlan) {
  menu.close();
  current = plan;
  viewer.load(plan);
  renderSummary(plan);
  panel.renderDetail(null, plan, goTo);
}

/** Asks before deleting a module with everything attached to it, showing in red what would go. */
async function confirmSequenceDeletion(sequence: string[], name: string, index: string) {
  viewer.setMarked(sequence);
  const confirmed = await confirmDialog.ask({
    title: t("deleteSequenceTitle"),
    message: t(sequence.length === 2 ? "deleteSequenceMessageOne" : "deleteSequenceMessage", {
      name,
      index,
      count: sequence.length - 1,
    }),
    confirmLabel: t("deleteSequenceConfirm", { count: sequence.length }),
    cancelLabel: t("cancel"),
  });
  viewer.setMarked([]);
  if (confirmed) deleteModules(sequence);
}

/** Removes modules from the current plan, keeping the camera and hidden modules. */
function deleteModules(indices: string[]) {
  if (!current) return;
  const plan = removeEntries(current, indices);
  plans[plans.indexOf(current)] = plan;
  current = plan;
  viewer.load(plan, { keepView: true });
  panel.renderPlanList(plans, plans.indexOf(plan));
  renderSummary(plan);
  panel.renderDetail(null, plan, goTo);
}

// Re-render every text in place, keeping the plan, selection and hidden categories.
onLocaleChange(() => {
  menu.close();
  applyStaticTexts();
  panel.renderLocaleSelect(setLocale);
  panel.showTip(null, 0, 0);
  panel.showError(panel.lastError);
  exportDialog.refreshTexts();
  if (!current) return;
  panel.renderPlanList(plans, plans.indexOf(current));
  renderSummary(current);
  panel.renderDetail(viewer.selection(), current, goTo);
});

function loadXml(xml: string) {
  try {
    plans = parseConstructionPlans(xml);
    panel.showError(null);
    panel.renderPlanList(plans);
    showPlan(plans[0]);
  } catch (error) {
    panel.showError(error);
  }
}

async function loadFile(file: File | undefined) {
  if (file) loadXml(await file.text());
}

// ---------- Controls ----------

const fileInput = document.getElementById("file-input") as HTMLInputElement;
document.getElementById("open-file")!.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  await loadFile(fileInput.files?.[0]);
  fileInput.value = "";
});

document.getElementById("export-file")!.addEventListener("click", () => {
  if (current) exportDialog.open(plans, current);
});
document.getElementById("fit")!.addEventListener("click", () => viewer.fit());
document.getElementById("show-links")!.addEventListener("change", (event) => {
  viewer.setLinksVisible((event.target as HTMLInputElement).checked);
});
panel.planSelect.addEventListener("change", () => showPlan(plans[Number(panel.planSelect.value)]));

// ---------- Drag and drop ----------

const view = document.getElementById("view")!;
const drop = document.getElementById("drop")!;
view.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.hidden = false;
});
drop.addEventListener("dragleave", () => {
  drop.hidden = true;
});
view.addEventListener("drop", (event) => {
  event.preventDefault();
  drop.hidden = true;
  void loadFile(event.dataTransfer?.files[0]);
});

loadXml(sampleXml);
