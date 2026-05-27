# UI/UX Modernization — Katalon Script Generator

Additive frontend modernization (no backend or business-logic changes). Inspired by Linear, Vercel, and ChatGPT-style AI workspaces.

## Stack added

| Layer | Package |
|-------|---------|
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Motion | Framer Motion |
| Icons | Lucide React |
| Command palette | cmdk |
| UI primitives | shadcn-style (`Button`, `Card`, `Badge`, `Skeleton`) via CVA |
| Charts (ready) | Recharts |

Legacy `index.css` variables remain the source of truth; `styles/globals.css` bridges them into Tailwind tokens.

## Architecture

```
RootApp
├── ThemeProvider (light/dark, persisted)
├── UiStoreProvider (sidebar, ⌘K palette)
└── RoutedContent
    ├── GeneratorPage → PlatformShell + App (embedded)
    ├── /ai-workspace → PlatformShell + AIWorkspace
    ├── /coverage → PlatformShell + CoverageAnalyzer
    ├── /refactor → PlatformShell + RefactoringAssistant
    └── /how-to-use → PlatformShell + HowToUse
```

### Key paths

| Path | Role |
|------|------|
| `components/layout/PlatformShell.tsx` | Sidebar + top bar + main |
| `components/layout/Sidebar.tsx` | Grouped nav, collapse animation |
| `components/layout/TopNavbar.tsx` | Status, search, theme, help |
| `components/layout/CommandPalette.tsx` | ⌘K / Ctrl+K actions |
| `components/navigation/navConfig.ts` | Nav groups + command list |
| `theme/ThemeProvider.tsx` | Dark/light |
| `stores/uiStore.tsx` | UI chrome state |
| `hooks/useGeneratorTabUrl.ts` | `?tab=` deep links for generator |
| `components/ui/*` | Design-system primitives |
| `components/dashboard/*` | Metric cards, score rings (for dashboards) |

## UX features delivered

1. **Collapsible sidebar** — Functional / Gosi Brain / Intelligence / Utilities groups with Lucide icons and AI badges.
2. **Sticky top navbar** — Title, Gosi Brain status, active project, command search, theme toggle, help + tour.
3. **Command palette** — Raycast-style overlay (`⌘K` / `Ctrl+K`).
4. **URL-synced tabs** — Sidebar switches generator tabs via `/?tab=api` etc.
5. **Embedded layout** — Generator and satellite pages hide duplicate headers; content fills shell.
6. **Premium dark mode** — Centralized theme; gradient mesh backgrounds; glass panels.
7. **Modern tab strip** — Refined active states on generator (embedded mode).

## Not changed (by design)

- All API calls and server routes
- Generator, API Test, Performance, Failure Analyzer logic
- Existing CSS for forms/panels (still works inside new shell)

## Next phases (optional)

- Wire Recharts into Coverage/Refactor dashboards
- Framer Motion on chat messages (streaming feel)
- Full shadcn CLI component set
- Mobile sidebar drawer
- Smart Assertions dedicated route when backend exists

## Local verify

```bash
npm run dev
```

Open `http://localhost:5173/` — use sidebar and `⌘K`. Navigate to `/ai-workspace`, `/coverage`, `/refactor`.
