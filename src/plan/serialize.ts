import type { ConstructionPlan, PlanEntry } from "./types";

/**
 * Writes plans as an X4 construction plan XML (`<plans><plan>…`), the format
 * the game imports and `parseConstructionPlans` reads.
 *
 * Each plan starts from its `source` element, so attributes and children the
 * viewer does not model survive; entries are written in the plan's order and
 * entries missing from the plan (deleted) are left out. Entry contents are
 * kept as read except `<predecessor>`, which follows the plan.
 */
export function serializePlans(plans: ConstructionPlan[]): string {
  const doc = document.implementation.createDocument(null, "plans", null);
  for (const plan of plans) doc.documentElement.append(doc.createTextNode("\n  "), planElement(doc, plan));
  doc.documentElement.append(doc.createTextNode("\n"));
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(doc)}\n`;
}

function planElement(doc: XMLDocument, plan: ConstructionPlan): Element {
  const el = doc.importNode(new DOMParser().parseFromString(plan.source, "application/xml").documentElement, true);
  const entries = childElements(el, "entry");
  const byIndex = new Map(entries.map((e) => [e.getAttribute("index") ?? "", e]));

  // New entries go where the old ones were: before whatever followed the last one.
  const anchor = entries.at(-1)?.nextSibling ?? null;
  const indent = entries.length ? leadingIndent(entries[0]) : "\n    ";
  for (const entry of entries) removeWithIndent(entry);

  for (const entry of plan.entries) {
    const node = byIndex.get(entry.index);
    if (!node) continue;
    syncPredecessor(doc, node, entry);
    el.insertBefore(doc.createTextNode(indent), anchor);
    el.insertBefore(node, anchor);
  }
  return el;
}

function syncPredecessor(doc: XMLDocument, node: Element, entry: PlanEntry): void {
  let pred = childElements(node, "predecessor")[0];
  if (!entry.predecessor) {
    if (pred) removeWithIndent(pred);
    return;
  }
  if (!pred) {
    pred = doc.createElement("predecessor");
    const first = node.firstElementChild;
    node.insertBefore(doc.createTextNode(first ? leadingIndent(first) : "\n"), node.firstChild);
    node.insertBefore(pred, node.firstChild?.nextSibling ?? null);
  }
  pred.setAttribute("index", entry.predecessor.index);
  if (entry.predecessor.connection) pred.setAttribute("connection", entry.predecessor.connection);
  else pred.removeAttribute("connection");
}

function childElements(el: Element, tag: string): Element[] {
  return Array.from(el.children).filter((c) => c.tagName === tag);
}

/** The whitespace (newline and indentation) before an element, or a default. */
function leadingIndent(el: Element): string {
  const prev = el.previousSibling;
  return prev?.nodeType === 3 && !prev.textContent?.trim() ? prev.textContent! : "\n";
}

/** Removes an element and the whitespace before it, so no blank line is left. */
function removeWithIndent(el: Element): void {
  const prev = el.previousSibling;
  if (prev?.nodeType === 3 && !prev.textContent?.trim()) prev.remove();
  el.remove();
}
