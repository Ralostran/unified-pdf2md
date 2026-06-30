# Reviewer app placeholder

This directory is reserved for the future interactive review UI. Phase 1 does not port the Python Tkinter UI to web/JS because that would increase merge risk.

Current contract:

1. `unified-pdf2md review input.pdf -o input.review.json` creates a JSON document in the shared schema.
2. Any reviewer UI edits `visible`, `body`, `safe`, `order`, `links`, and `translation` fields.
3. `unified-pdf2md export input.review.json -o output.md` exports final Markdown.

A future UI can be implemented as React, Electron, Tauri, or a retained Python Tkinter app as long as it reads/writes the same JSON schema.
