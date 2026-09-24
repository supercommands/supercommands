# Security Policy

## Supported Versions

Only the latest release of the SuperCommands open-source extension is supported for security updates. If you find a security issue, please ensure you are testing against the latest version on the `main` branch.

---

## Reporting a Vulnerability

We take the security of SuperCommands seriously. If you find a security vulnerability, please do **NOT** open a public issue or post exploit details in a public discussion.

To report a vulnerability, visit the repository's [Security page](https://github.com/supercommands/supercommands/security) and use **Report a vulnerability** if that private-reporting option is available. If it is unavailable, ask the maintainers for a private reporting channel through a [GitHub Discussion](https://github.com/supercommands/supercommands/discussions) without disclosing vulnerability details publicly.

In the private report, include a detailed description, steps to reproduce, the affected version, and any proof-of-concept scripts or screenshots. Please also review our [Code of Conduct](CODE_OF_CONDUCT.md).

We will acknowledge your report within 48 hours and work with you to analyze and patch the vulnerability before releasing a public advisory.

---

## Scope of Protection

This security policy covers:
* The core local-first storage and encryption algorithms.
* Permissions and Content Security Policies (CSP) defined in the extension manifest.
* Safe handling of credentials and API keys in user-configured integrations.
