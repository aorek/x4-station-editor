export interface MenuItem {
  label: string;
  /** Destructive action, drawn in the danger colour. */
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * Floating menu over the viewer. Closes on Escape, on a click outside it,
 * when the view is scrolled or resized, and after choosing an item.
 */
export class ContextMenu {
  private returnFocus: HTMLElement | null = null;

  constructor(private readonly root: HTMLElement) {
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (this.isOpen && !root.contains(event.target as Node)) this.close();
      },
      true,
    );
    root.parentElement?.addEventListener("wheel", () => this.close(), { passive: true });
    window.addEventListener("resize", () => this.close());
    window.addEventListener("blur", () => this.close());
    root.addEventListener("keydown", (event) => this.onKey(event));
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Opens the menu at (x, y) in its container's coordinates, kept inside the container. */
  show(title: string, subtitle: string, items: MenuItem[], x: number, y: number): void {
    const head = document.createElement("div");
    head.className = "menu-head";
    const name = document.createElement("b");
    name.textContent = title;
    const detail = document.createElement("small");
    detail.textContent = subtitle;
    head.append(name, detail);

    const buttons = items.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.label;
      button.disabled = !!item.disabled;
      button.setAttribute("role", "menuitem");
      if (item.danger) button.classList.add("danger");
      button.addEventListener("click", () => {
        this.close();
        item.onSelect();
      });
      return button;
    });

    this.root.replaceChildren(head, ...buttons);
    this.root.setAttribute("aria-label", title);
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.root.hidden = false;

    const parent = this.root.offsetParent as HTMLElement | null;
    const maxX = (parent?.clientWidth ?? innerWidth) - this.root.offsetWidth - 8;
    const maxY = (parent?.clientHeight ?? innerHeight) - this.root.offsetHeight - 8;
    this.root.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
    this.root.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
    this.enabledItems()[0]?.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.root.replaceChildren();
    if (this.root.contains(document.activeElement) || document.activeElement === document.body) {
      this.returnFocus?.focus();
    }
    this.returnFocus = null;
  }

  private enabledItems(): HTMLButtonElement[] {
    return Array.from(this.root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = this.enabledItems();
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    items[(current + step + items.length) % items.length]?.focus();
  }
}
