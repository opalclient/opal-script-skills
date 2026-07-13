# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-07-13

### Added

- `renderWorld` event, previously entirely undocumented, added to `SKILL.md`'s
  event list and to the full event payload table in `reference.md`.
- Full documentation of `mc.interactionManager` (7 methods: `interactBlock`,
  `updateBlockBreakingProgress`, `cancelBlockBreaking`, `isBreakingBlock`,
  `attackEntity`, `interactItem`, `stopUsingItem`) in the new
  `reference/character.md`.
- Full documentation of the bound type globals: `BlockPos`, `Vec2f`,
  `Direction`, `RaytracedRotation` (script-safe wrappers), `Vec3d`, `Vec3i`,
  `MathHelper` (intermediary-named, construct/pass-through only), `Color`
  (directly callable), and the `MAIN_HAND`/`OFF_HAND` constants, in the new
  `reference/world.md`.
- Full `modules` (`ModuleProxy`) documentation — all 11 methods (`exists`,
  `isEnabled`, `setEnabled`, `toggle`, `getCategory`, `getSuffix`,
  `isVisible`, `setVisible`, `listAll`, `listCategory`, `listEnabled`), up
  from 2, in the new `reference/core.md`.
- Full reference tables for `player` (29 methods), `world` (14),
  `inventory` (17), `movement` (17), `rotation` (18), `esp` (7), `client`
  (16), and the `mc` facade — replacing the old "members vary by build, read
  a shipped example" hedge with the real, stable, fully-documented API.
- `bin/install.mjs` `commands/new-opal-script` (Claude Code plugin only): a
  slash command that scaffolds a new Opal script file (module registration,
  a settings example, and event handlers) from a working template.
- `test/skill-content.test.mjs`: a dependency-free `node --test` tripwire
  that fails if any documented proxy/global name disappears from the skill
  content, so a future proxy addition or accidental deletion doesn't
  silently drift the shipped skill out of sync with the real API.

### Changed

- `reference.md` split: it now indexes the module/settings/event model and
  the `keys` table, with the per-proxy member tables moved into
  `reference/core.md`, `reference/character.md`, `reference/world.md`, and
  `reference/ui.md` (mirroring the upstream `core/`, `character/`, `world/`,
  `ui/` doc categories). `bin/install.mjs`'s `claude-code` (`dir` mode) and
  `cursor`/`generic` (`file` mode) targets both updated to include the new
  files; all previously-passing installer tests still pass unchanged in
  behavior, only the expected file list grew.
- Fixed `reference.md`'s `addGroup` documentation, which disagreed with
  `SKILL.md` and the real signature (`addGroup(name, [settingNames])` groups
  *already-declared* settings by name — it does not group "the settings that
  follow").
- `adapters/claude-code` grew from a skill-only plugin into a fuller plugin:
  added `commands/new-opal-script.md` and declared `commands` in
  `.claude-plugin/plugin.json`.

## [0.1.0] - 2026-06-28

### Added

- Source-of-truth `opal-scripting` skill in `skills/opal-scripting/`: `SKILL.md`
  (structure, settings, events, renderer + color rule, palette views, dynamic
  islands, full-trust security model, common mistakes), `reference.md` (full API
  surface), and `palette-views.md` (a complete `palette.createView` example).
- Cross-AI installer `bin/install.mjs` (`opal-skills add` / `list`) supporting
  the `claude-code`, `codex`, `gemini`, `copilot`, `cursor`, `windsurf`, and
  `generic` targets, with auto-detection, `--all`, idempotent delimited blocks,
  and no runtime dependencies.
- Static manual adapters in `adapters/` for Claude Code (plugin form), Codex
  (`AGENTS.md`), Gemini (`GEMINI.md`), and Copilot (`copilot-instructions.md`).
- `node --test` coverage for the installer across all targets.
- Repository governance: README, LICENSE (MIT), CONTRIBUTING, CODE_OF_CONDUCT,
  SECURITY, CLAUDE.md, llms.txt, editor/attributes/ignore config, CI workflow,
  Dependabot, and PR/issue templates.

[Unreleased]: https://github.com/opalclient/opal-script-skills/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/opalclient/opal-script-skills/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/opalclient/opal-script-skills/releases/tag/v0.1.0
