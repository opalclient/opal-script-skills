# Opal scripting — API reference

Condensed reference for the Opal GraalVM-JS scripting API. Use **only** the
members listed here and in the linked files; do not invent methods.

This file covers the entry point, the module/settings/event model, and the
`keys` constants. The proxy globals themselves are split by category:

- [`reference/core.md`](reference/core.md) — `client`, `notification`,
  `overlay`, `modules`, `mc`.
- [`reference/character.md`](reference/character.md) — `player`, `movement`,
  `rotation`, `inventory`, and `mc.interactionManager`.
- [`reference/world.md`](reference/world.md) — `world`, `esp`, and the bound
  types (`BlockPos`, `Vec2f`, `Vec3d`, `Vec3i`, `Direction`,
  `RaytracedRotation`, `MathHelper`, `Color`, `MAIN_HAND`/`OFF_HAND`).
- [`reference/ui.md`](reference/ui.md) — `renderer` and `palette`.

## Entry point

```js
const script = registerScript({ name, version, authors: [ ... ] });
```

- `script.registerModule({ name, description }, (module) => { ... })` — register a
  toggleable module. The callback receives the `module` handle.

A single script may register multiple modules, and/or palette views, and/or
overlay islands.

## Module handle

Settings (declare once, inside the callback, before any `module.on(...)` call):

- `module.addBool(name, def)`
- `module.addNumber(name, def, min, max, step)`
- `module.addMode(name, [opt, ...])`
- `module.addGroup(name, [settingName, ...])` — groups previously declared
  settings under a collapsible header. Each name must match a setting added
  earlier in the callback; names that don't match are ignored, and if none
  match, the group is not created. Must be called **after** the settings it
  references.

Setting access:

- `module.getBool(name)` / `module.setBool(name, value)`
- `module.getNumber(name)` / `module.setNumber(name, value)`
- `module.getMode(name)` — current mode string. There is no `setMode`; mode
  settings are string-based and driven through the UI or `addMode` defaults.
- `module.isModeEqual(name, opt)` — case-insensitive boolean convenience.

Settings are automatically saved to config and persist across restarts and
reloads. Every getter returns a safe default (`false` / `0.0` / `""`) if the
name doesn't match a declared setting; every setter no-ops.

Events:

- `module.on(eventName, callback)` — see [Events](#events). Calling `on` again
  for the same event name on the same module **replaces** the previous
  handler; it does not stack.

## Events

Subscribe via `module.on(event, cb)`. Cancellable events expose
`event.setCancelled()` / `event.isCancelled()`; calling `setCancelled()` on a
non-cancellable event throws. Most events are plain objects read through
`getX()` getters; **`renderScreen`, `renderWorld`, `renderBloom`, and `swing`
are Java records** read through bare accessors (`event.tickDelta()`, not
`event.getTickDelta()`).

| Event | Payload accessors | Cancellable | Notes |
| --- | --- | --- | --- |
| `enable` / `disable` | _(none)_ | — | Module lifecycle. `enable` resets suppressed-error tracking; `disable` cleans up owned islands. |
| `preGameTick` / `postGameTick` | _(none)_ | — | Around the 20 TPS client tick. Guard for null world/player. |
| `renderScreen` | `drawContext()`, `canvas()`, `mouseX()`, `mouseY()`, `tickDelta()` | — | 2D HUD render pass — draw here. Record accessors. |
| `renderWorld` | `matrixStack()`, `tickDelta()` | — | 3D world render pass — use `esp.*` for projection. Record accessors. |
| `renderBloom` | `drawContext()`, `canvas()`, `tickDelta()` | — | Feeds the bloom/glow pass; shapes drawn here don't show directly. Record accessors. |
| `joinWorld` | _(none)_ | — | Local player joined a world. |
| `blockUpdate` | `getPos()`, `getOldState()`, `getNewState()` | — | A loaded block changed state. |
| `serverConnect` | `getServerAddress()` | yes | Before connecting to a server. |
| `serverDisconnect` | _(none)_ | — | Disconnected from a server. |
| `preMove` | `getSpeed()`, `getMovementInput()` | yes | Before the tick's movement is applied. |
| `postMove` | `getSpeed()`, `getMovementInput()` | no | After the tick's movement has been applied. |
| `preMovementPacket` | `getX/Y/Z()` + `setX/Y/Z()`, `getYaw/Pitch()` + `setYaw/Pitch()`, `isOnGround()`/`setOnGround()`, `isSprinting()`/`setSprinting()`, `isHorizontalCollision()`/`setHorizontalCollision()`, `isForceInput()`/`setForceInput()` | yes | Before the movement packet is sent — setters rewrite the server-visible position/rotation/flags. |
| `postMovementPacket` | Read-only subset of the above (no setters) | no | After the movement packet was sent — describes what was actually sent. |
| `sendPacket` / `receivePacket` | `getPacket()` | yes | Around batched (main-thread) packet I/O. |
| `instantaneousSendPacket` / `instantaneousReceivePacket` | `getPacket()` | yes | Around immediate (network-thread) packet I/O. |
| `attack` | `getTarget()` | no | Player attacks an entity, before the interaction is processed. |
| `swing` | `hand()` | no | Player swings an arm, before the swing is sent. Record accessor. |
| `itemUse` | _(none)_ | no | Player uses (right-clicks) the held item. |
| `jump` | `isSprinting()` / `setSprinting()` | yes | Before the jump impulse is applied; `setSprinting(false)` drops the sprint-jump boost. |
| `chatReceived` | `getText()`, `isOverlay()` / `setOverlay()` | yes | Chat message received, before it's shown. `getText().getString()` for plain text. |
| `keyPress` / `mousePress` | `getInteractionCode()` | — | Raw GLFW key / mouse-button code. |
| `resolutionChange` | _(none)_ | — | GUI framebuffer resolution changed. |

If a callback throws, the client prints the **first** error for that event
name to chat, then suppresses further errors from that event until the module
is re-enabled (toggle off/on, or reload, to reset). The handler keeps running.

## Keys

GLFW key constants for `keyPressed` / input handling:

- Arrows: `keys.UP`, `keys.DOWN`, `keys.LEFT`, `keys.RIGHT`
- Letters: `keys.A` … `keys.Z` (e.g. `keys.W`, `keys.S`)
- Action: `keys.SPACE`, `keys.ENTER`, `keys.ESCAPE`, `keys.TAB`,
  `keys.BACKSPACE`, `keys.LEFT_SHIFT`, `keys.LEFT_CONTROL`
- Numbers: `keys.NUM_0` … `keys.NUM_9`

See [`reference/ui.md`](reference/ui.md) for the palette view input contract
these codes are used with.
