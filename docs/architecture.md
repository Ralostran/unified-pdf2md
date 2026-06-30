# Architecture

## Goals

`unified-pdf2md` provides two modes over one document model:

1. **Batch conversion**: PDF to Markdown using the OpenGovSG converter.
2. **Review conversion**: PDF to review JSON, optional human/automation edits, then final Markdown/translation export.

The architecture avoids a full rewrite. The conversion engine, review operations, CLI, and UI are split so each layer can be replaced independently.

## Components

### `packages/pdf-core`

Responsibilities:

- Read PDF files.
- Call `@opendocsg/pdf2md` by default.
- Return Markdown.
- Convert Markdown into the shared `Document` model for review mode.

Boundaries:

- Does not own review operations.
- Does not own translation.
- Does not assume a UI.

### `packages/document-model`

Responsibilities:

- Define the JSON schema.
- Provide constructors and validation helpers.
- Provide stable IDs and helper functions for pages/blocks.

This package is intentionally small and has no external runtime dependency.

### `packages/review-engine`

Responsibilities:

- Safe area application.
- Visibility toggling.
- Body/non-body flags.
- Merge/split operations.
- Reading-order adjustment.
- Paragraph chaining across blocks/pages.
- Markdown export.
- Translation orchestration through an injected translator function.

This package is deterministic by default. Heuristic decisions are explicitly marked in `classification.method`.

### `apps/cli`

Responsibilities:

- Public command surface.
- Batch conversion.
- Review JSON creation.
- Markdown export from review JSON.
- Translation via `UNIFIED_PDF2MD_TRANSLATE_COMMAND`.
- Compatibility command for OpenGovSG-style folder conversion.

### `apps/reviewer`

Future UI placeholder. Any UI must read/write the shared review JSON.

### `apps/reviewer-python`

Compatibility boundary for the legacy eiaserinnys Python app. The adapter deliberately avoids importing the UI and only defines JSON load/save rules.

## Pipeline

```text
PDF
  ↓
packages/pdf-core
  ↓
Markdown from OpenGovSG converter
  ↓
Document review JSON
  ↓
review-engine operations / interactive reviewer
  ↓
reading-order reconstruction + chaining
  ↓
Markdown export
  ↓
optional translation export
```

## Deterministic vs heuristic behavior

Deterministic:

- `visible`, `body`, and `safe` flags once set manually.
- Safe-area containment when block bounding boxes exist.
- Merge/split when the selected block IDs and separator are specified.
- In-page ordering operations.
- Explicit block chaining.
- Markdown export from the current document state.

Heuristic:

- Initial block creation from Markdown paragraphs.
- Initial heading detection from Markdown heading syntax.
- Future body/non-body auto-classification from fonts, coordinates, caption patterns, tables, images, or equations.

The schema records this distinction in `block.classification.method`.

## Extension points

### Image extraction

Add `Block.type = "image"`, store asset metadata in `block.source` or a future `assets` collection, and use `block.markdown` for export formatting.

### Table extraction

Add `Block.type = "table"`, preserve Markdown table text in `block.markdown`, and later store structured cells under a new `table` field if needed.

### Equation handling

Add `Block.type = "equation"`, store source LaTeX/OCR/image metadata, and export via configurable Markdown/HTML syntax.

### Export formatting

`exportMarkdown()` already centralizes formatting. Add options there before adding presentation logic in CLI/UI.

### MHTML export

Implement as a separate exporter package once assets/images are represented in the document model.

## Error handling principles

- Fail fast on invalid review JSON.
- Throw actionable errors when `@opendocsg/pdf2md` is missing.
- Translation providers are external; failed blocks are marked as failed with an error.
- UI code should not mutate hidden global state; edits should persist to review JSON.
