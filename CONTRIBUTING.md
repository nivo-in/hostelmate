# Contributing to HostelMate

Thank you for your interest in contributing! HostelMate is built with care and we welcome all contributions — from bug fixes to new features, documentation improvements, and test coverage.

---

## Getting Started

### 1. Fork & Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/<your-username>/hostelmate.git
cd hostelmate
```

### 2. Install Dependencies

```bash
# Installs dependencies for the entire monorepo (client + server)
# Also automatically installs Husky git hooks
pnpm install
```

### 3. Set Up Environment Variables

Copy the example environment files and fill in your credentials:

```bash
# Server
cp apps/server/.env.example apps/server/.env

# Client
cp apps/client/.env.example apps/client/.env.local
```

See the [README Environment Variables](README.md#environment-variables) section for full documentation of each variable.

### 4. Start the Development Server

```bash
# Starts both client (port 3000) and server (port 3001) concurrently
pnpm dev
```

---

## Development Workflow

### Branching Strategy

We follow a simplified Git Flow:

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation updates |
| `refactor/<name>` | Code restructuring without behavior changes |
| `chore/<name>` | Maintenance, dependency updates |

```bash
# Create a feature branch from main
git checkout -b feature/your-feature-name
```

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional-scope>): <short description>
```

| Type | When to Use |
|------|-------------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation changes only |
| `style` | Formatting changes (no logic change) |
| `refactor` | Code restructuring without behavior changes |
| `perf` | Performance improvements |
| `test` | Adding or modifying tests |
| `chore` | Maintenance, dependency updates |
| `ci` | CI/CD configuration changes |

**Examples:**
```
feat(parent): add leave status filter chips
fix(ui): align NotificationBell parent theme to #60a5fa
docs: add CHANGELOG.md with full release history
test(server): add edge case tests for payment verification
```

---

## Pre-Commit Checks

Every `git commit` automatically runs:

1. **ESLint** on `apps/client` — Next.js Core Web Vitals + TypeScript rules
2. **Jest** on `apps/server` — All 23 integration test suites

If either check fails, the commit is **blocked**. Fix the errors, then commit again.

```bash
# To bypass hooks in an emergency (not recommended):
git commit --no-verify -m "chore: emergency fix"
```

---

## Testing

### Backend Tests (Jest)

```bash
cd apps/server

# Run all 23 test suites (261 tests)
pnpm test

# Watch mode
pnpm test:watch

# Coverage report (≥80% threshold enforced)
pnpm test:coverage
```

### Frontend E2E Tests (Playwright)

```bash
cd apps/client

# Headless Chromium (auto-starts both dev servers)
pnpm test:e2e

# Interactive Playwright UI with time-travel debugging
pnpm test:e2e-ui
```

### TypeScript Type Check

```bash
cd apps/client
pnpm exec tsc --noEmit
```

---

## Code Style

### TypeScript / TSX

- Use TypeScript for all new code
- Prefer explicit types over `any`
- Name interfaces with PascalCase (e.g., `FeePayment`, `StudentInfo`)
- Use `const` by default, `let` only when reassignment is needed

### CSS / Styling

- All styling is done with **inline JSX style objects** (CSS-in-JS)
- Use the global CSS classes from `PageShell.tsx` where applicable:
  - `.glass-card` — hoverable card with backdrop blur
  - `.row-hover` — hoverable table row
  - `.hm-input` — standard dark form input
  - `.hm-input-blue` — Parent theme input focus ring
  - `.skeleton` — shimmer loading placeholder

### Color Palette

| Role | Accent Color | Hex |
|------|-------------|-----|
| Warden | Purple | `#7c5cfc` |
| Student | Orange | `#fb923c` |
| Parent | Blue | `#60a5fa` |
| Success | Green | `#4ade80` |
| Error | Red | `#f87171` |

---

## Submitting a Pull Request

1. Ensure your branch is up-to-date with `main`:
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. Run the full test suite locally before opening a PR:
   ```bash
   pnpm lint && pnpm test
   ```

3. Open a Pull Request on GitHub with:
   - A clear **title** following Conventional Commits format
   - A **description** of what changed and why
   - Screenshots/recordings for UI changes
   - Reference to any related issues (e.g., `Closes #42`)

4. A maintainer will review your PR and provide feedback within **3 business days**.

---

## Project Structure

Refer to the [Project Structure](README.md#-project-structure) section in the README for a full overview of the monorepo layout.

Key directories for contributors:

| Path | What lives here |
|------|----------------|
| `apps/client/app/(dashboard)/` | Role-based page components |
| `apps/client/components/ui/` | Shared UI components (`PageShell`, `NotificationBell`, etc.) |
| `apps/client/hooks/` | Custom React hooks (`useApi`, `useProfile`, `useSocket`) |
| `apps/server/src/routes/` | Express route handlers |
| `apps/server/src/middleware/` | Auth, RBAC, validation, rate limiting |
| `apps/server/__tests__/` | Jest integration test suites |
| `apps/client/e2e/` | Playwright E2E test specs |

---

## Questions?

Open a [GitHub Discussion](https://github.com/nivo-in/hostelmate/discussions) or reach out at **hello@nivo.in**.

We appreciate every contribution, large or small. 🎉
