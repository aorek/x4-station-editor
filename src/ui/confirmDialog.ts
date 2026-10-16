export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

/**
 * Modal yes/no question. Resolves true only when the confirm button is used;
 * Escape, the cancel button or a click on the backdrop resolve false. Focus
 * starts on cancel, so a stray Enter does not confirm.
 */
export class ConfirmDialog {
  private readonly title: HTMLElement;
  private readonly message: HTMLElement;
  private readonly confirmButton: HTMLButtonElement;
  private readonly cancelButton: HTMLButtonElement;

  constructor(private readonly root: HTMLDialogElement) {
    this.title = root.querySelector(".confirm-title")!;
    this.message = root.querySelector(".confirm-message")!;
    this.confirmButton = root.querySelector('button[value="confirm"]')!;
    this.cancelButton = root.querySelector('button[value="cancel"]')!;
    root.addEventListener("click", (event) => {
      if (event.target === root) root.close("cancel");
    });
  }

  ask({ title, message, confirmLabel, cancelLabel }: ConfirmOptions): Promise<boolean> {
    this.title.textContent = title;
    this.message.textContent = message;
    this.confirmButton.textContent = confirmLabel;
    this.cancelButton.textContent = cancelLabel;
    this.root.returnValue = "";
    this.root.showModal();
    this.cancelButton.focus();
    return new Promise((resolve) => {
      this.root.addEventListener("close", () => resolve(this.root.returnValue === "confirm"), { once: true });
    });
  }
}
