#!/usr/bin/env python3
"""Small desktop GUI for unified-pdf2md.

This app intentionally stays thin: it only lets a user choose input/output files
or folders and then invokes the existing Node.js CLI. Keeping conversion logic
in the CLI avoids a second implementation path and preserves batch mode.
"""

from __future__ import annotations

import os
import queue
import shutil
import subprocess
import sys
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except Exception as exc:  # pragma: no cover - only triggered on missing tkinter
    raise SystemExit(
        "Tkinter is not available in this Python installation. "
        "Install Python from python.org and ensure the Tcl/Tk option is enabled."
    ) from exc


@dataclass(frozen=True)
class ModeConfig:
    key: str
    label: str
    input_label: str
    input_kind: str
    input_filetypes: tuple[tuple[str, str], ...]
    output_label: str
    output_kind: str
    output_default_ext: str
    output_filetypes: tuple[tuple[str, str], ...]
    help_text: str


MODES: dict[str, ModeConfig] = {
    "convert": ModeConfig(
        key="convert",
        label="Convert PDF → Markdown",
        input_label="Input PDF",
        input_kind="file",
        input_filetypes=(("PDF files", "*.pdf"), ("All files", "*.*")),
        output_label="Output Markdown",
        output_kind="file",
        output_default_ext=".md",
        output_filetypes=(("Markdown files", "*.md"), ("Text files", "*.txt"), ("All files", "*.*")),
        help_text="Use this when you only need a .md file from one PDF.",
    ),
    "review": ModeConfig(
        key="review",
        label="Create review JSON from PDF",
        input_label="Input PDF",
        input_kind="file",
        input_filetypes=(("PDF files", "*.pdf"), ("All files", "*.*")),
        output_label="Output review JSON",
        output_kind="file",
        output_default_ext=".review.json",
        output_filetypes=(("Review JSON", "*.review.json"), ("JSON files", "*.json"), ("All files", "*.*")),
        help_text="Use this to create an editable review file for academic-paper post-processing.",
    ),
    "export": ModeConfig(
        key="export",
        label="Export review JSON → Markdown",
        input_label="Input review JSON",
        input_kind="file",
        input_filetypes=(("Review JSON", "*.review.json"), ("JSON files", "*.json"), ("All files", "*.*")),
        output_label="Output Markdown",
        output_kind="file",
        output_default_ext=".md",
        output_filetypes=(("Markdown files", "*.md"), ("Text files", "*.txt"), ("All files", "*.*")),
        help_text="Use this after editing one .review.json file.",
    ),
    "convert-folder": ModeConfig(
        key="convert-folder",
        label="Convert PDF folder → Markdown folder",
        input_label="Input PDF folder",
        input_kind="folder",
        input_filetypes=(),
        output_label="Output Markdown folder",
        output_kind="folder",
        output_default_ext="",
        output_filetypes=(),
        help_text="Use this to convert every PDF in a folder into Markdown files. Enable recursive for subfolders.",
    ),
    "review-folder": ModeConfig(
        key="review-folder",
        label="Create review JSON folder",
        input_label="Input PDF folder",
        input_kind="folder",
        input_filetypes=(),
        output_label="Output review JSON folder",
        output_kind="folder",
        output_default_ext="",
        output_filetypes=(),
        help_text="Use this to create one .review.json file for each PDF in a folder.",
    ),
    "export-folder": ModeConfig(
        key="export-folder",
        label="Export review folder → Markdown folder",
        input_label="Input review JSON folder",
        input_kind="folder",
        input_filetypes=(),
        output_label="Output Markdown folder",
        output_kind="folder",
        output_default_ext="",
        output_filetypes=(),
        help_text="Use this to export every .review.json file in a folder into Markdown.",
    ),
}


def find_repo_root(start: Optional[Path] = None) -> Path:
    """Find the monorepo root from this script location or current directory."""
    candidates: list[Path] = []
    if start is not None:
        candidates.append(start.resolve())
    candidates.append(Path(__file__).resolve())
    candidates.append(Path.cwd().resolve())

    for candidate in candidates:
        for path in [candidate, *candidate.parents]:
            cli = path / "apps" / "cli" / "bin" / "unified-pdf2md.js"
            package_json = path / "package.json"
            if cli.exists() and package_json.exists():
                return path
    raise FileNotFoundError(
        "Could not find repo root. Run this GUI from inside the unified-pdf2md repository."
    )


