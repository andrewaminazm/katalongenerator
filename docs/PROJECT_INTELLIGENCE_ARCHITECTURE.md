# Katalon Project Intelligence — Architecture

Modular extension to **Katalon Script Generator**. Does not replace the deterministic compiler; it **enriches** generation with indexed project assets.

## Pipeline

```
Upload .zip / .rar / register folder path. Indexes Object Repository, Keywords, and **test scripts** under `Scripts/`, `Test Cases/`, `Include/scripts/groovy/`, and `Libs/` (not `.tc` metadata or Test Suite runners).
  → projectScanner (extract + walk)
  → parsers (OR .rs, Keywords .groovy, Test Cases, Suites, Profiles)
  → projectKnowledgeGraph
  → cache in server/data/projects/{projectId}/
  
Generate request + projectId + mode
  → load index
  → generationPlanner (semantic match per step)
  → merge OR paths into locators + optional CustomKeywords ops
  → compileKatalonScript (unchanged core)
  → validation
```

## Priority (generation)

1. Existing custom keyword (`CustomKeywords.'…'`)
2. Existing Test Object (`findTestObject('Page/…')`)
3. Reusable flow hint (comments / suggestions)
4. Inline TestObject / WebUI (compiler default)

## Modes

| Mode | OR threshold | Keyword threshold |
|------|----------------|-------------------|
| `strict_reuse` | 0.62 | 0.68 |
| `balanced` | 0.42 | 0.50 |
| `generate_everything` | 0.95 | 0.95 (effectively hints only) |

## Storage

`server/data/projects/{projectId}/`

- `meta.json` — id, name, dates, stats
- `index.json` — full parsed index (cached)
- `source/` — extracted zip (optional)
- `file-hashes.json` — incremental re-parse

## Security

- Zip bombs: size cap on upload (multer limit).
- Local folder path only if `KATALON_PROJECT_LOCAL_PATH_ALLOWED=1`.
- Paths normalized; no traversal outside project root.
- Parsing is fault-tolerant (per-file try/catch).

## Future workers

Background job queue (`parseProjectJob`) for large repos — stub via `POST /api/projects/:id/reindex` async flag.

## Semantic providers (pluggable)

`semanticMatcher.ts` implements **local TF-IDF + token Dice** today. Hooks:

- `OLLAMA_EMBEDDINGS_URL` — optional
- `GEMINI_EMBEDDINGS` — optional

Fallback order: embeddings → fuzzy token match → path/name heuristics.
