const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 280;
/** The viewer keeps at least this much of the window. */
const MIN_VIEW = 360;
const KEY_STEP = 16;
const STORAGE_KEY = "x4-station-viewer:panel-width";

/**
 * Makes the side panel resizable by dragging `handle` (or with the arrow keys
 * when it has focus). Double-click resets the default width. The width lives
 * in the `--panel-width` CSS variable on `app` and is remembered per browser.
 */
export function makePanelResizable(app: HTMLElement, handle: HTMLElement): void {
  const maxWidth = () => Math.max(MIN_WIDTH, Math.min(720, window.innerWidth - MIN_VIEW));
  let width = DEFAULT_WIDTH;

  const apply = (value: number, save = true) => {
    width = Math.round(Math.min(Math.max(value, MIN_WIDTH), maxWidth()));
    app.style.setProperty("--panel-width", `${width}px`);
    handle.setAttribute("aria-valuenow", String(width));
    handle.setAttribute("aria-valuemin", String(MIN_WIDTH));
    handle.setAttribute("aria-valuemax", String(maxWidth()));
    if (save) {
      try {
        localStorage.setItem(STORAGE_KEY, String(width));
      } catch {
        // Storage blocked: the width just is not remembered.
      }
    }
  };

  let stored: number | null = null;
  try {
    stored = Number(localStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    // Same as above.
  }
  apply(stored ?? DEFAULT_WIDTH, false);

  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;
    app.classList.add("resizing");
    const move = (e: PointerEvent) => apply(startWidth + e.clientX - startX, false);
    const end = () => {
      handle.removeEventListener("pointermove", move);
      app.classList.remove("resizing");
      apply(width);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("lostpointercapture", end, { once: true });
  });

  handle.addEventListener("dblclick", () => apply(DEFAULT_WIDTH));

  handle.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP;
    const next =
      event.key === "ArrowLeft"
        ? width - step
        : event.key === "ArrowRight"
          ? width + step
          : event.key === "Home"
            ? MIN_WIDTH
            : event.key === "End"
              ? maxWidth()
              : null;
    if (next === null) return;
    event.preventDefault();
    apply(next);
  });

  // A smaller window may leave too little room for the viewer.
  window.addEventListener("resize", () => apply(width, false));
}
