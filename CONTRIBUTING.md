# Contributing to SuperCommands

SuperCommands was previously called cmdOS. The configured public publishing target is [supercommands/supercommands](https://github.com/supercommands/supercommands). Use SuperCommands in product-facing copy; preserve internal compatibility names unless a change explicitly covers migration.

Read the [Code of Conduct](CODE_OF_CONDUCT.md) and [security policy](SECURITY.md). Do not publish vulnerabilities or private user data in public issues.

## Ways to contribute

- Report reproducible bugs with browser, OS, and extension version details.
- Suggest features by explaining the workflow and problem they address.
- Improve setup and contributor documentation.
- Submit focused fixes using existing code patterns.
- Discuss implementation on a relevant issue, or in Discussions if enabled.

Search [existing issues](https://github.com/supercommands/supercommands/issues) before opening one. Include expected behavior, actual behavior, reproduction steps, and relevant errors. Remove tokens, private URLs, personal records, and account identifiers from logs and screenshots.

Confirm substantial UI or architecture changes with maintainers before implementing them. This document does not imply that Discussions, a wiki, templates, or private security reporting are enabled.

This repository includes bug/feature issue forms, a pull request template, and discussion forms for the General and Ideas categories. These files are included in the public export. Discussion forms require GitHub Discussions to be enabled and matching category slugs (`general` and `ideas`). Maintainers configure those repository settings; adding files alone does not enable Discussions.

## Development setup

Use Node.js `>=22.12.0` and pnpm `9.15.1`.

```bash
git clone https://github.com/supercommands/supercommands.git
cd supercommands
pnpm install
pnpm dev
```

Load `.output/chrome-mv3/` through Chrome's **Load unpacked** action. Reload the extension and refresh affected website tabs after rebuilding. Check **Alt + S Search** at `chrome://extensions/shortcuts` if Alt+S is not assigned.

```bash
pnpm build
pnpm zip
```

Public dev/build/zip commands select the open-source configuration automatically. Private source defaults remain unchanged; use `pnpm dev:oss`, `pnpm build:oss`, or `pnpm run wxt:zip:chrome:oss` there for the public configuration. The public `env.oss` is Google Drive configuration, not a place for secrets.

## Where to work

| Path | Responsibility |
| --- | --- |
| `src/pages/AltS_search_newtab/` | New-tab workspace |
| `src/pages/AltS_search_websites/` | Shared website and New Tab popup |
| `background/src/websitePopupBridge/` | Background popup handlers |
| `src/allObjectFolder/` | Record features and domain operations |
| `src/shared-components/` | Shared UI, search, commands, and branding |
| `src/storage/` | Schema, migrations, and storage helpers |
| `src/settings/` | Settings and backup/restore |
| `packages/` | Shared workspace packages |

Keep the current folder structure and reuse registry-owned theme, typography, spacing, and appearance values. Ask before introducing a design token or visual pattern. Preserve saved records, favorites, backup compatibility, and existing workflows.

## Preparing a pull request

1. Fork the public repository and create a focused branch from `main`.
2. Explain the problem and keep changes within that scope.
3. Verify affected website/New Tab flows with an isolated profile and disposable data. Back up data you need to keep.
4. Run checks appropriate to the change and report their actual results. `pnpm type-check` checks workspace types; `pnpm lint` and `pnpm prettier` can write fixes. Disclose existing unrelated failures.
5. Open a pull request against `main` describing the behavior change, verification, and remaining limitations. Include sanitized UI evidence when relevant.

The public export does not include private test fixtures, internal documents, or publishing workflows. Do not make unavailable scripts part of public setup instructions. Discuss new test coverage with maintainers when needed.

Use concise messages such as `fix: restore popup focus` or `docs: clarify OSS setup`. Follow existing TypeScript/React patterns and avoid unrelated formatting or renames.
