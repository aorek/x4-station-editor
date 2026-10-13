import type { ConstructionPlan, PlanEntry, Predecessor } from "./types";

export class PlanParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanParseError";
  }
}

function num(el: Element | undefined, attr: string, fallback = 0): number {
  const raw = el?.getAttribute(attr);
  if (raw == null || raw === "") return fallback;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

/** Hijos directos con un nombre de etiqueta dado (evita coger nodos anidados más profundos). */
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
 * Lee un XML de planos de X4. Acepta tanto un plano exportado suelto como el
 * `constructionplans.xml` completo de la carpeta de usuario.
 */
export function parseConstructionPlans(xml: string): ConstructionPlan[] {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xml, "application/xml");
  } catch {
    throw new PlanParseError("El archivo no es un XML válido.");
  }
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new PlanParseError("El archivo no es un XML válido.");
  }

  const plans = Array.from(doc.getElementsByTagName("plan"))
    .map<ConstructionPlan>((plan) => {
      const id = plan.getAttribute("id") ?? "";
      return {
        id,
        name: plan.getAttribute("name") || id || "Sin nombre",
        description: plan.getAttribute("description") ?? "",
        entries: children(plan, "entry").map(parseEntry),
      };
    })
    .filter((plan) => plan.entries.length > 0);

  if (plans.length === 0) {
    throw new PlanParseError("No se encontró ningún <plan> con módulos en el archivo.");
  }
  return plans;
}
