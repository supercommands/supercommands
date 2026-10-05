# SuperCommands security policy

This policy covers the SuperCommands browser extension, previously cmdOS, in the configured public repository [supercommands/supercommands](https://github.com/supercommands/supercommands).

## Reporting a vulnerability

Do not publish exploit details, access tokens, private records, or credential-bearing logs in a public issue or discussion.

Visit the repository's [Security page](https://github.com/supercommands/supercommands/security). If **Report a vulnerability** is enabled, use it to submit a private report. Otherwise, ask maintainers for a private reporting route through an existing public issue without revealing vulnerability details. This repository does not establish a dedicated security email or a response-time commitment.

Include the affected version or commit, browser/OS, reproduction steps, expected and actual behavior, impact, and a minimal proof of concept using disposable data. Remove personal records and credentials from attachments.

## Scope

- Extension permissions, content scripts, message validation, and page isolation.
- IndexedDB, local storage, migrations, and backup/restore.
- User-configured integration credentials and Google Drive authorization.
- Build, export, and dependency changes that could expose private data or credentials.

Local-first storage does not claim that every record is encrypted or that integrations work offline. Google Drive backup exchanges backup data with Google; external AI services have their own authorization and data handling.

## Versions and disclosure

Include the exact affected version or commit. If possible, check whether the issue affects current `main` using an isolated profile. This document does not establish an older-version support matrix or guarantee a remediation deadline.

Coordinate disclosure privately with maintainers where a private route is available. Avoid publishing sensitive details before affected users can receive a fix.

## Public export configuration

The OSS environment allows a public Google OAuth client ID and a non-secret Drive enable flag. It excludes client secrets, extension signing keys, private environment files, publishing tools, and generated outputs. Never add credentials or personal tokens to source code or sample configuration.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Conduct reports and software vulnerability reports are separate processes.
