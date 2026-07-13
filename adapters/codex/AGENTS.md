<!-- opal-scripting:start -->
# Opal scripting

Opal is a Minecraft utility client with a GraalVM-JS scripting system. A script
is a single `.js` file in the client's `opal/scripts` folder. Scripts run
**full-trust**: they have complete filesystem and client access. Treat every
script as trusted native code (see [Security](#security--the-trust-model)).

This skill is the source of truth. Companion files go deeper:

- `reference.md` — the module/settings/event model index, plus the `keys` table.
- `reference/core.md` — `client`, `notification`, `overlay`, `modules`, `mc`.
- `reference/character.md` — `player`, `movement`, `rotation`, `inventory`, and
  `mc.interactionManager`.
- `reference/world.md` — `world`, `esp`, and the bound types (`BlockPos`,
  `Vec2f`, `Vec3d`, `Vec3i`, `Direction`, `RaytracedRotation`, `MathHelper`,
  `Color`, `MAIN_HAND`/`OFF_HAND`).
- `reference/ui.md` — `renderer` and `palette`.
- `palette-views.md` — a complete worked example of a custom palette view.

Reference scripts ship inside the client at `opal/scripts` (`ScriptScaffold.js`,
`Pacman.js`); read them for idiomatic usage.

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
        if (mc.player === null || mc.world === null) return; // always guard
        // ... per-tick logic ...
        placed++;
    });
});
```

A script does not have to register a module at all — it can register only a
palette view or an overlay island (see below). But the module is the normal
unit of user-toggleable behavior.

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

## Events

Subscribe with `module.on("eventName", callback)`. Some events hand you an
`event` object; cancellable ones expose `event.setCancelled()`.

- **Lifecycle:** `enable`, `disable` (the only handlers that receive no argument).
- **Ticks:** `preGameTick`, `postGameTick`.
- **Render:** `renderScreen` (2D HUD pass), `renderWorld` (3D world pass — use
  `esp.*` here for projection), `renderBloom` (feeds the bloom/glow effect,
  doesn't draw directly). Draw here, not in tick handlers.
- **World / net:** `joinWorld`, `serverConnect` *(cancellable)*, `serverDisconnect`,
  `blockUpdate`, `sendPacket`, `receivePacket`, `instantaneousSendPacket`,
  `instantaneousReceivePacket`, `preMovementPacket`, `postMovementPacket`.
- **Movement:** `preMove`, `postMove`, `jump` *(cancellable)*.
- **Input:** `keyPress`, `mousePress` (`event.getInteractionCode()` → GLFW code).
- **Player actions:** `attack`, `swing`, `itemUse`.
- **Chat:** `chatReceived` *(cancellable — `event.setCancelled()` suppresses the line)*.
- **Misc:** `resolutionChange`.

Guard `preGameTick` / `postGameTick` with `if (mc.player === null || mc.world === null) return;`
because they fire while not in a world. `renderScreen`, `renderWorld`,
`renderBloom`, and `swing` are Java **records** — read their fields with bare
accessors (`event.tickDelta()`), not `getX()` getters. There is one handler
slot per event name per module; calling `module.on` again for the same event
replaces the previous handler. See `reference.md` for the full payload table.

## Globals

Scripts get these proxy globals (no import needed): `client`, `player`, `world`,
`inventory`, `movement`, `rotation`, `renderer`, `overlay`, `esp`, `modules`,
`notification`, `mc`, `palette`, `keys`. See `reference/core.md`,
`reference/character.md`, `reference/world.md`, and `reference/ui.md` for full
member tables.

`modules.isEnabled(name)` / `modules.setEnabled(name, bool)` lets a script
cooperate with the client's built-in modules (e.g. disable native Scaffold while
yours runs, then restore it on disable). `modules` also has `exists`, `toggle`,
`getCategory`, `getSuffix`, `isVisible`, `setVisible`, `listAll`,
`listCategory`, `listEnabled` — see `reference/core.md`.

Java classes and constants are also bound as globals, no import needed:
`BlockPos`, `Vec2f`, `Direction`, `RaytracedRotation` (script-safe wrappers with
readable method names — construct with `new BlockPos(x, y, z)` /
`new Vec2f(yaw, pitch)`), plus the raw `Vec3d`, `Vec3i`, `MathHelper`, and
`Color` types, and the `MAIN_HAND` / `OFF_HAND` hand constants. `Vec3d`, `Vec3i`,
and `MathHelper` are intermediary-named at runtime — construct and pass them
into proxy methods, but don't call instance methods on them by readable name.
`Color` (`java.awt.Color`) is a normal JDK class and **is** directly callable
(`new Color(r, g, b, a).getRGB()`). See `reference/world.md` for the full
picture.

`mc.interactionManager` wraps block/entity interaction: `interactBlock`,
`updateBlockBreakingProgress`, `cancelBlockBreaking`, `isBreakingBlock`,
`attackEntity`, `interactItem`, `stopUsingItem`. See `reference/character.md`.

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

`keys` exposes GLFW constants for handlers: `keys.UP/DOWN/LEFT/RIGHT`,
`keys.W..Z`, `keys.SPACE/ENTER/ESCAPE/TAB/BACKSPACE/LEFT_SHIFT/LEFT_CONTROL`,
`keys.NUM_0..NUM_9`. See `reference/ui.md` and `palette-views.md` for a
complete example.

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

## Security — the trust model

Scripts run **full-trust by design**: full filesystem and client access, no
sandbox. This is intentional so power users can automate anything.

- Community / public scripts are **quarantined to `opal/scripts/pending`** and
  require an explicit **"Trust & run"** before they execute.
- Never instruct a user to move an untrusted script out of `pending` or to bypass
  the trust prompt. Read a script before trusting it.
- A malicious script can read/write files, exfiltrate data, or run arbitrary
  code. Only run scripts you have audited or that come from a source you trust.
- Authors: keep scripts self-contained; do not touch files outside the client's
  own data unless that is the script's stated purpose.

## Common mistakes

- **Raw color literals.** Using `0xAARRGGBB` instead of `renderer.color(...)` —
  truncates and renders the wrong color. Always use the helper.
- **Drawing outside a render context.** `renderer` calls in `preGameTick` do
  nothing; draw in `renderScreen` / a palette `render` / an island `render`.
- **No world guard.** Forgetting `if (mc.player === null || mc.world === null) return;`
  in tick handlers throws when not in a world.
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
