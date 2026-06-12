# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.2.x   | ✅        |
| < 2.2   | ❌        |

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Use GitHub's private vulnerability reporting for this repository:
**Security → Report a vulnerability** (or
<https://github.com/voicetel/api-collections/security/advisories/new>).

Include, where possible:

- A description of the issue and its impact
- Steps to reproduce or a proof of concept
- Affected version(s) and configuration

You can expect an acknowledgement within a few business days. Please
allow reasonable time for a fix before any public disclosure.

## Scope Notes

This repository ships Postman v2.1 and Bruno collections plus the
zero-dependency Node ESM build scripts that generate them from the
VoiceTel REST API OpenAPI spec. Hardening expectations:

- The shipped collections use Postman variable placeholders
  (`{{accountSid}}`, `{{apiKey}}`) and the Bruno environment file
  declares the same. Do not commit a populated environment file —
  the placeholders carry no secret value by design.
- The build scripts read the OpenAPI YAML/JSON and write only into
  the repo tree; they make no network calls.

Out of scope: vulnerabilities in Postman, Bruno, or third-party
clients that consume these collections; credential leakage caused
by environment files that were populated and committed downstream.
