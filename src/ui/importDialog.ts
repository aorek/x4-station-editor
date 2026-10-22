import { errorMessage } from "../i18n";

/**
 * Dialog to paste the XML of a plan, or pick (or drop) a file, and load it.
 * `onLoad` throws on a bad plan; the error is shown here and the dialog stays open.
 */
export class ImportDialog {
  private readonly text: HTMLTextAreaElement;
  private readonly fileInput: HTMLInputElement;
  private readonly loadButton: HTMLButtonElement;
  private readonly status: HTMLElement;
  private error: unknown = null;

  constructor(
    private readonly root: HTMLDialogElement,
    private readonly onLoad: (xml: string) => void,
  ) {
    this.text = root.querySelector("textarea")!;
    this.fileInput = root.querySelector('input[type="file"]')!;
    this.loadButton = root.querySelector(".import-load")!;
    this.status = root.querySelector(".dialog-status")!;

    this.text.addEventListener("input", () => {
      this.setError(null);
      this.updateLoadButton();
    });
    // Ctrl+Enter loads from the keyboard, as Enter inserts a new line.
    this.text.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        this.load();
      }
    });
    this.loadButton.addEventListener("click", () => this.load());
    root.querySelector(".import-file")!.addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", async () => {
      await this.loadFile(this.fileInput.files?.[0]);
      this.fileInput.value = "";
    });

    // Dropping a file anywhere on the dialog loads it, instead of the textarea inserting its path.
    root.addEventListener("dragover", (event) => event.preventDefault());
    root.addEventListener("drop", (event) => {
      if (!event.dataTransfer?.files.length) return;
      event.preventDefault();
      void this.loadFile(event.dataTransfer.files[0]);
    });
    // Clicks on the backdrop land on the dialog itself.
    root.addEventListener("click", (event) => {
      if (event.target === root) root.close();
    });
  }

  open(): void {
    this.text.value = "";
    this.setError(null);
    this.updateLoadButton();
    this.root.showModal();
    this.text.focus();
  }

  /** Re-renders the texts built here, after a language change. */
  refreshTexts(): void {
    this.setError(this.error);
  }

  /** Shows the file's XML in the textarea, so a failed load can still be inspected. */
  private async loadFile(file: File | undefined): Promise<void> {
    if (!file) return;
    this.text.value = await file.text();
    this.text.scrollTop = 0;
    this.updateLoadButton();
    this.load();
  }

  private load(): void {
    if (!this.text.value.trim()) return;
    try {
      this.onLoad(this.text.value);
      this.root.close();
    } catch (error) {
      this.setError(error);
    }
  }

  private updateLoadButton(): void {
    this.loadButton.disabled = !this.text.value.trim();
  }

  private setError(error: unknown): void {
    this.error = error;
    this.status.textContent = error == null ? "" : errorMessage(error);
    this.status.classList.toggle("error", error != null);
  }
}
