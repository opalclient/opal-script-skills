# Opal scripting — API reference

Condensed reference for the Opal GraalVM-JS scripting API. Use **only** the
members listed here and in the linked files; do not invent methods.

This file covers the entry point, the module/settings/event model, and the
`keys` constants. The proxy globals themselves are split by category:

- [`reference/core.md`](reference/core.md) — `client`, `notification`,
  `overlay`, `modules`, `mc`, `timer`, and `ScriptList`.
- [`reference/character.md`](reference/character.md) — `player`, `movement`,
  `rotation`, `inventory`, and `mc.interactionManager`.
- [`reference/world.md`](reference/world.md) — `world`, `esp`, the class globals
  (`BlockPos`, `Vec2f`, `Vec3d`, `Color`, `MAIN_HAND`/`OFF_HAND`), and the
  wrapper types the proxies return (`ScriptVec3`, `ScriptEntity`,
  `ScriptBox2D`, `ScriptDirection`, `ScriptRaytracedRotation`, …).
- [`reference/ui.md`](reference/ui.md) — `renderer` and `palette`.

**Two sandbox rules govern everything below.** The host-access policy is
default-deny, so: there is no `mc.player`/`mc.world` (property reads are
`undefined` — call `mc.getPlayer()`/`mc.getWorld()`), and every collection is a
`ScriptList` with only `size()`/`isEmpty()`/`get(i)` — never an array. Both
mistakes fail silently.

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

Binds:

- `module.setBind(code)` — binds the module to a key code from the `keys`
  global. Codes below `10` are mouse buttons; a negative code unbinds. Called
  during script load it is only a **default** — a bind the user saved, or sets
  in-session, is applied afterwards and wins.
- `module.getBind()` → `int` — the bound code, or `keys.NONE` (`-2`) when
  unbound.
- `module.clearBind()` — removes the bind. Same as `setBind(keys.NONE)`.

Events:

- `module.on(eventName, callback)` — see [Events](#events). Calling `on` again
  for the same event name on the same module **replaces** the previous
  handler; it does not stack.

## Events

Subscribe via `module.on(event, cb)`. Cancellable events expose
`event.cancel()` / `event.isCancelled()` (there is no `setCancelled()` — it was
unified to `cancel()` across every cancellable event).

Payloads are read through exported `getX()` getters. **Events marked
_(no payload)_ below carry nothing readable** — the handler is passed a raw
record with no exported members, so any accessor call on it throws
`Unknown identifier`. Declare those handlers with no parameter and read what
you need from the globals (`client.getTickDelta()` for the partial tick).

| Event | Payload accessors | Cancellable | Notes |
| --- | --- | --- | --- |
| `enable` / `disable` | _(no payload)_ | — | Module lifecycle. `enable` resets suppressed-error tracking; `disable` cleans up owned islands. |
| `preGameTick` / `postGameTick` | _(no payload)_ | — | Around the 20 TPS client tick. Guard with `mc.getPlayer()`/`mc.getWorld()`. |
| `renderScreen` | _(no payload)_ | — | 2D HUD render pass — draw here. `drawContext()`/`canvas()`/`mouseX()`/`mouseY()`/`tickDelta()` **all throw**; use `client.getTickDelta()`. |
| `renderWorld` | _(no payload)_ | — | 3D world render pass — use `esp.*` for projection. `matrixStack()`/`tickDelta()` **throw**. |
| `renderBloom` | _(no payload)_ | — | Feeds the bloom/glow pass; shapes drawn here don't show directly. Accessors **throw**. |
| `joinWorld` | _(no payload)_ | — | Local player joined a world. |
| `blockUpdate` | `getX()`, `getY()`, `getZ()`, `getOldBlock()`, `getNewBlock()` | no | A loaded block changed state. Block names are display names (`"Air"`, `"Stone"`). |
| `serverConnect` | `getHost()`, `getPort()`, `getAddress()` | yes | Before connecting to a server. `getAddress()` is `host:port`. |
| `serverDisconnect` | _(no payload)_ | — | Disconnected from a server. |
| `preMove` | `getSpeed()`, `getInputX()`, `getInputY()`, `getInputZ()` | yes | Before the tick's movement is applied. |
| `postMove` | `getSpeed()`, `getInputX()`, `getInputY()`, `getInputZ()` | no | After the tick's movement has been applied. |
| `preMovementPacket` | `getX/Y/Z()` + `setX/Y/Z()`, `getYaw/Pitch()` + `setYaw/Pitch()`, `isOnGround()`/`setOnGround()`, `isSprinting()`/`setSprinting()`, `isHorizontalCollision()`/`setHorizontalCollision()`, `isForceInput()`/`setForceInput()` | yes | Before the movement packet is sent — setters rewrite the server-visible position/rotation/flags. |
| `postMovementPacket` | `getX/Y/Z()`, `getYaw/Pitch()`, `isOnGround()`, `isSprinting()` | no | After the movement packet was sent — read-only, describes what was actually sent. |
| `sendPacket` / `receivePacket` | `getType()` | yes | Around batched (main-thread) packet I/O. `getType()` is the packet's simple class name, e.g. `"ServerboundMovePlayerPacket"`. |
| `instantaneousSendPacket` / `instantaneousReceivePacket` | `getType()` | yes | Around immediate (network-thread) packet I/O. |
| `attack` | `getTarget()` → `ScriptEntity`, `getTargetName()`, `getTargetId()`, `getTargetHealth()`, `getTargetMaxHealth()`, `getTargetDistance()` | no | Player attacks an entity, before the interaction is processed. The flattened getters are shortcuts for the target's reads; health/distance are `-1` when not applicable. |
| `swing` | `isMainHand()` | no | Player swings an arm, before the swing is sent. |
| `itemUse` | _(no payload)_ | no | Player uses (right-clicks) the held item. |
| `jump` | `isSprinting()` / `setSprinting()` | yes | Before the jump impulse is applied; `setSprinting(false)` drops the sprint-jump boost. |
| `chatReceived` | `getMessage()`, `isOverlay()` / `setOverlay()` | yes | Chat message received, before it's shown. `getMessage()` is **plain text** — there is no `getText()` and no `.getString()`. |
| `keyPress` / `mousePress` | `getCode()` | — | Raw GLFW key / mouse-button code. |
| `resolutionChange` | _(no payload)_ | — | GUI framebuffer resolution changed. |

If a callback throws, the client prints the **first** error for that event
name to chat, then suppresses further errors from that event until the module
is re-enabled (toggle off/on, or reload, to reset). The handler keeps running.

## Keys

GLFW key constants for `keyPressed` / input handling, and for
`module.setBind(code)`:

- Arrows: `keys.UP`, `keys.DOWN`, `keys.LEFT`, `keys.RIGHT`
- Letters: `keys.A` … `keys.Z` (e.g. `keys.W`, `keys.S`)
- Action: `keys.SPACE`, `keys.ENTER`, `keys.ESCAPE`, `keys.TAB`,
  `keys.BACKSPACE`, `keys.LEFT_SHIFT`, `keys.LEFT_CONTROL`
- Numbers: `keys.NUM_0` … `keys.NUM_9` (the digit row)
- Function: `keys.F1` … `keys.F12`
- Mouse buttons: `keys.MOUSE_0` … `keys.MOUSE_4` (`0`–`4` — any bind code
  below `10` is treated as a mouse button)
- Unbound: `keys.NONE` (`-2`) — what `module.getBind()` returns when the module
  has no bind, and what `module.setBind` takes to unbind.

See [`reference/ui.md`](reference/ui.md) for the palette view input contract
these codes are used with.
