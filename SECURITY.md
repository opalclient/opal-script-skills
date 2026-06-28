# Security Policy

## The Opal scripting trust model

Opal scripts run **full-trust by design**: a script has complete filesystem and
client access with no sandbox. This is intentional — it lets power users
automate anything — but it means a script can read or write arbitrary files,
exfiltrate data, or run arbitrary code on the machine.

Mitigations the client provides:

- Community and public scripts are **quarantined to `opal/scripts/pending`** and
  do not execute until the user explicitly chooses **"Trust & run"**.
- Only the user's own trusted scripts live in `opal/scripts` and run on load.

Guidance — for users and for anyone (including AI assistants) generating scripts:

- **Audit before trusting.** Read a script fully before moving it out of
  `pending` or accepting a "Trust & run" prompt.
- Never advise a user to bypass the trust prompt or to blindly trust a script
  from an untrusted source.
- Authors should keep scripts self-contained and avoid touching files outside the
  client's own data unless that is the script's stated, obvious purpose.

## Scope of this repository

This repository contains **documentation and a dependency-free installer** — no
runtime code is shipped into the client. The installer performs only local file
writes (rendering Markdown into your project), makes no network calls, and has no
dependencies.

## Reporting a vulnerability

If you find a security issue in this repository (for example, the installer
writing outside its target directory):

- Open a private security advisory on the repository, or
- Email the maintainers at `security@opal.wtf`.

Please do not open a public issue for a suspected vulnerability. We aim to
acknowledge reports within a few business days.
