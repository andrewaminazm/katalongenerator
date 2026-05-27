# Project Intelligence v2 — Architecture

## Role

Extends v1 indexing (`projectIntelligence/`) with **control**, **self-healing**, and **documentation** — deterministic first, AI for suggestions only.

## Pipeline

```
ProjectIndex (v1) + source files on disk
        │
        ▼
┌───────────────────┐
│ projectGraphV2    │  nodes: scripts, OR, keywords, suites, APIs
│                   │  edges + reverse index + orphans/duplicates
└─────────┬─────────┘
          │
    ┌─────┴─────┬─────────────┬──────────────┐
    ▼           ▼             ▼              ▼
scriptAnalyzer  orAnalyzer   insightsEngine  documentationGenerator
    │           orHealer
    ▼
scriptFixer (deterministic Groovy patches)
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/projects/:projectId/v2/analyze` | Full v2 JSON response |
| `GET` | `/api/projects/:projectId/v2/graph` | Project graph only |

### Request body (`POST …/v2/analyze`)

```json
{
  "healScripts": true,
  "healLocators": true,
  "generateDocumentation": true,
  "maxScripts": 150
}
```

### Response shape

Matches `ProjectIntelligenceV2Result` in `types.ts` (`fixes`, `documentation`, `projectGraph`, `insights`).

## Healing rules (deterministic)

| Rule ID | Action |
|---------|--------|
| `thread_sleep` | `Thread.sleep(ms)` → `WebUI.delay(seconds)` |
| `missing_test_object` | Semantic OR remap via `matchTestObjectsForStep` |
| `missing_wait_after_action` | Insert `WebUI.delay(1)` after `WebUI.click` |
| OR low stability | Propose higher-priority selector from alternatives |

## Integration points

- **v1 index**: `loadProjectIndex`, `ParsedTestScript`, `ParsedTestObject`
- **Semantic match**: `semanticMatcher` for OR remaps
- **Healing scores**: `healing/healingScorer` for locator priority (id > name > css > xpath)
- **AI memory**: optional `codingStyleProfile` merged into insights
- **Playwright batch heal**: call existing `POST /api/heal/locator` per element URL (future hook from `orHealer`)

## Constraints

- Groovy output must remain valid Katalon Studio syntax
- No wholesale script rewrite — line-level, explainable diffs
- Confidence + severity on every fix
