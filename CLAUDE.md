# CLAUDE.md

Guidance for AI agents (Claude Code and others) working in this repository.

## What this repo is

`@opalclient/opal-script-skills` ships a **portable AI-assistant skill** that
teaches an assistant how to write [Opal](https://opal.wtf) Minecraft-client
JavaScript scripts, plus a **cross-AI installer** that renders that skill into
any assistant's project surface.

It is a tiny, dependency-free Node (ESM) package. There is nothing to compile.

## Mental model

```
skills/opal-scripting/        <- SOURCE OF TRUTH. Edit the skill here.
  SKILL.md                       the skill (frontmatter: name + trigger description)
  reference.md                   full API surface
  palette-views.md               worked palette-view example
bin/install.mjs               <- the installer CLI (no deps, ESM)
adapters/                     <- static per-AI surfaces, generated FROM the skill
test/install.test.mjs         <- node --test coverage for the installer
```

The skill content is the product. The installer and adapters are delivery
mechanisms — they must never drift from `skills/opal-scripting/`.

## How to change things

- **Improving the skill** → edit files in `skills/opal-scripting/`, then
  regenerate the generated adapters (see CONTRIBUTING.md) so they stay in sync.
- **Adding an install target** → add an entry to `TARGETS` in `bin/install.mjs`,
  add it to the detector list if it has a natural marker file, and add a test in
  `test/install.test.mjs`.
- **Always run `npm test`** (`node --test`) before committing.

## Hard rules

- **Accuracy of the API.** The skill must describe only the real Opal scripting
  API. The authoritative examples are the client's shipped scripts
  (`ScriptScaffold.js`, `Pacman.js`). Do not invent methods or globals.
- **The color rule.** Colors are always built with `renderer.color(...)`, never
  raw `0xAARRGGBB` literals. This is load-bearing — keep it prominent.
- **No machine paths or secrets.** Never commit a `C:\Users\...` path, a home
  path, a token, or any account identifier. Use placeholders.
- **Conventional Commits.** Every commit subject follows Conventional Commits
  (`feat:`, `fix:`, `docs:`, `chore:`, …). Never add an AI-attribution trailer.
- **No runtime dependencies.** The installer must stay dependency-free so `npx`
  is instant and safe.

## Conventions

- Node ≥ 18, ESM only (`type: module`).
- Tests: `node --test`, no test framework.
- Keep the skill tight and skimmable; depth goes in `reference.md` /
  `palette-views.md`.
