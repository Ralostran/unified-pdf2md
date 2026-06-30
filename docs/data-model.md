# Data model

The intermediate model is a JSON document. It is designed to hold both automatic converter output and manual review annotations.

Schema file:

```text
packages/document-model/src/schema/document.schema.json
```

## Entity overview

```text
Document
  metadata
  Page[]
    Block[]
      Span[]
      links
      translation
      classification
```

## Document

Required fields:

- `schemaVersion`: currently `1.0.0`.
- `metadata`: source and audit information.
- `pages`: ordered page list.

Important metadata fields:

- `metadata.source.type`: `pdf`, `markdown`, `review-json`, or `unknown`.
- `metadata.source.path`: optional source file path.
- `metadata.source.converter`: converter name.
- `metadata.language`: source language if known.
- `metadata.targetLanguage`: target translation language if used.
- `metadata.createdAt`, `metadata.updatedAt`.

## Page

Required fields:

- `id`: stable page ID.
- `index`: zero-based page index.
- `blocks`: page blocks.

Optional fields:

- `width`, `height`.
- `safeArea`: rectangle used to classify blocks inside/outside the primary content area.

## Block

Required fields:

- `id`: stable block ID.
- `pageId`: parent page ID.
- `order`: reading order within page.
- `type`: `text`, `heading`, `caption`, `table`, `image`, `equation`, or `unknown`.
- `text`: plain text.
- `visible`: whether the block is exported.
- `body`: whether the block is body text for paragraph chaining/translation.
- `safe`: whether the block is inside the safe area.

Optional fields:

- `markdown`: source Markdown when formatting should be preserved.
- `bbox`: block bounding box.
- `spans`: lower-level text spans with font/geometry.
- `classification`: method/reason/confidence.
- `links`: chain relation to previous/next blocks.
- `translation`: translated text and status.
- `source`: upstream provenance.

## Chaining

A chain is represented on blocks:

```json
{
  "links": {
    "nextBlockId": "block_b",
    "chainSeparator": "space"
  }
}
```

The next block stores:

```json
{
  "links": {
    "previousBlockId": "block_a"
  }
}
```

`chainSeparator` may be:

- `space`: join fragments into one paragraph without a hard line break.
- `newline`: join fragments with a line break.

## Translation

Translation is attached per block:

```json
{
  "translation": {
    "sourceLang": "en",
    "targetLang": "ko",
    "text": "...",
    "provider": "custom-command",
    "status": "translated",
    "updatedAt": "2026-06-30T00:00:00.000Z"
  }
}
```

Translation status may be `pending`, `translated`, `failed`, or `skipped`.

## Review operation mapping

| eiaserinnys workflow | Unified model representation |
|---|---|
| Safe area | `Page.safeArea`, `Block.safe` |
| Visibility toggle | `Block.visible` |
| Body/non-body | `Block.body`, `Block.type`, `Block.classification` |
| Concat / split | `mergeBlocks(... preserveLineBreaks=false)`, `splitBlock()` |
| Join / split | `mergeBlocks(... preserveLineBreaks=true)`, `splitBlock()` |
| Order adjustment | `Block.order`, `moveBlock()` |
| Chain paragraphs | `Block.links.previousBlockId`, `Block.links.nextBlockId`, `Block.links.chainSeparator` |
| Translation | `Block.translation` |

## Backward compatibility

- OpenGovSG-style page breaks are preserved by splitting Markdown on `<!-- PAGE_BREAK -->`.
- OpenGovSG folder conversion semantics are available through `convert-folder`.
- Legacy Python reviewer state should be converted to this schema before export.
