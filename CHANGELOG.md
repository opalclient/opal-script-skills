# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/opalclient/opal-script-skills/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/opalclient/opal-script-skills/releases/tag/v0.1.0
