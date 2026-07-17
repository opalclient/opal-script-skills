# Security Policy

## The Opal scripting sandbox model

Opal scripts run **sandboxed by design**. A script is JavaScript on GraalJS, and
the context it runs in is built default-deny:

- **`HostAccess.EXPLICIT`** — only members annotated `@HostAccess.Export` on
  Opal's own proxy/wrapper classes are reachable, plus a small explicit
  allow-list (`java.awt.Color`'s constructors and `getRGB()`). Un-annotated
  types expose nothing: no member access, no bean-property mapping, no
  container access.
- **`allowHostClassLookup(name -> false)`** — `Java.type(...)` is denied. A
  script cannot reach any class it was not handed as a pre-bound global.
- **`IOAccess.NONE`** — no filesystem access. Process creation, thread creation,
  and native access are all off as well.

**Java imports are off deliberately, and permanently.** That property is what
makes a public script gallery viable: a script's entire reachable surface is the
documented scripting API, so it can be read and reasoned about. Treat any
request to work around it as a red flag rather than a problem to solve.

The sandbox bounds what a script can *reach* on the host. It does not decide
whether a script is something a user wants to run, so the client still gates
untrusted code:

- Community and public scripts are **quarantined to `opal/scripts/pending`** and
  do not execute until the user explicitly chooses **"Trust & run"**.
- Only the user's own trusted scripts live in `opal/scripts` and run on load.

Guidance — for users and for anyone (including AI assistants) generating scripts:

- **Audit before trusting.** Read a script fully before moving it out of
  `pending` or accepting a "Trust & run" prompt.
- Never advise a user to bypass the trust prompt or to blindly trust a script
  from an untrusted source.
- Authors should keep scripts self-contained and to their stated, obvious
  purpose.

If you find a way for a script to escape the sandbox described above — reaching
a host class, the filesystem, or an un-exported member — that is a
vulnerability in the client. Report it (see below) rather than documenting it.

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
