# Merge plan

## Source repo analysis

| Dimension | eiaserinnys/pdf2md | opengovsg/pdf2md | Merge implication |
|---|---|---|---|
| Primary language/runtime | Python 3, Tkinter desktop UI, PyMuPDF/pdfminer, OpenAI/DeepL-style translation hooks | JavaScript/CommonJS Node package and CLI | Do not rewrite either side in Phase 1. Keep Node as the unified CLI runtime and preserve Python as a legacy reviewer app boundary. |
| Product intent | Academic paper PDF review: layout inspection, paragraph restructuring, translation, export | General PDF to Markdown library and CLI | Use OpenGovSG as conversion core and eiaserinnys as the review workflow source. |
| Entry points | `python -m src.main --f ...`; `--l` lists fonts; clipboard URL/path fallback | Library: `require('@opendocsg/pdf2md')`; CLI: `pdf2md --inputFolderPath=... --outputFolderPath=... --recursive` | Unified CLI should expose direct commands but keep a folder-conversion compatibility command. |
| Top-level structure | `src/canvas`, `src/pdf`, `src/service`, `src/toolbar`, `src/main.py`, `src/pdf_viewer.py`, `requirements.txt` | `lib`, `lib/models`, `lib/util`, `types`, `test`, `examples`, `package.json` | Monorepo should separate conversion, review data model, review operations, CLI, and UI adapters. |
| Dependencies | `PyMuPDF`, `pdfminer.six`, `Pillow`, `tkinter`, `openai`, `requests`, `python-dotenv`, `pyperclip`, etc. | `@opendocsg/pdf2md` package dependencies include `unpdf`, `minimist`, `enumify`; dev deps include Mocha/Chai/ESLint | Node CLI can remain lightweight; Python deps should stay scoped to legacy reviewer app. |
| Public API/CLI | Desktop UI with toolbar actions; no stable programmatic API | Promise-based function returning Markdown; folder CLI | Define stable API at monorepo level: `convert`, `review`, `export`, `translate`. |
| PDF pipeline | Load PDF, derive visual/text elements, cache context, allow human manipulation, export text/translation | Parse PDF with PDF.js/unpdf, transform pages/items into Markdown, join with `<!-- PAGE_BREAK -->` | OpenGovSG handles default conversion; review-engine consumes Markdown and later raw-block adapters. |
| Core parsing | Python `src/pdf` extracts PDF elements and state for UI; parsing is coupled with review state | `lib/pdf2md.js`, `lib/util/pdf.js`, `lib/models/*`, transformation model | Reuse OpenGovSG via dependency first; avoid copying internals until a raw-block API is required. |
| UI/editor/post-processing | Tkinter UI: safe area, visibility, body, concat/split, join/split, ordering, chaining, translation | No interactive editor | Implement post-processing in `packages/review-engine`; keep UI replaceable. |
| Overlap | Both parse PDFs and export text-ish outputs | Both process pages and text blocks | Avoid dual-parser conflict: one canonical core converter, one canonical review model. |
| Complementarity | Human correction and translation for academic papers | Stable conversion package/CLI | Best combined as a staged monorepo with adapters. |

## Considered strategies

### 1. JS engine + Python orchestration

- Pros: Python reviewer can orchestrate the JS converter without rewriting its UI.
- Cons: CLI release becomes Python-first; packaging Node dependency inside Python is awkward; two dependency managers are exposed to normal users.
- Verdict: Useful as a legacy bridge, not ideal as the primary architecture.

### 2. Python app calls JS core via subprocess

- Pros: Very low risk for the existing eiaserinnys UI.
- Cons: Batch CLI and library users inherit the heavier Python/Tkinter stack; conversion remains indirect.
- Verdict: Acceptable for legacy reviewer mode only.

### 3. Monorepo multi-package

- Pros: Lowest rewrite risk; conversion, review engine, CLI, and UI can evolve independently; supports JS package release and a Python sub-app.
- Cons: Requires clear input/output contracts and duplicated build tooling at first.
- Verdict: Chosen.

### 4. Port Python review logic to JS/TS

- Pros: Single runtime and easier future web UI.
- Cons: High rewrite risk; eiaserinnys logic is coupled to Tkinter canvas interactions and PDF element state.
- Verdict: Phase 2/3 option after schema stabilizes.

### 5. Port JS core to Python

- Pros: Single runtime for the current Python UI.
- Cons: Highest risk; discards the more mature OpenGovSG package/CLI architecture.
- Verdict: Rejected.

## Selected architecture

Use a **multi-package monorepo**:

```text
packages/pdf-core        Adapter around @opendocsg/pdf2md
packages/document-model  Shared review JSON schema and validation helpers
packages/review-engine   Deterministic review/post-processing operations
apps/cli                 Unified CLI
apps/reviewer            Future interactive review UI
apps/reviewer-python     Legacy Python reviewer adapter contract
docs                     Architecture and migration notes
```

This gives the least risky path because the OpenGovSG conversion remains the default core and eiaserinnys workflows are represented as operations over a shared intermediate model rather than being hard-coded into a specific UI.

## Phase scope

### Phase 1: Adapter-first unification

- Create monorepo structure.
- Add root CLI commands: `convert`, `review`, `export`, `translate`, `convert-folder`.
- Use `@opendocsg/pdf2md` as runtime dependency for conversion.
- Convert Markdown into a review JSON model.
- Implement deterministic review operations: visibility, body flags, safe area, merge/split, ordering, chaining, Markdown export.
- Define JSON schema.
- Document migration from both source repos.

### Phase 2: Better raw-block integration

- Add an OpenGovSG raw-block callback adapter so review JSON preserves coordinates, fonts, line items, images, and tables when available.
- Add import/export adapters for eiaserinnys cached state.
- Move non-UI eiaserinnys operations into `packages/review-engine` if equivalent behavior is missing.
- Add sample PDFs and golden Markdown fixtures.

### Phase 3: Interactive review UI

- Either retain and refactor the Tkinter app to read/write the unified schema, or build a new web/Electron/Tauri UI.
- Add image/table/equation review panels.
- Add MHTML export if there is a concrete product requirement.
- Add translation providers behind the same translation interface.

## Trade-offs

- **Dependency vs vendoring**: The current implementation declares `@opendocsg/pdf2md` as a dependency instead of copying the whole source. This is lower risk and keeps upstream compatibility. Vendoring can be done later if a forked raw-block API is required.
- **Node-first CLI**: The unified CLI is Node-first because OpenGovSG is already a Node library/CLI. Python remains available for interactive legacy UI work.
- **Schema before UI rewrite**: The JSON schema is the compatibility layer. UI migration is intentionally delayed until behavior and storage format are stable.
- **Translation provider abstraction**: Translation is implemented via a command interface to avoid hard-coding one vendor API into the core engine.

## License and dependency notes

Both source repositories identify as MIT licensed on GitHub. Keep license headers and upstream attribution when copying source files into this monorepo. The first phase avoids copying code wholesale, so license risk is low, but dependency notices should still mention OpenGovSG and eiaserinnys in release documentation.
