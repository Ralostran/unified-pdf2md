# Legacy eiaserinnys Python reviewer adapter

The original eiaserinnys/pdf2md application is a Tkinter/PyMuPDF/pdfminer workflow for academic-paper review. In this monorepo it should be treated as a legacy sub-app until its UI and business logic are separated.

Because the merge strategy avoids rewriting the UI in Phase 1, this directory contains a stable adapter contract rather than a full port:

- Input: unified review JSON, or a PDF path that can be converted into review JSON.
- Output: unified review JSON.
- Business operations such as safe area, visibility, body flags, order, merge, split, and chaining belong in `packages/review-engine`.
- UI code should call those operations or write equivalent fields in the shared document model.

To launch a checked-out legacy app, set `EIASERINNYS_PDF2MD_PATH` to the original repository path and run its original command from there. Do not copy ad-hoc state files back into the monorepo without converting them to the shared schema.