def resolve_node_command() -> str:
    for name in ("node", "node.exe"):
        found = shutil.which(name)
        if found:
            return found
    raise FileNotFoundError("Node.js was not found in PATH. Install Node.js 20+ and restart the terminal.")


class Pdf2MdGui(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("unified-pdf2md")
        self.geometry("860x650")
        self.minsize(800, 590)

        self.repo_root = find_repo_root()
        self.message_queue: queue.Queue[tuple[str, str]] = queue.Queue()
        self.worker: Optional[threading.Thread] = None

        self.mode_var = tk.StringVar(value="convert")
        self.input_var = tk.StringVar()
        self.output_var = tk.StringVar()
        self.body_only_var = tk.BooleanVar(value=True)
        self.safe_only_var = tk.BooleanVar(value=False)
        self.translated_var = tk.BooleanVar(value=False)
        self.recursive_var = tk.BooleanVar(value=True)
        self.status_var = tk.StringVar(value="Ready")

        self._build_ui()
        self._apply_mode_defaults()
        self.after(100, self._poll_queue)

    def _build_ui(self) -> None:
        root = ttk.Frame(self, padding=16)
        root.pack(fill=tk.BOTH, expand=True)

        title = ttk.Label(root, text="unified-pdf2md", font=("Segoe UI", 16, "bold"))
        title.pack(anchor=tk.W)

        subtitle = ttk.Label(
            root,
            text="Choose one file or a whole folder. The GUI calls the existing CLI, so batch mode remains unchanged.",
            wraplength=800,
        )
        subtitle.pack(anchor=tk.W, pady=(4, 14))

        mode_frame = ttk.LabelFrame(root, text="Mode", padding=12)
        mode_frame.pack(fill=tk.X)

        for idx, mode in enumerate(MODES.values()):
            radio = ttk.Radiobutton(
                mode_frame,
                text=mode.label,
                value=mode.key,
                variable=self.mode_var,
                command=self._apply_mode_defaults,
            )
            radio.grid(row=idx // 3, column=idx % 3, sticky=tk.W, padx=(0, 18), pady=3)

        self.help_label = ttk.Label(mode_frame, text="", wraplength=800)
        self.help_label.grid(row=2, column=0, columnspan=3, sticky=tk.W, pady=(8, 0))

        files_frame = ttk.LabelFrame(root, text="Files / Folders", padding=12)
        files_frame.pack(fill=tk.X, pady=(12, 0))
        files_frame.columnconfigure(1, weight=1)

        self.input_label = ttk.Label(files_frame, text="Input")
        self.input_label.grid(row=0, column=0, sticky=tk.W, padx=(0, 10), pady=4)
        ttk.Entry(files_frame, textvariable=self.input_var).grid(row=0, column=1, sticky=tk.EW, pady=4)
        self.input_button = ttk.Button(files_frame, text="Browse...", command=self._browse_input)
        self.input_button.grid(row=0, column=2, padx=(10, 0), pady=4)

        self.output_label = ttk.Label(files_frame, text="Output")
        self.output_label.grid(row=1, column=0, sticky=tk.W, padx=(0, 10), pady=4)
        ttk.Entry(files_frame, textvariable=self.output_var).grid(row=1, column=1, sticky=tk.EW, pady=4)
        self.output_button = ttk.Button(files_frame, text="Save as...", command=self._browse_output)
        self.output_button.grid(row=1, column=2, padx=(10, 0), pady=4)

        options_frame = ttk.LabelFrame(root, text="Options", padding=12)
        options_frame.pack(fill=tk.X, pady=(12, 0))
        self.options_frame = options_frame

        self.recursive_check = ttk.Checkbutton(options_frame, text="Include subfolders", variable=self.recursive_var)
        self.recursive_check.grid(row=0, column=0, sticky=tk.W, padx=(0, 18))
        self.body_only_check = ttk.Checkbutton(options_frame, text="Body only", variable=self.body_only_var)
        self.body_only_check.grid(row=0, column=1, sticky=tk.W, padx=(0, 18))
        self.safe_only_check = ttk.Checkbutton(options_frame, text="Safe area only", variable=self.safe_only_var)
        self.safe_only_check.grid(row=0, column=2, sticky=tk.W, padx=(0, 18))
        self.translated_check = ttk.Checkbutton(options_frame, text="Use translated text", variable=self.translated_var)
        self.translated_check.grid(row=0, column=3, sticky=tk.W, padx=(0, 18))

        actions = ttk.Frame(root)
        actions.pack(fill=tk.X, pady=(12, 0))
        self.run_button = ttk.Button(actions, text="Run", command=self._run)
        self.run_button.pack(side=tk.LEFT)
        ttk.Button(actions, text="Open output folder", command=self._open_output_folder).pack(side=tk.LEFT, padx=(8, 0))
        ttk.Button(actions, text="Clear log", command=self._clear_log).pack(side=tk.LEFT, padx=(8, 0))

        self.status_label = ttk.Label(root, textvariable=self.status_var)
        self.status_label.pack(anchor=tk.W, pady=(10, 4))

        log_frame = ttk.LabelFrame(root, text="Log", padding=8)
        log_frame.pack(fill=tk.BOTH, expand=True)
        log_frame.rowconfigure(0, weight=1)
        log_frame.columnconfigure(0, weight=1)

        self.log_text = tk.Text(log_frame, height=12, wrap=tk.WORD)
        self.log_text.grid(row=0, column=0, sticky=tk.NSEW)
        scrollbar = ttk.Scrollbar(log_frame, orient=tk.VERTICAL, command=self.log_text.yview)
        scrollbar.grid(row=0, column=1, sticky=tk.NS)
        self.log_text.configure(yscrollcommand=scrollbar.set)

        self._append_log(f"Repo root: {self.repo_root}")

    def _current_mode(self) -> ModeConfig:
        return MODES[self.mode_var.get()]

    def _apply_mode_defaults(self) -> None:
        mode = self._current_mode()
        self.input_label.configure(text=mode.input_label)
        self.output_label.configure(text=mode.output_label)
        self.help_label.configure(text=mode.help_text)
        self.input_button.configure(text="Choose folder..." if mode.input_kind == "folder" else "Browse...")
        self.output_button.configure(text="Choose folder..." if mode.output_kind == "folder" else "Save as...")

        is_folder_mode = mode.input_kind == "folder"
        is_export = mode.key in {"export", "export-folder"}
        self.recursive_check.configure(state=tk.NORMAL if is_folder_mode else tk.DISABLED)
        for widget in (self.body_only_check, self.safe_only_check, self.translated_check):
            widget.configure(state=tk.NORMAL if is_export else tk.DISABLED)

        input_path = self.input_var.get().strip()
        if input_path:
            self._suggest_output_path(input_path)

    def _browse_input(self) -> None:
        mode = self._current_mode()
        if mode.input_kind == "folder":
            selected = filedialog.askdirectory(title=f"Select {mode.input_label}")
        else:
            selected = filedialog.askopenfilename(
                title=f"Select {mode.input_label}",
                filetypes=mode.input_filetypes,
            )
        if selected:
            self.input_var.set(selected)
            self._suggest_output_path(selected)

    def _browse_output(self) -> None:
        mode = self._current_mode()
        if mode.output_kind == "folder":
            selected = filedialog.askdirectory(title=f"Choose {mode.output_label}")
        else:
            selected = filedialog.asksaveasfilename(
                title=f"Choose {mode.output_label}",
                defaultextension=mode.output_default_ext,
                filetypes=mode.output_filetypes,
                initialfile=Path(self.output_var.get()).name if self.output_var.get() else None,
                initialdir=str(Path(self.output_var.get()).parent) if self.output_var.get() else None,
            )
        if selected:
            self.output_var.set(selected)

    def _suggest_output_path(self, input_path: str) -> None:
        mode = self._current_mode()
        path = Path(input_path)
        if mode.key == "convert":
            suggested = path.with_suffix(".md")
        elif mode.key == "review":
            suggested = path.with_suffix(".review.json")
        elif mode.key == "export":
            name = path.name
            if name.endswith(".review.json"):
                suggested = path.with_name(name[: -len(".review.json")] + ".md")
            else:
                suggested = path.with_suffix(".md")
        elif mode.key == "convert-folder":
            suggested = path.parent / f"{path.name}-markdown"
        elif mode.key == "review-folder":
            suggested = path.parent / f"{path.name}-review-json"
        elif mode.key == "export-folder":
            suggested = path.parent / f"{path.name}-markdown"
        else:  # pragma: no cover - defensive guard for future modes
            suggested = path
        self.output_var.set(str(suggested))

    def _build_command(self) -> list[str]:
        input_path = self.input_var.get().strip()
        output_path = self.output_var.get().strip()
        if not input_path:
            raise ValueError("Please choose an input file or folder.")
        if not output_path:
            raise ValueError("Please choose an output file or folder.")

        mode_config = self._current_mode()
        input_obj = Path(input_path)
        if not input_obj.exists():
            raise FileNotFoundError(f"Input path does not exist: {input_path}")
        if mode_config.input_kind == "folder" and not input_obj.is_dir():
            raise ValueError(f"Input must be a folder for this mode: {input_path}")
        if mode_config.input_kind == "file" and not input_obj.is_file():
            raise ValueError(f"Input must be a file for this mode: {input_path}")

        node = resolve_node_command()
        cli = self.repo_root / "apps" / "cli" / "bin" / "unified-pdf2md.js"
        mode = mode_config.key

        if mode in {"convert-folder", "review-folder", "export-folder"}:
            command = [
                node,
                str(cli),
                mode,
                "--inputFolderPath",
                input_path,
                "--outputFolderPath",
                output_path,
            ]
            if self.recursive_var.get():
                command.append("--recursive")
            if mode == "export-folder":
                self._append_export_options(command)
            return command

        command = [node, str(cli), mode, input_path, "-o", output_path]
        if mode == "export":
            self._append_export_options(command)
        return command

    def _append_export_options(self, command: list[str]) -> None:
        if self.body_only_var.get():
            command.append("--body-only")
        if self.safe_only_var.get():
            command.append("--safe-only")
        if self.translated_var.get():
            command.append("--translated")

    def _run(self) -> None:
        if self.worker and self.worker.is_alive():
            messagebox.showinfo("unified-pdf2md", "A conversion is already running.")
            return

        try:
            command = self._build_command()
        except Exception as exc:
            messagebox.showerror("Cannot run", str(exc))
            return

        self.run_button.configure(state=tk.DISABLED)
        self.status_var.set("Running...")
        self._append_log("\n$ " + " ".join(self._quote_for_log(part) for part in command))

        self.worker = threading.Thread(target=self._run_command_worker, args=(command,), daemon=True)
        self.worker.start()

    def _run_command_worker(self, command: list[str]) -> None:
        try:
            process = subprocess.Popen(
                command,
                cwd=str(self.repo_root),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            assert process.stdout is not None
            for line in process.stdout:
                self.message_queue.put(("log", line.rstrip("\n")))
            return_code = process.wait()
            if return_code == 0:
                self.message_queue.put(("done", "Completed successfully."))
            else:
                self.message_queue.put(("error", f"Command failed with exit code {return_code}."))
        except Exception as exc:
            self.message_queue.put(("error", str(exc)))

    def _poll_queue(self) -> None:
        try:
            while True:
                kind, message = self.message_queue.get_nowait()
                if kind == "log":
                    self._append_log(message)
                elif kind == "done":
                    self.status_var.set(message)
                    self._append_log(message)
                    self.run_button.configure(state=tk.NORMAL)
                    messagebox.showinfo("unified-pdf2md", message)
                elif kind == "error":
                    self.status_var.set("Error")
                    self._append_log("ERROR: " + message)
                    self.run_button.configure(state=tk.NORMAL)
                    messagebox.showerror("unified-pdf2md", message)
        except queue.Empty:
            pass
        self.after(100, self._poll_queue)

    def _open_output_folder(self) -> None:
        output_path = self.output_var.get().strip()
        if output_path:
            path = Path(output_path)
            folder = path if self._current_mode().output_kind == "folder" else path.parent
        else:
            folder = self.repo_root
        folder.mkdir(parents=True, exist_ok=True)
        if sys.platform.startswith("win"):
            os.startfile(str(folder))  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(folder)])
        else:
            subprocess.Popen(["xdg-open", str(folder)])

    def _clear_log(self) -> None:
        self.log_text.delete("1.0", tk.END)

    def _append_log(self, message: str) -> None:
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)

    @staticmethod
    def _quote_for_log(value: str) -> str:
        if any(ch.isspace() for ch in value):
            return '"' + value.replace('"', '\\"') + '"'
        return value


def main() -> int:
    app = Pdf2MdGui()
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
