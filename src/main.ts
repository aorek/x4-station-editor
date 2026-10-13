import "./style.css";
import sampleXml from "./samples/ARG_EnCells_2C.xml?raw";
import { parseConstructionPlans } from "./plan/parse";
import { summarizePlan } from "./plan/summary";
import type { ConstructionPlan } from "./plan/types";
import { panel } from "./ui/panel";
import { StationViewer } from "./viewer/StationViewer";

const viewer = new StationViewer(document.getElementById("canvas-host")!);
let plans: ConstructionPlan[] = [];
let current: ConstructionPlan | null = null;

function goTo(index: string) {
  viewer.select(index, true);
}

viewer.onHover = (pick, x, y) => panel.showTip(pick, x, y);
viewer.onSelect = (pick) => panel.renderDetail(pick, current, goTo);

function showPlan(plan: ConstructionPlan) {
  current = plan;
  viewer.load(plan);
  panel.renderSummary(plan, summarizePlan(plan), viewer.size(), (category, visible) =>
    viewer.setCategoryVisible(category, visible),
  );
  panel.renderDetail(null, plan, goTo);
}

function loadXml(xml: string) {
  try {
    plans = parseConstructionPlans(xml);
    panel.showError(null);
    panel.renderPlanList(plans);
    showPlan(plans[0]);
  } catch (error) {
    panel.showError(error instanceof Error ? error.message : String(error));
  }
}

async function loadFile(file: File | undefined) {
  if (file) loadXml(await file.text());
}

// ---------- Controles ----------

const fileInput = document.getElementById("file-input") as HTMLInputElement;
document.getElementById("open-file")!.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  await loadFile(fileInput.files?.[0]);
  fileInput.value = "";
});

document.getElementById("fit")!.addEventListener("click", () => viewer.fit());
document.getElementById("show-links")!.addEventListener("change", (event) => {
  viewer.setLinksVisible((event.target as HTMLInputElement).checked);
});
panel.planSelect.addEventListener("change", () => showPlan(plans[Number(panel.planSelect.value)]));

// ---------- Arrastrar y soltar ----------

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
