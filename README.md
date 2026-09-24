<div align="center">

<img src="https://raw.githubusercontent.com/cmdOS-App/cmdOS/main/src/shared-components/assets/cmdOS_logo.png" alt="supercommands" width="80" height="80" />

# supercommands


**A keyboard-first command terminal for the browser.**

Access search, browser commands, and web shortcuts — all from one command bar.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12.0-brightgreen)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.15.1-orange)](https://pnpm.io)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[**Getting Started**](#getting-started) · [**Features**](#features) · [**Contributing**](#contributing) · [**Wiki**](https://github.com/supercommands-app/supercommands/wiki) · [**Community**](https://github.com/supercommands-app/supercommands/community) · [**Security**](https://github.com/supercommands-app/supercommands/security) · [**Code of Conduct**](CODE_OF_CONDUCT.md) · [**License**](#license)

</div>


---

## What is supercommands?

supercommands is a Chrome extension that replaces repetitive browser actions with keyboard commands. Instead of navigating menus, bookmarks, and tabs manually, you open supercommands with `Alt + S` and run commands from one place.

It is entirely **local-first** — your data stays on your machine. No account required to use the core features.

---

## Features

### ⌨️ Command Palette

Open supercommands with `Alt + S` from any page and run commands instantly.

```
/notes           → Open your notes
/link            → Create or open a saved link
/screenshot      → Capture the current page
/shortcuts       → Manage keyboard shortcuts
```


```

### 🛠️ Browser Commands

Built-in commands available from the command bar:

- Visible-page and full-page screenshots
- Image download from current page
- Table extraction and CSV export
- Print-friendly PDF generation

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 19, TypeScript |
| Build | WXT, Vite 6, Turborepo |
| Styling | Tailwind CSS |
| Package manager | pnpm workspaces |
| Local Database | Dexie.js (IndexedDB) — all data stored locally on device |
| Storage | Chrome Extension APIs (local-first) |
| Extension | Manifest V3 |

---

## Repository Structure

<pre>
supercommands/
├── background/                  # Service worker, manifest, extension bootstrap
├── packages/                    # Shared internal packages (monorepo)
│   ├── ui/                      # Design system components
│   ├── shared/                  # Utility helpers and schemas
│   ├── storage/                 # Chrome storage helpers
│   ├── env/                     # Environment variable schemas
│   └── module-manager/          # Core module configuration
├── src/
│   ├── allObjectFolder/         # Core object types — the heart of the extension
│   │   └── src/createObject/
│   │       ├── links/           # Link and Tab Session objects
│   │       ├── notes/           # Rich note objects
│   │       ├── snippets/        # Reusable text snippets
│   │       ├── commands/        # Command definitions and handlers
│   │       ├── session/         # Session tracking objects
│   │       ├── automationBeta/  # Automation workflow objects
│   │       ├── ChatAgent/       # AI agent integration
│   │       ├── aiPrompt/        # AI prompt objects
│   │       ├── todos/           # Task and to-do objects
│   │       └── tags/            # Tag management
│   ├── settings/                # Extension settings UI and logic
│   │   ├── authentication/      # Login and auth UI
│   │   ├── backup/              # Data backup and restore
│   │   ├── generalSettingsPageUi/  # General settings panel
│   │   ├── uiPersonalization/   # Theme and appearance settings
│   │   ├── uxLayoutCustomization/  # Layout customization options
│   │   └── allWorkspaceManager/ # Workspace and folder management
│   ├── storage/                 # Storage abstraction layer
│   ├── shared-components/       # Reusable UI components and utilities
│   ├── welcomeGuide/            # Onboarding and tutorial flows
│   └── pages/                   # Extension entry points
│       ├── AltS_search_newtab/  # Primary new tab workspace dashboard
│       ├── popup/               # Browser toolbar popup
│       ├── contentScript/       # Injected content scripts
│       └── content-ui/          # Injected UI overlays
├── docs/                        # Documentation and guides
└── .env                         # Environment config (pre-configured for local dev)
</pre>


---

## Getting Started

### Prerequisites

- **Node.js** `>= 22.12.0` — [Download](https://nodejs.org)
- **pnpm** `>= 9.15.1` — `npm install -g pnpm`
- Google Chrome or any Chromium-based browser

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/supercommands-App/supercommands.git
cd supercommands
```

**2. Install dependencies**

```bash
pnpm install
```

The `.env` file is already pre-configured with the OSS extension public key and Google OAuth client ID. No changes needed to run locally.

---

### Development

Start the WXT dev server with hot reload:

```bash
pnpm dev
```

Then load the extension in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `.output/chrome-mv3/` directory

WXT watches your files and automatically reloads the extension when you save changes. All your notes, snippets, and data are stored locally in **Dexie.js (IndexedDB)** — nothing leaves your device.

---

### Building

Build the production extension (with the shared OSS extension ID locked):

```bash
pnpm run wxt:build:chrome:oss
```

The built extension will be in `.output/chrome-mv3/`. Load it in Chrome:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select `.output/chrome-mv3/`

> The `wxt:build:chrome:oss` command automatically sets the correct build variant, loads the OSS environment file, and locks the shared extension ID so Google OAuth redirect URIs match for all contributors.

To create a `.zip` ready for the Chrome Web Store:

```bash
pnpm run wxt:zip:chrome:oss
```

---

### Type Checking

```bash
pnpm type-check
```

### Linting

```bash
pnpm lint
pnpm prettier
```

---

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md) before opening a pull request.

---

## License

Copyright © 2024–2026 RPA TASKLABS AUTOMATION SOFTWARE PRIVATE LIMITED · [Apache License 2.0](LICENSE)
