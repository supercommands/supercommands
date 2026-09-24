# Contributing to SuperCommands

Thank you for your interest in contributing to SuperCommands. This document covers how to get involved, where to look, and how to raise issues or submit changes.

Read the [Code of Conduct](CODE_OF_CONDUCT.md) and [security policy](SECURITY.md) before reporting an issue. Report suspected vulnerabilities privately as described in the security policy.

---

## Ways to Contribute

You don't have to write code to contribute. There are many ways to help:

- **Report a bug** — open an issue with steps to reproduce
- **Suggest a feature** — describe the problem you're trying to solve
- **Improve documentation** — fix typos, add examples, clarify setup steps
- **Submit a fix or feature** — open a pull request with a focused change
- **Share feedback** — comment on open issues or discussions

---

## Codebase Overview

Before diving in, here's where the core logic lives:

### `src/allObjectFolder/`

This is the heart of the extension. Every object type (link, note, snippet, command, session, automation, tag, etc.) is structured and managed here.

```
src/allObjectFolder/src/createObject/
├── links/          # Link and Tab Session objects
├── notes/          # Rich note objects
├── snippets/       # Reusable text snippets
├── commands/       # Command definitions
├── session/        # Session tracking
├── automationBeta/ # Automation workflows
├── ChatAgent/      # AI agent integration
├── aiPrompt/       # AI prompt objects
├── todos/          # Task objects
└── tags/           # Tag management
```

If you want to add a new object type, extend an existing one, or fix behaviour in a specific feature — this is where to look first.

### `src/pages/AltS_search_newtab/`

The primary workspace UI — the new tab page where users interact with cmdOS.

### `packages/`

Shared utilities, design system, storage helpers, and environment config used across all entry points.

---

## Raising an Issue

Before opening an issue:

- Search [existing issues](https://github.com/supercommands/supercommands/issues) to avoid duplicates
- Check if there's already a related discussion

When opening a new issue, include:

- **What you expected** to happen
- **What actually happened**
- **Steps to reproduce** (browser version, OS, extension version if known)
- **Screenshots or console errors** if relevant

For **feature requests**, describe the problem you're facing — not just the solution you have in mind. That helps us understand the use case better.

---

## Development Setup

**Prerequisites**

- Node.js `>= 22.12.0`
- pnpm `>= 9.15.1`

**Setup**

```bash
git clone https://github.com/supercommands/supercommands.git
cd supercommands
pnpm install
pnpm dev
```

Load the extension in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the `dist/` folder

---

## Submitting a Pull Request

1. **Fork** the repository and create a branch from `main`

   ```bash
   git checkout -b fix/your-fix-name
   # or
   git checkout -b feat/your-feature-name
   ```

2. **Make your change** — keep it focused. One change per PR.

3. **Test it locally** — load the extension and verify your change works as expected.

4. **Lint and format**

   ```bash
   pnpm lint
   pnpm prettier
   ```

5. **Open a PR** against the `main` branch with a clear title and description explaining:
   - What problem this solves
   - How you tested it
   - Any edge cases or limitations

---

## Commit Style

Use conventional commits:

```
feat: add dynamic link placeholder support
fix: resolve snippet insertion on Firefox
docs: update getting started guide
refactor: simplify tag filtering logic
```

---

## Code Style

- TypeScript is required — no untyped `any` unless absolutely necessary
- Components use React functional style
- Keep files focused — one component or module per file
- Follow the existing folder structure and naming conventions in `allObjectFolder/`

---

## Questions

If you're unsure about something, open a [GitHub Discussion](https://github.com/cmdOS-App/supercommands/discussions) or comment on the relevant issue. We're happy to help you get oriented before you start building.
