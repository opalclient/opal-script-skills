---
description: Scaffold a new Opal Minecraft-client script — module registration, a settings example, and event handlers — from a working template.
argument-hint: "<ScriptName> [path]"
allowed-tools: Read, Write, Glob
---

# /new-opal-script

Scaffold a new Opal scripting `.js` file so a user (or you, on their behalf)
starts from a working, idiomatic skeleton instead of a blank file. This
mirrors what a `create-extension`-style CLI does for other dev-tool
ecosystems: remove the blank-page problem for a first script.

Before writing anything, ground yourself in the real API: this plugin ships
the `opal-scripting` skill at `../skills/opal-scripting/` (`SKILL.md`,
`reference.md`, `reference/core.md`, `reference/character.md`,
`reference/world.md`, `reference/ui.md`, `palette-views.md`). **Only use
methods and globals documented there.** Do not invent API surface, even to
make the template look richer.

Two sandbox rules the scaffolded script must respect — both fail **silently**,
so a script that gets them wrong looks fine and does nothing:

- **`mc.player` / `mc.world` do not exist.** They read as `undefined`, which
  makes `if (mc.player === null) return;` a guard that never fires. Always
  `if (mc.getPlayer() === null || mc.getWorld() === null) return;`.
- **Collections are `ScriptList`, not arrays** — `size()` / `isEmpty()` /
  `get(i)`, never `.length` / `[i]` / `for..of`.

## Argument parsing (`$ARGUMENTS`)

- **ScriptName** (first token): a display name for the script, e.g.
  `AutoGreeter` or `"Auto Sprint Helper"`. If omitted, ask for one.
- **path** (second token, optional): where to write the file. If it's a
  directory, write `<path>/<FileName>.js` inside it; if it ends in `.js`, use
  it verbatim. If omitted, write `<FileName>.js` in the current directory.
  (If the project has an `opal/scripts/` folder, prefer writing there instead
  of the bare current directory — check with Glob first.)

Derive:

- `FileName` — ScriptName with spaces/punctuation stripped, PascalCase (e.g.
  `"Auto Sprint Helper"` → `AutoSprintHelper`). This is both the `.js`
  filename and the module name.
- `ModuleDescription` — ask the user for a one-line description if they gave
  one alongside the name; otherwise use a generic placeholder the user is
  expected to edit (`"Describe what this module does"`).

## Steps

1. **Check for a collision.** If the target file already exists, show its
   path and ask before overwriting — never silently clobber a script the user
   may have already started editing.

2. **Write the file** using the template below, substituting `FileName` for
   `MyScript`/`MyModule` and `ModuleDescription` for the description string.
   Keep every line — this template is deliberately a complete, runnable
   starting point that already follows the house rules (settings declared
   before `module.on`, the `renderer.color(...)` rule, the `mc.getPlayer()`
   null-guard on tick handlers, cleanup on `disable`).

   ```javascript
   const script = registerScript({
       name: "FileName",
       version: "1.0.0",
       authors: ["you"],
   });

   script.registerModule({
       name: "FileName",
       description: "ModuleDescription",
   }, (module) => {
       // --- Settings (declare once, before any module.on(...) call) ---
       module.addBool("Enabled Extra", true);
       module.addNumber("Interval", 5, 1, 20, 1); // name, default, min, max, step
       module.addMode("Mode", ["Silent", "Normal"]);
       module.addGroup("Advanced", ["Interval", "Mode"]); // groups settings declared above

       // --- State (plain JS, closed over by the handlers) ---
       let ticks = 0;

       // --- Lifecycle ---
       module.on("enable", () => {
           ticks = 0;
           notification.success("FileName", "Enabled");
       });

       module.on("disable", () => {
           notification.info("FileName", "Disabled after " + ticks + " ticks");
           // If this module owns a Dynamic Island or loaded images, clean them
           // up here: overlay.destroyIsland(id) / renderer.destroyImage(handle).
       });

       // --- Per-tick logic ---
       module.on("preGameTick", () => {
           // Always guard — and always via the getters. There is no mc.player:
           // the property reads undefined, so a === null check never fires.
           if (mc.getPlayer() === null || mc.getWorld() === null) return;

           ticks++;
           if (module.getBool("Enabled Extra") && ticks % module.getNumber("Interval") === 0) {
               // ... do the thing, gated by the Mode setting ...
               if (module.isModeEqual("Mode", "Silent")) {
                   // quiet branch
               }
           }
       });

       // --- HUD drawing (only draws inside a render context) ---
       // No parameter: renderScreen carries no readable payload — its accessors
       // throw. Use client.getTickDelta() if you need the partial tick.
       module.on("renderScreen", () => {
           if (!module.getBool("Enabled Extra")) return;

           const bg = renderer.color(6, 6, 16, 180);      // always renderer.color(), never 0xAARRGGBB
           const fg = renderer.color(244, 244, 250);
           renderer.roundedRect(10, 10, 120, 20, 4, bg);
           renderer.text("productsans-medium", "FileName: " + ticks, 16, 15, 7, fg);
       });
   });
   ```

3. **Report back**: the file path written, and the next step — run
   `.script reload` in-game to load it, then find the module in the ClickGUI
   under its name to toggle it and see the settings.

## Notes for you (the agent)

- If the user asked for something more specific than the generic template
  (e.g. "a palette view" or "a Dynamic Island HUD" instead of a module),
  adapt the body accordingly, but keep it grounded in `palette-views.md` /
  `reference/ui.md` / `reference/core.md` — do not guess at `createView` or
  `createIsland` config shapes.
- Never fabricate methods to fill out the template. If you're unsure whether
  something exists, check the reference files before adding it.
- Keep the settings-before-`module.on` ordering — `addGroup` referencing a
  setting that hasn't been declared yet is silently ignored by the client.
