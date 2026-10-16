import type { ConstructionPlan, PlanEntry, Predecessor } from "./types";

export type PlanParseErrorCode = "invalidXml" | "noPlans";

const DEFAULT_MESSAGES: Record<PlanParseErrorCode, string> = {
  invalidXml: "The file is not valid XML.",
  noPlans: "No <plan> with modules was found in the file.",
};

/** Parse failure. `code` lets the UI show a translated message. */
export class PlanParseError extends Error {
  constructor(readonly code: PlanParseErrorCode) {
    super(DEFAULT_MESSAGES[code]);
    this.name = "PlanParseError";
  }
}

function num(el: Element | undefined, attr: string, fallback = 0): number {
  const raw = el?.getAttribute(attr);
  if (raw == null || raw === "") return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** Direct children with a given tag name (avoids picking up deeper nested nodes). */
function children(el: Element, tag: string): Element[] {
  return Array.from(el.children).filter((c) => c.tagName === tag);
}

function parseEntry(el: Element): PlanEntry {
  const offset = children(el, "offset")[0];
  const position = offset ? children(offset, "position")[0] : undefined;
  const rotation = offset ? children(offset, "rotation")[0] : undefined;
  const quaternion = offset ? children(offset, "quaternion")[0] : undefined;
  const pred = children(el, "predecessor")[0];

  const predecessor: Predecessor | null = pred
    ? { index: pred.getAttribute("index") ?? "", connection: pred.getAttribute("connection") }
    : null;

  return {
    index: el.getAttribute("index") ?? "",
    macro: el.getAttribute("macro") ?? "",
    connection: el.getAttribute("connection"),
    predecessor,
    position: { x: num(position, "x"), y: num(position, "y"), z: num(position, "z") },
    rotation: rotation
      ? { yaw: num(rotation, "yaw"), pitch: num(rotation, "pitch"), roll: num(rotation, "roll") }
      : null,
    quaternion: quaternion
      ? {
          x: num(quaternion, "qx"),
          y: num(quaternion, "qy"),
          z: num(quaternion, "qz"),
          w: num(quaternion, "qw", 1),
        }
      : null,
  };
}

/**
 * Reads an X4 construction plan XML. Accepts either a single exported plan or
 * the full `constructionplans.xml` from the user folder.
 *
 * `name` falls back to the plan id, and is empty if the plan has neither.
 */
export function parseConstructionPlans(xml: string): ConstructionPlan[] {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    throw new PlanParseError("invalidXml");
  }
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new PlanParseError("invalidXml");
  }

  const plans = Array.from(doc.getElementsByTagName("plan"))
    .map<ConstructionPlan>((plan) => {
      const id = plan.getAttribute("id") ?? "";
      return {
        id,
        name: plan.getAttribute("name") || id,
        description: plan.getAttribute("description") ?? "",
        entries: children(plan, "entry").map(parseEntry),
        source: new XMLSerializer().serializeToString(plan),
      };
    })
    .filter((plan) => plan.entries.length > 0);

  if (plans.length === 0) {
    throw new PlanParseError("noPlans");
  }
  return plans;
}
