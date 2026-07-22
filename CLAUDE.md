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
  reference.md                   module/settings/event model index + keys
  reference/core.md              client, notification, overlay, modules, mc
  reference/character.md         player, movement, rotation, inventory, interaction
  reference/world.md             world, esp, bound types (BlockPos, Vec2f, ...)
  reference/ui.md                renderer, palette
  palette-views.md               worked palette-view example
bin/install.mjs               <- the installer CLI (no deps, ESM)
adapters/                     <- static per-AI surfaces, generated FROM the skill
  claude-code/commands/          /new-opal-script scaffolding command (plugin only)
test/install.test.mjs         <- node --test coverage for the installer
test/skill-content.test.mjs   <- node --test tripwire: every proxy/global still mentioned
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
  API. The client's Java is the source of truth: a member is script-callable
  **only** if it carries `@HostAccess.Export` (the sandbox is
  `HostAccess.EXPLICIT`, default-deny). No annotation → it does not exist for
  scripts, whatever any doc, typing, or example claims. The shipped scripts
  (`ScriptScaffold.js`, `Chomp.js`) are the idiom reference. Do not invent
  methods or globals, and verify before documenting — docs promising members
  the sandbox denies is exactly how this skill has shipped bugs before.
- **The two silent traps.** `mc.player`/`mc.world` do not exist (getters only:
  `mc.getPlayer()`/`mc.getWorld()`), and every collection is a `ScriptList`
  (`size()`/`isEmpty()`/`get(i)`), never an array. Both fail *silently* as
  `undefined`, so every example must model the correct form — agents copy
  examples verbatim.
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
