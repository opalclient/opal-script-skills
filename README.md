# opal-script-skills

Portable AI-assistant **skills** for writing [Opal](https://opal.wtf) (Minecraft
utility client) JavaScript scripts, plus a cross-AI installer that drops the
skill into whatever assistant your project uses.

Opal ships a GraalVM-JS scripting system: scripts are `.js` files in the
client's `opal/scripts` folder. This repo teaches an AI assistant the real
scripting API (`registerScript` / modules / settings / events, the `renderer`
canvas, the `palette` command-palette views, dynamic islands, and the
default-deny sandbox model) so it stops inventing methods and writes scripts
that run.

The single **source of truth** is [`skills/opal-scripting/`](skills/opal-scripting/):

- [`SKILL.md`](skills/opal-scripting/SKILL.md): the skill (structure, settings,
  events, renderer + color rule, palette views, islands, the sandbox, common
  mistakes).
- [`reference.md`](skills/opal-scripting/reference.md): the module/settings/event
  model index, plus the `keys` table. Proxy globals are split by category:
  - [`reference/core.md`](skills/opal-scripting/reference/core.md): `client`,
    `notification`, `overlay`, `modules`, `mc`, `timer`, `ScriptList`.
  - [`reference/character.md`](skills/opal-scripting/reference/character.md):
    `player`, `movement`, `rotation`, `inventory`, `mc.interactionManager`.
  - [`reference/world.md`](skills/opal-scripting/reference/world.md): `world`,
    `esp`, the class globals (`BlockPos`, `Vec2f`, `Vec3d`, `Color`, hand
    constants), and the wrapper types the proxies return (`ScriptVec3`,
    `ScriptEntity`, `ScriptEffect`, `ScriptBox2D`, …).
  - [`reference/ui.md`](skills/opal-scripting/reference/ui.md): `renderer`,
    `palette`.
- [`palette-views.md`](skills/opal-scripting/palette-views.md): a complete
  palette-view example.

## Install

One command per assistant. Run it from your project root. No dependencies, no
network; it just renders the skill into the right place.

```bash
# Auto-detect which assistants this project uses and install for them:
npx @opalclient/opal-script-skills add

# Or target one explicitly:
npx @opalclient/opal-script-skills add --target claude-code
npx @opalclient/opal-script-skills add --target codex      # AGENTS.md
npx @opalclient/opal-script-skills add --target gemini      # GEMINI.md
npx @opalclient/opal-script-skills add --target copilot     # .github/copilot-instructions.md
npx @opalclient/opal-script-skills add --target cursor      # .cursor/rules/opal-scripting.md
npx @opalclient/opal-script-skills add --target windsurf    # .windsurfrules
npx @opalclient/opal-script-skills add --target generic     # OPAL_SCRIPTING.md

# Everything at once:
npx @opalclient/opal-script-skills add --all

# List supported targets:
npx @opalclient/opal-script-skills list
```

The `npx` short name `opal-skills` works too. Use `--dir <path>`
to install into a directory other than the current one.

### What each target writes

| Target | Path | Form |
| --- | --- | --- |
| `claude-code` | `.claude/skills/opal-scripting/` | full skill files |
| `cursor` | `.cursor/rules/opal-scripting.md` | full skill (one file) |
| `generic` | `OPAL_SCRIPTING.md` | full skill (one file) |
| `codex` | `AGENTS.md` | delimited block |
| `gemini` | `GEMINI.md` | delimited block |
| `copilot` | `.github/copilot-instructions.md` | delimited block |
| `windsurf` | `.windsurfrules` | delimited block |

Block targets insert a `<!-- opal-scripting:start -->…<!-- opal-scripting:end -->`
region and leave the rest of your file untouched. Re-running is idempotent: the
block is replaced, never duplicated.

When you pass neither `--target` nor `--all`, the installer detects markers in
the directory (`.claude/`, `AGENTS.md`, `GEMINI.md`, `.github/`, `.cursor/`,
`.windsurfrules`) and installs the matching targets. If it finds none, it installs
`generic`.

## Manual adapters

Don't want to run the installer? Copy a ready-made surface from
[`adapters/`](adapters/):

- [`adapters/claude-code/`](adapters/claude-code/): Claude Code **plugin** form
  (`.claude-plugin/plugin.json` + `skills/opal-scripting/` + a
  `/new-opal-script` command that scaffolds a new script file).
- [`adapters/codex/AGENTS.md`](adapters/codex/AGENTS.md)
- [`adapters/gemini/GEMINI.md`](adapters/gemini/GEMINI.md)
- [`adapters/copilot/.github/copilot-instructions.md`](adapters/copilot/.github/copilot-instructions.md)

## In-client docs

The authoritative reference is the client itself. Reference scripts ship in the
Opal install under `opal/scripts` (`ScriptScaffold.js`, `Chomp.js`); read them
for idiomatic usage. Scripts run in a default-deny sandbox, and community
scripts are additionally quarantined to `opal/scripts/pending` behind an
explicit **"Trust & run"**; see [`SECURITY.md`](SECURITY.md).

## For AI agents

If you are an AI assistant working in this repo:

- [`CLAUDE.md`](CLAUDE.md): the mental model for this repo and how to change it.
- [`llms.txt`](llms.txt): a compact, link-first map of everything here.
- [`skills/opal-scripting/`](skills/opal-scripting/): the source of truth for
  the Opal scripting API. **Use only the API documented there**; do not invent
  methods.

## Development

```bash
npm test        # node --test
```

The installer is dependency-free ESM (`bin/install.mjs`). Edits to the skill
live in `skills/opal-scripting/`; the `adapters/` surfaces are regenerated from
it (see [`CONTRIBUTING.md`](CONTRIBUTING.md)).

## License

[MIT](LICENSE) © Opal.
