# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **The sandbox model, which was documented backwards.** `SKILL.md`, `README.md`,
  `llms.txt` and `SECURITY.md` described scripts as running "full-trust … with no
  sandbox". That was never true: script contexts have always been built with
  `HostAccess.EXPLICIT` (default-deny), `allowHostClassLookup(name -> false)` (no
  `Java.type`), and `IOAccess.NONE` (no filesystem). All four now describe the
  real model, with Java-imports-off framed as the deliberate design that makes a
  public script gallery safe to offer.
- **`mc.player` / `mc.world`, and the guard idiom built on them.** Neither
  exists — the sandbox does no getter-to-property bean mapping, so both read as
  `undefined` and `if (mc.player === null) return;` never fired. Every
  occurrence, prose and example, is now `mc.getPlayer()` / `mc.getWorld()`.
  (`mc.interactionManager` is unaffected: it is an exported *field*, so the
  property form is correct there.)
- **Collections documented as arrays.** Every collection-returning method
  returns a `ScriptList` (`size()` / `isEmpty()` / `get(i)`), which has no
  `.length`, no `[i]`, and no `for..of`. The old "listing methods return
  JS-iterable string arrays" claim and its `for (let i = 0; i < combat.length; i++)`
  example produced silently no-op loops.
- **Geometry and value types.** `box.x` / `p.z` property access reads
  `undefined`; the real types are `ScriptVec3`, `ScriptVec2f` (`getYaw()` /
  `getPitch()`), `ScriptBox2D`, `ScriptBox3D`, `ScriptItemStack`, `ScriptImage`,
  `ScriptEntity`, all read through getters. The "intermediary-named at runtime"
  explanation was wrong twice over: the client is on Mojang mappings, and the
  cause was the host-access policy.
- **`entity.getName().getString()`** — `getName()` returns a plain `String`.
- **Event payloads**, which disagreed with the client throughout: cancellation
  is `cancel()` (not `setCancelled()`); `chatReceived` exposes `getMessage()`
  (not `getText()`); `blockUpdate` exposes `getX/getY/getZ/getOldBlock/getNewBlock`
  (not `getPos/getOldState/getNewState`); `serverConnect` exposes
  `getHost/getPort/getAddress`; `preMove`/`postMove` expose `getInputX/Y/Z`;
  packet events expose `getType()` (not `getPacket()`); `keyPress`/`mousePress`
  expose `getCode()` (not `getInteractionCode()`); `swing` exposes
  `isMainHand()`. `renderScreen`/`renderWorld`/`renderBloom` carry **no readable
  members** — the "read their fields with bare record accessors" advice threw on
  every call; handlers take no argument and use `client.getTickDelta()`.
- **Removed APIs** deleted from the docs: `client.getModule()`,
  `world.getBlockState()`, `world.getBlock()`, the `Vec3i` global, and
  `movement.getMoveYaw(Vector2d, Vector2d)` (use the four-number
  `getMoveYaw(fromX, fromZ, toX, toZ)` — world X and Z).
- **`MathHelper`** is documented as a dead global: it is raw `Mth` with nothing
  allow-listed, so every call on it is denied. Use JS's native `Math`. (`Color`
  really does work — its constructors and `getRGB()` are allow-listed.)
- `adapters/claude-code/commands/new-opal-script.md` no longer seeds the broken
  `if (mc.player === null || mc.world === null) return; // always guard` line
  into every scaffolded script.

### Added

- Documentation for the newer API surface: status effects (`player.hasEffect` /
  `getEffect` / `getEffects` and `ScriptEffect`, including the 0-based
  `getAmplifier()` vs 1-based `getLevel()` convention and the `-1`
  infinite-duration sentinel), script keybinds (`module.setBind` / `getBind` /
  `clearBind` plus the `keys.F1`–`F12` / `MOUSE_0`–`MOUSE_4` / `NONE`
  constants), `ScriptEntity` entity reads, `AttackEvent.getTarget()`, the
  `timer` global, `client.sendChat` / `runCommand`, and the `-1` not-applicable
  sentinel convention.
- `world.getBlockId(pos)` → registry id (e.g. `"minecraft:stone"`), non-null —
  an unloaded position resolves to `"minecraft:air"`, mirroring
  `getBlockName()`'s sentinel, not a null result. A locale-safe alternative to
  `getBlockName()` for matching, since the latter returns a localized display
  name that breaks substring matching on non-English clients.
- A pointer to the official public scripts repo,
  [`opalclient/scripts`](https://github.com/opalclient/scripts)
  (folder-per-script, `manifest.json`, TS template bundled via esbuild, PR flow
  with CI gates, `<id>@<version>` releases), in `README.md` and `SKILL.md` —
  its flagship example is **Chomp**, a roguelite arcade script using `storage`.

### Removed

- **`MathHelper`**, previously documented as a dead-but-present global (bound
  to the raw `Mth` class with nothing allow-listed, so every call was denied),
  has now been removed from the client outright. Use JavaScript's native
  `Math` instead.

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
  <br>**Superseded — several claims here were wrong.** `Vec3i` does not exist,
  `MathHelper` is a dead global, `Direction`/`RaytracedRotation` are returned
  wrapper types rather than globals, and the "intermediary-named" explanation
  was incorrect. See the `Unreleased` entry above for the corrections.
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
