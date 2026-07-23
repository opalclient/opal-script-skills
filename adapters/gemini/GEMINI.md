<!-- opal-scripting:start -->
# Opal scripting

Opal is a Minecraft utility client with a GraalVM-JS scripting system. A script
is a single `.js` file in the client's `opal/scripts` folder. Scripts run
**sandboxed**: a default-deny host-access policy, no `Java.type`, no filesystem
(see [Security](#security--the-sandbox-model)).

The one sandbox rule that bites silently: **`mc.player` and `mc.world` do not
exist.** There is no bean-property mapping, so they read as `undefined`, and
`if (mc.player === null) return;` is a guard that never fires. Call the getters:
`if (mc.getPlayer() === null || mc.getWorld() === null) return;`. Nothing throws;
the handler runs on with no player and does nothing.

Collections behave the way you expect. A listing method returns a `ScriptList`,
which reads as a read-only JS array: `.length`, `list[i]`, `for..of`, and spread
all work. It is not a full `Array` (`.map`/`.filter` are absent), and you can't
write to it. Walk it with `for..of`.

This skill is the source of truth. Companion files go deeper:

- `reference.md` — the module/settings/event model index, plus the `keys` table.
- `reference/core.md` — `client`, `notification`, `overlay`, `modules`, `mc`,
  `timer`, and `ScriptList`.
- `reference/character.md` — `player`, `movement`, `rotation`, `inventory`, and
  `mc.interactionManager`.
- `reference/world.md` — `world`, `esp`, the class globals (`BlockPos`, `Vec2f`,
  `Vec3d`, `Color`, `MAIN_HAND`/`OFF_HAND`), and the wrapper types the proxies
  return (`ScriptVec3`, `ScriptEntity`, `ScriptBox2D`, …).
- `reference/ui.md` — `renderer` and `palette`.
- `palette-views.md` — a complete worked example of a custom palette view.

Reference scripts ship inside the client at `opal/scripts` (`ScriptScaffold.js`,
`Chomp.js`) — read them for *idiom* (structure, naming, how a module is laid
out), not for API truth. Some of them predate the current API and still call
members that no longer exist. Where a shipped script and this skill disagree,
**this skill is right**; copy its examples, not theirs.

## Anatomy of a script

Every script starts by registering itself, then registers one or more modules.
A module owns its settings, its lifecycle, and its event handlers.

```js
const script = registerScript({
    name: "MyScript",
    version: "1.0.0",
    authors: ["you"],
});

script.registerModule({
    name: "MyModule",
    description: "What this module does",
}, (module) => {
    // 1. Settings — declared once, up front.
    module.addBool("Swing", true);
    module.addNumber("Delay", 2, 0, 20, 1); // name, default, min, max, step
    module.addMode("Mode", ["Silent", "Normal"]);

    // 2. State — plain JS, closed over by the handlers.
    let placed = 0;

    // 3. Lifecycle + events.
    module.on("enable", () => notification.success("MyModule", "on"));
    module.on("disable", () => notification.info("MyModule", placed + " placed"));

    module.on("preGameTick", () => {
        if (mc.getPlayer() === null || mc.getWorld() === null) return; // always guard
        // ... per-tick logic ...
        placed++;
    });
});
```

A script does not have to register a module at all — it can register only a
palette view or an overlay island (see below). But the module is the normal
unit of user-toggleable behavior.

## Manifest header

A script may open with an optional `// ==OpalScript==` comment block. Add it: it
documents the script and is what future update-checks and the gallery will read.

```js
// ==OpalScript==
// @name       My Script
// @version    1.2.0
// @author     trq
// @minClient  26.2
// @capability render, chat
// ==/OpalScript==
```

The client parses and logs it, nothing more this release — it does not gate
loading, enforce `@minClient`, or expose the fields to the script. Treat it as
metadata for humans and tools, not a runtime check you can rely on. It must be
the first non-blank content in the file; a malformed line is skipped rather than
failing the load.

## Settings model

Declare settings inside the module callback. Read them every time you need the
current value — never cache them at registration time.

| Declare | Read | Write |
| --- | --- | --- |
| `module.addBool(name, def)` | `module.getBool(name)` | `module.setBool(name, v)` |
| `module.addNumber(name, def, min, max, step)` | `module.getNumber(name)` | `module.setNumber(name, v)` |
| `module.addMode(name, [opts])` | `module.getMode(name)` / `module.isModeEqual(name, opt)` | — |
| `module.addGroup(name, [settingNames])` | (nests already-added settings under a header) | — |

`addGroup` takes the group name and an **array of names of settings you already
added** — it moves those into a collapsible group, so declare them first:

```js
module.addBool("Tower", true);
module.addNumber("Speed", 1, 0, 5, 0.1);
module.addGroup("Movement", ["Tower", "Speed"]); // group existing settings
```

## Binds

A module can bind itself to a key with `module.setBind(code)`, read it with
`module.getBind()` (`keys.NONE`, `-2`, when unbound), and clear it with
`module.clearBind()`. Codes come from the `keys` global; codes below `10` are
mouse buttons.

```js
module.setBind(keys.R);      // a DEFAULT bind — see below
```

A `setBind` in the module callback runs at script load, so it is only a
**default**: a bind the user has saved, or sets in-session, is applied
afterwards and wins. Never call `setBind` from a tick handler — it would fight
the user every tick.

## Events

Subscribe with `module.on("eventName", callback)`. Some events hand you an
`event` object; cancellable ones expose `event.cancel()` / `event.isCancelled()`.

- **Lifecycle:** `enable`, `disable` (the only handlers that receive no argument).
- **Ticks:** `preGameTick`, `postGameTick`.
- **Render:** `renderScreen` (2D HUD pass), `renderWorld` (3D world pass — use
  `esp.*` here for projection), `renderBloom` (feeds the bloom/glow effect,
  doesn't draw directly). Draw here, not in tick handlers.
- **World / net:** `joinWorld`, `serverConnect` *(cancellable)*, `serverDisconnect`,
  `blockUpdate`, `sendPacket`, `receivePacket`, `instantaneousSendPacket`,
  `instantaneousReceivePacket`, `preMovementPacket`, `postMovementPacket`.
- **Movement:** `preMove`, `postMove`, `jump` *(cancellable)*.
- **Input:** `keyPress`, `mousePress` (`event.getCode()` → GLFW code).
- **Player actions:** `attack` (`event.getTarget()` → `ScriptEntity`), `swing`
  (`event.isMainHand()`), `itemUse`.
- **Chat:** `chatReceived` *(cancellable — `event.cancel()` suppresses the line;
  `event.getMessage()` is the plain-text line)*.
- **Misc:** `resolutionChange`.

Guard `preGameTick` / `postGameTick` with
`if (mc.getPlayer() === null || mc.getWorld() === null) return;` because they
fire while not in a world.

**Render events hand you a payload.** `renderScreen` gets an `event` with
`getPartialTicks()`, `getMouseX()`, and `getMouseY()` (the GUI-scaled cursor);
`renderWorld` and `renderBloom` get `getPartialTicks()` only. `client.getTickDelta()`
returns the same partial tick, so a handler that ignores the argument still
works. Draw with the `renderer` global. `preGameTick`, `postGameTick`,
`joinWorld`, `itemUse`, `serverDisconnect`, and `resolutionChange` carry no
readable data — declare those with no parameter.

There is one handler slot per event name per module; calling `module.on` again
for the same event replaces the previous handler. See `reference.md` for the
full payload table.

## Globals

Scripts get these proxy globals (no import needed): `client`, `player`, `world`,
`inventory`, `movement`, `rotation`, `renderer`, `overlay`, `esp`, `modules`,
`notification`, `mc`, `palette`, `timer`, `keys`. See `reference/core.md`,
`reference/character.md`, `reference/world.md`, and `reference/ui.md` for full
member tables.

`modules.isEnabled(name)` / `modules.setEnabled(name, bool)` lets a script
cooperate with the client's built-in modules (e.g. disable native Scaffold while
yours runs, then restore it on disable). `modules` also has `exists`, `toggle`,
`getCategory`, `getSuffix`, `isVisible`, `setVisible`, `listAll`,
`listCategory`, `listEnabled` — see `reference/core.md`.

Class globals are bound too, no import needed — and there are only four, all
host-curated: `BlockPos`, `Vec2f`, `Vec3d` (script-safe wrappers with readable
method names — construct with `new BlockPos(x, y, z)` / `new Vec2f(yaw, pitch)` /
`new Vec3d(x, y, z)`) and `Color`, plus the `MAIN_HAND` / `OFF_HAND` hand
constants. `Color` (`java.awt.Color`) is allow-listed for its constructors and
`getRGB()`, so `new Color(r, g, b, a).getRGB()` works.

Two globals that older docs promise are **gone**:

- **`Vec3i` no longer exists.** It was integer-valued; `BlockPos` is the
  integer-valued point type.
- **`MathHelper` no longer exists.** It used to bind the raw `Mth` class with
  nothing allow-listed (every call was denied even while it was present), and
  has now been removed outright. Use JavaScript's built-in `Math`
  (abs/floor/ceil/round/min/max/pow/sqrt/trig/hypot/random all covered);
  Opal-specific helpers live on the proxies (e.g. `esp.lerp`).

There is no `Java.type` and no way to import a class a script wasn't given —
that is deliberate. See `reference/world.md` for the full picture.

`mc.interactionManager` wraps block/entity interaction: `interactBlock`,
`updateBlockBreakingProgress`, `cancelBlockBreaking`, `isBreakingBlock`,
`attackEntity`, `interactItem`, `stopUsingItem`. See `reference/character.md`.

## Entities, effects, and timers

Every entity a script sees is a `ScriptEntity`: `getName()` (a plain `String` —
there is no `.getString()` on it), `getHealth()`, `getMaxHealth()`, `getArmor()`,
`getDistance()`, `getX/getY/getZ()`, `isPlayer()`, `hasEffect(name)`, and more.
Reads that don't apply to the entity return **`-1`** rather than throwing — e.g.
`getHealth()` on a non-living entity. Test for that sentinel.

Status effects are readable on the local player and on any `ScriptEntity`:
`hasEffect(name)`, `getEffect(name)` → `ScriptEffect | null`, `getEffects()` →
`ScriptList<ScriptEffect>`. Names take either form: `"speed"` or
`"minecraft:speed"`.

```js
const effect = player.getEffect("speed");
if (effect !== null) {
    effect.getAmplifier();       // 0-based, vanilla:  Speed II -> 1
    effect.getLevel();           // 1-based, display:  Speed II -> 2
    effect.getDurationSeconds(); // -1 when isInfinite()
}
```

Mind the two amplifier conventions — `getAmplifier()` is what vanilla stores,
`getLevel()` is what the HUD shows, and they differ by one.

`timer.create()` returns a stopwatch (`reset()`, `elapsed()`, `passed(ms)`,
`passedAndReset(ms)`) — the idiomatic way to rate-limit an action across ticks.
`timer.now()` is the current clock in milliseconds.

## The renderer canvas

`renderer` draws immediate-mode primitives. **Only draw inside a render context:**
`renderScreen` / `renderBloom`, a palette view's `render`, or an island's
`render`. Drawing from a tick handler does nothing useful.

Common primitives: `rect`, `roundedRect`, `roundedRectVarying`, `circle`,
`rectGradient`, `rectOutline`, `roundedRectOutline`, `rainbowRect`, `shadow`,
`blurFill`, `glowFill`. Text: `text(font, str, x, y, size, color) -> width`,
`textShadow`, `textGradient`, `textWidth`, `textHeight`, `wrapText`, `trimText`.
Images: `loadImage` / `destroyImage` / `image` / `imageTinted`. Vector paths:
`beginPath` / `moveTo` / `lineTo` / `quadTo` / `cubicTo` / `closePath` /
`strokeColor` / `strokeWidth` / `stroke`. Transforms / clipping: `scale`,
`rotate`, `scissor` (each is **scoped** — you pass a pivot/clip rect plus a
content function it runs the draws inside; `rotate` takes **degrees**) and
`globalAlpha(alpha)` (a 0.0–1.0 multiplier for the rest of the frame). See
`reference/ui.md` for exact signatures.

Fonts: `"productsans-medium"`, `"productsans-bold"`, `"materialicons-regular"`.

### Color rule (important)

**Always build colors with `renderer.color(r, g, b[, a])`.** Never write a raw
`0xAARRGGBB` literal: a JS double above 2^31 truncates incorrectly when narrowed
to a Java int, so the alpha/red channels come out wrong.

```js
const C = {
    bg:   renderer.color(6, 6, 16),
    text: renderer.color(244, 244, 250),
    accent: renderer.color(255, 222, 51),
};
renderer.roundedRect(x, y, w, h, 10, C.bg);
renderer.text("productsans-bold", "Score", x + 12, y + 8, 8, C.text);
```

Color helpers all return packed ints: `renderer.color(r,g,b[,a])`,
`withAlpha(color, a)` (alpha is **0–255**), `applyOpacity(color, factor)`
(factor is **0.0–1.0**), `interpolate(a, b, t)`, `darker(color, f)`,
`brighter(color, f)`. To dim a color by a fraction use `applyOpacity` — passing
a fractional `0.45` to `withAlpha` floors to alpha `0` (fully transparent).

## Palette views (flagship)

`palette` registers custom **command-palette views** — mini-apps and games that
take over the palette's content rect. The `render(x, y, w, h, dt)` callback draws
via the `renderer` global into an auto-clipped rect; `dt` is wall-clock seconds
since the last frame. Esc always closes the view.

```js
const view = palette.createView({
    id: "hello",
    title: "Hello",
    description: "A tiny palette view",
    placeholder: "Press Space",
    footer: [{ key: "Space", label: "Ping" }],
    render: function (x, y, w, h, dt) {
        renderer.roundedRect(x, y, w, h, 10, renderer.color(12, 12, 26));
        renderer.text("productsans-bold", "Hello, Opal", x + 16, y + 16, 10,
            renderer.color(244, 244, 250));
    },
    keyPressed: function (keyCode, mods) {
        if (keyCode === keys.SPACE) notification.info("Hello", "ping");
        return true; // consumed
    },
    charTyped: function (ch) { return false; },
    mouseClicked: function (mx, my, button) { return false; },
});
palette.openView(view);   // or palette.openView("hello")
// palette.removeView(view) to unregister.
```

`keys` exposes GLFW constants for handlers and for `module.setBind`:
`keys.UP/DOWN/LEFT/RIGHT`, `keys.A..Z`,
`keys.SPACE/ENTER/ESCAPE/TAB/BACKSPACE/LEFT_SHIFT/LEFT_CONTROL`,
`keys.NUM_0..NUM_9`, `keys.F1..F12`, `keys.MOUSE_0..MOUSE_4`, and `keys.NONE`
(`-2`, unbound). See `reference/ui.md` and `palette-views.md` for a complete
example.

## Dynamic islands

`overlay` shows a **Dynamic Island** — a small floating HUD pill. The `render`
callback gets `(x, y, w, h, progress)` where `progress` is the show/hide
animation (0..1).

```js
const id = overlay.createIsland({
    width: 150, height: 28, priority: 25,
    render: function (x, y, w, h, progress) {
        renderer.shadow(x, y, w, h, 14, 18, 0, 4, renderer.applyOpacity(renderer.color(0, 0, 0), 0.45));
        renderer.blurFill(x, y, w, h, 14);
        renderer.text("productsans-bold", "Active", x + 12, y + 10, 8, renderer.color(255, 255, 255));
    },
});
overlay.showIsland(id);
// hideIsland(id) / destroyIsland(id) / setIslandWidth(id, w) / setIslandHeight(id, h) / setIslandPriority(id, p)
```

Always `destroyIsland` (and `destroyImage` any loaded images) in the module's
`disable` handler to avoid leaks.

## Notifications

`notification.success/error/warn/info(title, desc[, ms])` and
`notification.show(type, title, desc[, ms])`.

## Debugging

Print-debugging works. `client.print(x)` calls `toString()`, and every wrapper
now prints a readable form instead of `JavaObject[...]` — a `ScriptVec3` shows
`ScriptVec3(12.5, 64.0, -3.2)`, an entity `ScriptEntity(Zombie #123 hp=20.0/20.0)`,
an effect `ScriptEffect(minecraft:speed x2, 12s)`. `String(x)` and `console.log(x)`
render the same forms.

Errors are located and loud. When a handler throws, the client reports
`MyScript.js:42: <message>` — the file and line the throw came from. A load-time
error (before you join a world) is buffered and surfaces on join.
`registerScript` called without a required field names the field. Per event, the
client prints the first error then suppresses repeats until the module is
re-enabled (see the note under the event table in `reference.md`).

## Security — the sandbox model

Scripts run **sandboxed by design**. The GraalJS context is built with:

- **`HostAccess.EXPLICIT` — default-deny.** Only members annotated
  `@HostAccess.Export` on Opal's own proxy/wrapper classes are reachable, plus a
  tiny allow-list (`Color`'s constructors and `getRGB()`). No member access on
  un-annotated types, no bean-property mapping, no container access.
- **No host class lookup.** `Java.type(...)` is denied outright — a script
  cannot reach a class it wasn't handed as a global.
- **No filesystem** (`IOAccess.NONE`), no process creation, no thread creation,
  no native access.

**A script cannot freeze the game.** Each handler runs under a ~250ms wall-clock
budget; a `while (true)` or any runaway loop is interrupted and reported, and the
script stays loaded (only that one dispatch dies). A 500-million-statement
ceiling backstops the budget. A normal handler finishes in well under a
millisecond, so you never approach either limit. The one place a script hands the
engine unbounded work is a `client.criteria` pattern against untrusted chat, and
that path is bounded separately (input over 1024 chars never matches; a pattern
with more than 16 placeholders is rejected at compile).

**Java imports are off by design, not by omission.** That is exactly what makes
a public script gallery safe to offer: a script's whole reachable surface is the
documented API, so it can be read and reasoned about. Do not treat it as a
limitation to work around — there is no supported way around it, and looking for
one is a sign the script is doing something it shouldn't.

The sandbox bounds what a script can *reach*, not whether it plays fair inside
the game. So the client still gates untrusted code:

- Community / public scripts are **quarantined to `opal/scripts/pending`** and
  require an explicit **"Trust & run"** before they execute.
- Never instruct a user to bypass the trust prompt. Read a script before
  trusting it.
- Authors: keep scripts self-contained and to their stated purpose.

## Common mistakes

The `mc.player` mistake **fails silently** — no error, no chat message, the
script just does nothing. It is the most common bug in Opal scripts:

- **Reading `mc.player` / `mc.world`.** They do not exist; they read as
  `undefined`. `if (mc.player === null) return;` is a guard that never fires
  (`undefined === null` is `false`), so the handler runs on with no player and
  every following call fails. Always
  `if (mc.getPlayer() === null || mc.getWorld() === null) return;`.
- **Calling `.map` / `.filter` / `.forEach` on a `ScriptList`.** It reads as an
  array (`.length`, `list[i]`, `for..of`, spread all work), but it carries no
  `Array.prototype`, so those methods are `undefined`. Walk it with `for..of`,
  or `Array.from(list)` first when you need a real array. It is read-only:
  assigning `list[i]` or calling `.push` never mutates it (and throws in a
  module/strict script). Both index paths are bounds-safe: `list.get(i)` past
  the end returns `null`, and `list[i]` past the end reads as `undefined`.
- **Raw color literals.** Using `0xAARRGGBB` instead of `renderer.color(...)` —
  truncates and renders the wrong color. Always use the helper.
- **Drawing outside a render context.** `renderer` calls in `preGameTick` do
  nothing; draw in `renderScreen` / a palette `render` / an island `render`.
- **Guessing render-payload accessor names.** `renderScreen` exposes
  `getPartialTicks()` / `getMouseX()` / `getMouseY()` — not `tickDelta()` /
  `mouseX()`; `renderWorld` / `renderBloom` expose `getPartialTicks()` only.
  `client.getTickDelta()` is the same value if you skip the argument.
- **Caching settings.** Reading `getBool/getNumber/getMode` once at registration
  instead of per-use, so live setting changes never take effect.
- **Leaking resources.** Not calling `destroyIsland` / `destroyImage` on
  `disable`; islands and image handles persist.
- **Using `dt` from the wrong place.** `dt` is provided to palette `render`; in a
  `renderScreen` overlay you compute it yourself (e.g. from `Date.now()`), and
  clamp it so a backgrounded frame doesn't make a giant jump.
- **Inventing API.** Only the members documented in `reference.md` and
  `reference/*.md` exist. Do not guess method names — check the reference or a
  shipped example.
- **Not consuming palette input.** `keyPressed` should `return true` when it
  handled the key, `false` to let the palette handle it (Esc always closes).
<!-- opal-scripting:end -->
