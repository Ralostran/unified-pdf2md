# Migration from eiaserinnys/pdf2md

## What stays familiar

The review concepts are preserved:

- Safe area.
- Visibility toggle.
- Body/non-body classification.
- Concat/split.
- Join/split.
- Order adjustment.
- Chaining paragraphs across blocks/pages.
- Translation pipeline.

## What changes

The stable state format is now `*.review.json`, not UI-specific cached state.

Old command:

```bash
python -m src.main --f paper.pdf
```

New staged flow:

```bash
unified-pdf2md review paper.pdf -o paper.review.json
# Review/edit paper.review.json in a compatible UI
unified-pdf2md export paper.review.json -o paper.md --body-only
```

Translation is provider-agnostic:

```bash
UNIFIED_PDF2MD_TRANSLATE_COMMAND="python scripts/translate.py" \
  unified-pdf2md translate paper.review.json --to ko -o paper.ko.review.json
```

## Legacy UI handling

The existing Tkinter app can be retained temporarily as a sub-app, but it should read/write the unified schema through `apps/reviewer-python/unified_adapter.py`.

Recommended migration sequence:

1. Keep the original Python UI runnable in its own environment.
2. Add an import adapter from `paper.review.json` to the UI state.
3. Add an export adapter from UI state back to `paper.review.json`.
4. Move pure operations into `packages/review-engine` when behavior is stable.
5. Replace UI-specific manipulation logic with calls to the shared operations.

## Environment variable mapping

| Old variable | New/compatible variable |
|---|---|
| `CACHE_DIR` | `UNIFIED_PDF2MD_CACHE_DIR` |
| `EXPORT_DIR` | `UNIFIED_PDF2MD_EXPORT_DIR` |
| `OPENAI_API_KEY` | Use inside your translation command, not the core engine |
| `PROMPT_DIR` | Use inside your translation command |
| `DEEPL_RAPID_API_*` | Use inside your translation command |
| `TEXT_FONT`, `TEXT_FONT_SIZE` | UI-specific; keep inside reviewer app |

## Notes

- Image/table/equation extraction remains an extension target.
- The first phase does not port the Tkinter UI to JavaScript because doing so would be a rewrite.
- The goal is to separate business logic from UI gradually.
