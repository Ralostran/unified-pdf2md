# unified-pdf2md

`unified-pdf2md` is a staged monorepo design that combines two complementary projects:

- `opengovsg/pdf2md` as the default PDF-to-Markdown conversion core.
- `eiaserinnys/pdf2md` style academic-paper review workflows: safe area, visibility, body/non-body classification, concat/split, join/split, order adjustment, paragraph chaining, and translation.

The core principle is low-risk reuse. The OpenGovSG converter remains the default engine instead of being rewritten. The academic review features are implemented against a shared JSON document model so the old Python UI, a future web UI, and CLI batch workflows can operate on the same data.

## When to use each mode

Use **convert mode** when you only need batch PDF to Markdown conversion:

```bash
unified-pdf2md convert input.pdf -o out.md
```

Use **review mode** when an academic PDF needs human correction before final export:

```bash
unified-pdf2md review input.pdf -o paper.review.json
# edit paper.review.json in a reviewer UI or automation
unified-pdf2md export paper.review.json -o paper.md --body-only
```

Use **translate mode** after review annotations have been created:

```bash
UNIFIED_PDF2MD_TRANSLATE_COMMAND="python scripts/translate.py" \
  unified-pdf2md translate paper.review.json --to ko -o paper.ko.review.json
unified-pdf2md export paper.ko.review.json -o paper.ko.md --translated --body-only
```

## CLI examples

```bash
# Direct conversion
unified-pdf2md convert input.pdf -o out.md

# Conversion plus review JSON
unified-pdf2md convert input.pdf -o out.md --review-json input.review.json

# Create review JSON only
unified-pdf2md review input.pdf -o input.review.json

# Export edited review JSON
unified-pdf2md export input.review.json -o out.md --body-only

# Backward-compatible folder conversion style
unified-pdf2md convert-folder --inputFolderPath ./pdfs --outputFolderPath ./md --recursive
```

## Architecture overview

```text
packages/pdf-core        OpenGovSG adapter; PDF -> Markdown and PDF -> unified Document
packages/document-model  Shared JSON schema and model helpers
packages/review-engine   Safe area, visibility/body flags, merge/split, ordering, chaining, export
apps/cli                 Unified CLI for convert/review/export/translate
apps/reviewer            Future interactive review UI placeholder
apps/reviewer-python     Legacy Python adapter contract
```

## Development setup

```bash
npm install
npm run check
```

`@opendocsg/pdf2md` is declared as a dependency. In test environments without external packages, `packages/pdf-core` accepts an injected converter so smoke tests can run without a fixture PDF or network access.

## Current merge status

Completed in this phase:

- Monorepo structure.
- Unified CLI.
- Shared document schema.
- Review-engine operations for safe area, visibility, body flags, merge/split, order, chain, translation hooks, and Markdown export.
- OpenGovSG converter adapter.
- Legacy Python reviewer adapter contract.
- Tests for smoke conversion, ordering/chaining, visibility/body filtering, and Markdown export.

Temporary/adapted in this phase:

- The full OpenGovSG source is not vendored; the package dependency is used to reduce merge risk.
- The eiaserinnys Tkinter UI is not ported; it is retained as a legacy integration target via shared JSON.
- Translation is provider-agnostic through `UNIFIED_PDF2MD_TRANSLATE_COMMAND`.
