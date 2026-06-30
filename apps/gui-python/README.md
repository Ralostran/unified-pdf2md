# GUI wrapper

This is a thin Python/Tkinter desktop wrapper around the Node.js CLI. It does not reimplement conversion logic.

## Windows

```cmd
cd C:\Users\Admin\unified-pdf2md
run-gui.bat
```

Or run directly:

```cmd
python apps\gui-python\unified_pdf2md_gui.py
```

## macOS/Linux

```bash
python3 apps/gui-python/unified_pdf2md_gui.py
```

## Supported modes

Single-file modes:

- Convert PDF → Markdown
- Create review JSON from PDF
- Export review JSON → Markdown

Folder modes:

- Convert PDF folder → Markdown folder
- Create review JSON folder from PDF folder
- Export review JSON folder → Markdown folder

Folder modes support `Include subfolders`. Relative subfolder structure is preserved in the output folder.

## Notes

- The GUI calls `node apps/cli/bin/unified-pdf2md.js` internally.
- Run `npm install` before using the GUI, or use `run-gui.bat` on Windows to install dependencies automatically.
- Translation is still configured through the CLI environment variable `UNIFIED_PDF2MD_TRANSLATE_COMMAND`.
