# Contributing

Thanks for helping improve the Opal scripting skill.

## Project shape

- `skills/opal-scripting/` — **the source of truth.** Edit the skill here.
- `bin/install.mjs` — the cross-AI installer (dependency-free ESM).
- `adapters/` — static per-assistant surfaces, **generated from the skill**.
- `test/install.test.mjs` — `node --test` coverage for the installer.

## Editing the skill

1. Change the relevant file under `skills/opal-scripting/`.
2. Keep the API accurate: it must match the real Opal scripting API. **The
   client's Java is the only source of truth** — a member is script-callable
   only if it carries `@HostAccess.Export`, because the sandbox is
   `HostAccess.EXPLICIT` (default-deny). No annotation → it does not exist for
   scripts. Verify against the proxy class before documenting a member; do not
   trust an existing doc, typing, or example. The shipped scripts
   (`ScriptScaffold.js`, `Pacman.js`) are useful for idiom but some lag the
   current API — do not treat them as authoritative. Do not invent methods or
   globals.
3. Keep `SKILL.md` tight and skimmable; put depth in `reference.md` /
   `palette-views.md`.

## Regenerating the adapters

The `codex` / `gemini` / `copilot` adapter surfaces are produced by the
installer, so they never drift from the skill:

```bash
node bin/install.mjs add --target codex   --dir adapters/codex
node bin/install.mjs add --target gemini  --dir adapters/gemini
node bin/install.mjs add --target copilot --dir adapters/copilot
```

The `claude-code` adapter is the Claude Code **plugin** form; copy the skill
files into it when they change (this preserves the `reference/` subfolder):

```bash
cp -r skills/opal-scripting/. adapters/claude-code/skills/opal-scripting/
```

The plugin also ships a `/new-opal-script` command
(`adapters/claude-code/commands/new-opal-script.md`) that scaffolds a new
script file. It references the skill files by relative path — keep it in sync
if the reference layout changes again.

## Tests

```bash
npm test     # node --test
```

Add a test for any new install target or installer behavior.

## Commits

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <imperative summary>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`, `ci`.
Keep one logical change per commit. Do not add AI-attribution trailers.

## Ground rules

- No runtime dependencies — keep the installer instant and safe under `npx`.
- No machine paths (`C:\Users\...`, `/home/...`), tokens, or account IDs in any
  committed file. Use placeholders.
- Be kind; see the [Code of Conduct](CODE_OF_CONDUCT.md).
