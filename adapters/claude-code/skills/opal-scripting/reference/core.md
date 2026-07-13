# Core proxies — client, notification, overlay, modules, mc

General client interaction, notifications, HUD islands, module control, and
the null-safe Minecraft facade. See [`../reference.md`](../reference.md) for
the module/settings/event model and back to
[`../SKILL.md`](../SKILL.md) for the overview.

## Client

**Global binding:** `client`

High-level client functions: chat output, module access, screen/scale info,
theme colors, and system metrics.

### Chat & messaging

- `print(o)` — prints `o` (via `toString()`) to local chat only.
- `success(message)` — green-styled local chat message.
- `error(message)` — red-styled local chat message.

### Module access

- `getModule(id)` → `Module` — looks up a registered module by display name
  (case-insensitive). **Throws if not found.**
- `isModuleEnabled(id)` → `boolean`
- `setModuleEnabled(id, enabled)`

Prefer the dedicated `modules` global (below) for state queries and toggling —
it never throws on a missing name. Use `client.getModule` only when you need
the `Module` object itself.

### Screen & display

- `getScaledWidth()` / `getScaledHeight()` → `int` — window size in scaled
  (GUI-scale-affected) virtual pixels.
- `getScaleFactor()` → `double` — current GUI scale factor (e.g. `1.0`, `2.0`).
- `getFramebufferWidth()` / `getFramebufferHeight()` → `int` — raw physical
  window size in pixels.

### Theme & visuals

- `getThemePrimary()` / `getThemeSecondary()` → `int` (ARGB) — the active
  client theme's primary/secondary color.
- `getAnimatedThemeColor(speed, offset)` → `int` (ARGB) — pulses between
  primary and secondary; `offset` staggers multiple elements into a wave.

### System

- `getTickDelta()` → `float` — partial tick (0.0–1.0), for interpolation.
- `getFPS()` → `int` — current frames per second.

```js
module.on("renderScreen", () => {
    renderer.text("productsans-medium", "FPS: " + client.getFPS(),
        10, 10, 8, client.getThemePrimary());
});
```

---

## Notification

**Global binding:** `notification`

Toast notifications on the HUD.

- `success(title, desc[, ms])` — green.
- `error(title, desc[, ms])` — red.
- `warn(title, desc[, ms])` — yellow.
- `info(title, desc[, ms])` — blue.
- `show(type, title, desc[, ms])` — `type` is one of `"SUCCESS"`, `"ERROR"`,
  `"WARN"`, `"INFO"`.

`ms` is optional (default ~3000).

---

## Overlay (Dynamic Island)

**Global binding:** `overlay`

Registers and manages custom **Dynamic Island** HUD elements.

- `createIsland({ width, height, priority, render })` → `String` id.
  `render(x, y, w, h, progress)` is called every frame the island is shown;
  `progress` is the show/hide animation, `0..1`.
- `showIsland(id)` — activates the island (adds it to the render loop).
- `hideIsland(id)` — deactivates without destroying.
- `destroyIsland(id)` — permanently deletes it.
- `setIslandWidth(id, width)` / `setIslandHeight(id, height)` — resize live.
- `setIslandPriority(id, priority)` — higher renders on top.

```js
const id = overlay.createIsland({
    width: 160, height: 28, priority: 10,
    render: (x, y, w, h, progress) => {
        renderer.roundedRect(x, y, w, h, 4, renderer.color(20, 20, 26));
        renderer.text("productsans-bold", "Custom HUD", x + 10, y + 14, 8,
            renderer.color(255, 255, 255));
    },
});
overlay.showIsland(id);
// Always destroyIsland(id) in the module's "disable" handler.
```

---

## Modules

**Global binding:** `modules`

Dedicated access to the client's module system: querying state, toggling
native modules, reading metadata, and listing modules by category. All lookups
are **case-insensitive**, and names are matched after spaces normalize to
underscores (`"Kill Aura"` and `"killaura"` resolve the same target). Every
method returns a safe default if the module doesn't exist — `false` for
booleans, `null` for strings, an empty array for listings. Lookups never
throw.

### State

- `exists(id)` → `boolean` — whether a module with this name is registered.
- `isEnabled(id)` → `boolean`
- `setEnabled(id, enabled)` — no-ops silently if `id` doesn't exist.
- `toggle(id)` — flips the module on/off; no-ops silently if `id` doesn't exist.

### Metadata

- `getCategory(id)` → `String | null` — e.g. `"Combat"`, `"Movement"`.
- `getSuffix(id)` → `String | null` — arraylist suffix, often the current mode.
- `isVisible(id)` → `boolean` — arraylist/HUD visibility.
- `setVisible(id, visible)` — no-ops silently if `id` doesn't exist.

### Listing

Listing methods return JS-iterable string arrays (`.length` + indexing).

- `listAll()` → `String[]` — every registered module (native + script).
- `listCategory(category)` → `String[]` — `"Combat"`, `"Movement"`, `"Visual"`,
  `"World"`, `"Utility"`, or `"Scripts"`. Case-insensitive; empty array if
  invalid.
- `listEnabled()` → `String[]` — every currently enabled module.

```js
script.registerModule({
    name: "AutoDisableFlight",
    description: "Turns off Flight whenever KillAura starts",
}, (module) => {
    module.on("preGameTick", () => {
        if (modules.isEnabled("KillAura") && modules.isEnabled("Flight")) {
            modules.setEnabled("Flight", false);
            client.print("Disabled Flight while KillAura is active");
        }

        const combat = modules.listCategory("Combat");
        for (let i = 0; i < combat.length; i++) {
            client.print(combat[i] + " -> " + modules.isEnabled(combat[i]));
        }
    });
});
```

---

## mc — Minecraft facade

**Global binding:** `mc`

A thin, null-safe facade over the Minecraft client — it exists so scripts can
reach the client without touching intermediary-named fields (GraalVM JS would
otherwise see something like `field_1724` instead of `player` under Fabric
intermediary mappings).

- `mc.player` — `LocalPlayer | null`. **Null-check only** — use the `player`
  global for state and movement methods.
- `mc.world` — `ClientLevel | null`. **Null-check only** — use the `world`
  global for block/entity queries.
- `mc.interactionManager` — `InteractionManagerProxy`. See
  [`character.md`](character.md#interaction-manager) for its 7 methods.

`getPlayer()` / `getWorld()` / `getInteractionManager()` accessor methods also
exist (kept for completeness); prefer the public fields above.

Do not call methods directly on `mc.player` / `mc.world` by readable name —
Fabric's intermediary mappings rename them at runtime and the call fails. Use
the `player` / `world` / `inventory` / `movement` / `rotation` proxy globals
instead.

```js
module.on("preGameTick", () => {
    // The idiomatic guard, at the top of every event callback:
    if (mc.player === null || mc.world === null) return;

    client.print("Health: " + player.getHealth());
});
```
