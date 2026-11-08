# EventPool

A resource-sharing platform for UM student clubs to list, discover and borrow event equipment from each other.
Built for WIX2002 (Project Management).

**Deployed prototype:** _to be added by M7/M8 (Week 8)_

## Getting started

```bash
npm ci
npm run dev      # start the dev server, open the URL Vite prints
npm run build    # production build
```

## Project structure

| Path | Purpose |
| --- | --- |
| `src/components/` | Shared UI components (Layout, Navbar, Button, Card, FormField, StatusMessage, PageHeader) |
| `src/styles/theme.css` | Design tokens (colours, spacing). Update here once `docs/design-system.md` is final |
| `src/pages/` | Page components. `borrower/` = borrower-facing (M5), owner pages = M6 |
| `docs/` | Requirements, test plan, design system, API contracts, `BUGS.md` |
| `evidence/` | Project evidence for the report: `screenshots/`, `interviews/`, `meetings/`, `finance/`, `pm-board/` |

## Routes

| Route | Page |
| --- | --- |
| `/` | Home |
| `/login` | Log in |
| `/marketplace` | Resource marketplace (search, filters) |
| `/marketplace/:resourceId` | Resource details |
| `/marketplace/:resourceId/request` | Borrow request form |
| `/requests` | My requests |
| `/dashboard`, `/club/:clubId`, `/dashboard/*`, `/sustainability` | Owner pages (M6) |

## Workflow

- Every task lives on the Jira board. Done = built, tested by M9, screenshot saved to `evidence/`.
- Never push to `main`. Branch from `main` (`feat/<short-name>`, `fix/<BUG-id>-<short-name>`), open a pull request, get at least one review, then merge.
- Reference the Jira key (e.g. `EPM-24`) or `BUGS.md` ID in PR titles.
- Frontend work follows the Figma handoff from M3/M4 and the API contracts in `docs/api-contracts.md`.
