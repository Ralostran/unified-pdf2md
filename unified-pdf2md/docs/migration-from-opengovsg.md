# Migration from opengovsg/pdf2md

## Library usage

Old usage:

```js
const pdf2md = require('@opendocsg/pdf2md')
const markdown = await pdf2md(pdfBuffer, callbacks)
```

New low-level usage:

```js
const { convertPdfBufferToMarkdown } = require('@unified-pdf2md/pdf-core')
const markdown = await convertPdfBufferToMarkdown(pdfBuffer, { callbacks })
```

The wrapper still calls `@opendocsg/pdf2md` by default.

## CLI usage

Old usage:

```bash
npx @opendocsg/pdf2md --inputFolderPath=./pdfs --outputFolderPath=./md --recursive
```

New direct conversion:

```bash
unified-pdf2md convert input.pdf -o out.md
```

New compatibility folder conversion:

```bash
unified-pdf2md convert-folder --inputFolderPath ./pdfs --outputFolderPath ./md --recursive
```

## New review workflow

OpenGovSG-style Markdown conversion is still available, but you can now produce review JSON:

```bash
unified-pdf2md convert input.pdf -o out.md --review-json input.review.json
unified-pdf2md export input.review.json -o reviewed.md --body-only
```

## Compatibility notes

- Page breaks remain compatible with `<!-- PAGE_BREAK -->`.
- The default conversion dependency is still `@opendocsg/pdf2md`.
- The unified CLI has more explicit commands rather than one folder-only CLI.
- If you need the exact old package behavior, you can still call `@opendocsg/pdf2md` directly.
