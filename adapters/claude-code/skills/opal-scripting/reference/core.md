# Core proxies — client, notification, overlay, modules, mc, timer

General client interaction, notifications, HUD islands, module control, the
null-safe Minecraft facade, and stopwatches. See
[`../reference.md`](../reference.md) for the module/settings/event model and
back to [`../SKILL.md`](../SKILL.md) for the overview.

## Client

**Global binding:** `client`

High-level client functions: chat output, module access, screen/scale info,
theme colors, and system metrics.

### Chat & messaging

- `print(o)` — prints `o` (via `toString()`) to local chat only.
- `success(message)` — green-styled local chat message.
- `error(message)` — red-styled local chat message.
- `sendChat(message)` — sends `message` to the server as a real chat message.
  Unlike `print`, other players see it.
- `runCommand(command)` — runs a command as the player. The leading `/` is
  optional.

### Chat criteria

- `criteria(pattern)` → `ScriptCriteria` — compiles a chat-line template once for
  reuse across chat events. A `${name}` captures a lazy run of characters bound to
  `name`; everything outside `${...}` matches literally (regex metacharacters are
  escaped). `${}` with no name is a discard wildcard. Compile once, outside the
  handler.

A `ScriptCriteria` has three members:

- `match(line)` → captures object | `null` — a read-only object keyed by
  placeholder name (`m.player`), or `null` when the line doesn't match. Read a
  capture as a property; the object carries only the names you declared.
- `test(line)` → `boolean` — whether the line matches, without building captures.
- `getPattern()` → `String` — the original template.

Two bounds keep an untrusted chat line from driving catastrophic backtracking: a
line longer than 1024 characters never matches (the regex is not run), and a
template with more than 16 placeholders throws at `criteria(...)` compile time.

```js
// Print who said what, only for real player chat lines.
const chat = client.criteria("<${player}> ${message}");

script.registerModule({ name: "ChatFilter", description: "Logs player messages" }, (module) => {
    module.on("chatReceived", (event) => {
        const m = chat.match(event.getMessage());
        if (m === null) return;              // system/formatted line — ignore
        client.print(m.player + " said: " + m.message);
    });
});
```

### Module access

- `isModuleEnabled(id)` → `boolean`
- `setModuleEnabled(id, enabled)`

There is **no `client.getModule`** — it was removed. A script never handles a
`Module` object; drive modules by id through these two methods or, preferably,
the dedicated `modules` global (below), which also covers metadata and listing.

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
booleans, `null` for strings, an empty `ScriptList` for listings. Lookups never
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

Listing methods return a **`ScriptList<String>`** — a read-only, array-like view
(`.length`, `[i]`, `for..of`, spread), also answering `size()` / `isEmpty()` /
`get(i)`. See [ScriptList](#scriptlist) below.

- `listAll()` → `ScriptList<String>` — every registered module (native + script).
- `listCategory(category)` → `ScriptList<String>` — `"Combat"`, `"Movement"`,
  `"Visual"`, `"World"`, `"Utility"`, or `"Scripts"`. Case-insensitive; empty
  list if invalid.
- `listEnabled()` → `ScriptList<String>` — every currently enabled module.

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

        // A ScriptList reads as an array — for..of is idiomatic.
        const combat = modules.listCategory("Combat");
        for (const name of combat) {
            client.print(name + " -> " + modules.isEnabled(name));
        }
    });
});
```

---

## mc — Minecraft facade

**Global binding:** `mc`

A thin, null-safe facade over the Minecraft client — it exists so scripts reach
the client through stable, exported names instead of the raw client object,
which the sandbox makes unreadable.

> **There is no `mc.player` and no `mc.world`.** The sandbox does no
> bean-property mapping, so the property form reads as **`undefined`** — and
> `undefined === null` is `false`, which makes `if (mc.player === null) return;`
> a guard that **never fires**. It does not throw; the handler simply runs on
> with no player. Call the getters.

- `getPlayer()` → `ScriptEntity | null` — the local player. **The null guard.**
  It is also readable like any other `ScriptEntity` (name, health, position),
  but for local-player state and movement prefer the richer `player` global.
- `getWorld()` → opaque token | `null` — **null-guard use only.** The returned
  value has no readable members: the host hands it back and a script can only
  compare it against `null` (which needs no member access). Every real world
  query lives on the `world` global.
- `mc.interactionManager` — `InteractionManagerProxy`. This one **is** a
  property, because it is an exported *field* rather than a getter. See
  [`character.md`](character.md#interaction-manager) for its 7 methods.
  `getInteractionManager()` exists too; prefer the field.

```js
module.on("preGameTick", () => {
    // The idiomatic guard, at the top of every event callback:
    if (mc.getPlayer() === null || mc.getWorld() === null) return;

    client.print("Health: " + player.getHealth());
});
```

---

## Timer

**Global binding:** `timer`

Millisecond stopwatches — the idiomatic way to rate-limit an action across
ticks without counting them by hand.

- `create()` → `ScriptTimer` — a new stopwatch, started now.
- `now()` → `long` — the current clock in milliseconds.

A `ScriptTimer` has exactly four members:

- `reset()` — restarts it from now.
- `elapsed()` → `long` — milliseconds since the last reset.
- `passed(ms)` → `boolean` — whether at least `ms` have elapsed.
- `passedAndReset(ms)` → `boolean` — `passed(ms)`, and resets when it returns
  `true`. The one-call idiom for "do this at most every `ms`".

```js
script.registerModule({ name: "Pinger", description: "Chats on an interval" }, (module) => {
    const cooldown = timer.create();

    module.on("preGameTick", () => {
        if (mc.getPlayer() === null || mc.getWorld() === null) return;
        if (cooldown.passedAndReset(5000)) {
            notification.info("Pinger", "5s tick");
        }
    });
});
```

---

## ScriptList

Every collection any proxy hands back — `world.getEntities()`,
`world.getLivingEntitiesInRange()`, `world.getAdjacentDirections()`,
`modules.listAll()`, `modules.listCategory()`, `modules.listEnabled()`,
`renderer.wrapText()`, `movement.yawPos()`, `player.getEffects()`,
`ScriptEntity.getEffects()` — is a `ScriptList<T>`.

**A `ScriptList` reads as a read-only JS array.** `.length`, `list[i]`,
`for..of`, spread (`[...list]`), and `Array.from(list)` all work. The three
original members still work too, so old code keeps running:

- `size()` → `int` — the element count (`0` when empty). Same as `.length`.
- `isEmpty()` → `boolean`.
- `get(i)` → `T | null` — the element at zero-based `i`. **Bounds-safe**: an
  out-of-range index returns `null`. (`list[i]` past the end throws instead, so
  prefer `for..of` or `get(i)` when the index might be out of range.)

Two limits to keep in mind:

- **It is not a full `Array`.** There is no `Array.prototype`, so `.map`,
  `.filter`, `.forEach`, `.reduce`, and friends are `undefined`. Use `for..of`,
  or `Array.from(list)` first when you want array methods.
- **It is read-only.** No add/remove/sort; assigning `list[i]` or calling
  `.push` never mutates it (and throws in a module/strict script). Elements are
  handed out as-is and stay subject to the same host-access policy.

```js
// Idiomatic: for..of.
const entities = world.getLivingEntitiesInRange(64);
for (const entity of entities) {
    client.print(entity.getName());
}
```
