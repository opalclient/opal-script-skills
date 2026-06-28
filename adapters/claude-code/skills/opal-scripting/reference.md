# Opal scripting — API reference

Condensed reference for the Opal GraalVM-JS scripting API. Use **only** the
members listed here; do not invent methods. Members are grouped by the global
proxy they hang off.

## Entry point

```js
const script = registerScript({ name, version, authors: [ ... ] });
```

- `script.registerModule({ name, description }, (module) => { ... })` — register a
  toggleable module. The callback receives the `module` handle.

A single script may register multiple modules, and/or palette views, and/or
overlay islands.

## Module handle

Settings (declare once, inside the callback):

- `module.addBool(name, def)`
- `module.addNumber(name, def, min, max, step)`
- `module.addMode(name, [opt, ...])`
- `module.addGroup(name)` — visual grouping for the settings that follow.

Setting access:

- `module.getBool(name)` / `module.setBool(name, value)`
- `module.getNumber(name)` / `module.setNumber(name, value)`
- `module.getMode(name)` — current mode string.
- `module.isModeEqual(name, opt)` — boolean convenience.

Events:

- `module.on(eventName, callback)` — see [Events](#events).

## Events

Subscribe via `module.on(event, cb)`. Cancellable events expose
`event.setCancelled()`.

| Event | Arg | Cancellable | Notes |
| --- | --- | --- | --- |
| `enable` / `disable` | — | — | Module lifecycle. Clean up here. |
| `preGameTick` / `postGameTick` | — | — | Per tick. Guard for null world/player. |
| `renderScreen` | — | — | HUD render pass — draw here. |
| `renderBloom` | — | — | Bloom render pass. |
| `joinWorld` | — | — | Entered a world. |
| `chatReceived` | event | yes | `event.getText()` → text; cancel to suppress. |
| `keyPress` | event | — | `event.getInteractionCode()` → GLFW key. |
| `mousePress` | event | — | `event.getInteractionCode()` → GLFW button. |
| `attack` | — | — | Player attacked. |
| `swing` | — | — | Hand swing. |
| `itemUse` | — | — | Item used. |
| `jump` | — | yes | Player jump. |
| `blockUpdate` | — | — | A block changed. |
| `serverConnect` | — | yes | Connecting to a server. |
| `serverDisconnect` | — | — | Disconnected. |
| `resolutionChange` | — | — | Window/scale changed. |
| `preMove` / `postMove` | — | — | Around movement application. |
| `preMovementPacket` / `postMovementPacket` | — | — | Around movement packets. |
| `sendPacket` / `receivePacket` | — | — | Around batched packet I/O. |
| `instantaneousSendPacket` / `instantaneousReceivePacket` | — | — | Immediate packet I/O. |

## Renderer

Draw **only** inside a render context (`renderScreen` / `renderBloom`, a palette
view `render`, or an island `render`).

Shapes:

- `rect(x, y, w, h, color)`
- `roundedRect(x, y, w, h, radius, color)`
- `roundedRectVarying(x, y, w, h, tl, tr, br, bl, color)`
- `circle(cx, cy, radius, color)`
- `rectGradient(x, y, w, h, c1, c2, ...)`
- `rectOutline(x, y, w, h, thickness, color)`
- `roundedRectOutline(x, y, w, h, radius, thickness, color)`
- `rainbowRect(x, y, w, h, ...)`
- `shadow(x, y, w, h, radius, blur, offX, offY, color)`
- `blurFill(x, y, w, h, radius)` — frosted blur behind a region.
- `glowFill(x, y, w, h, ...)`

Text (font is one of `"productsans-medium"`, `"productsans-bold"`,
`"materialicons-regular"`):

- `text(font, str, x, y, size, color)` → returns advance width.
- `textShadow(...)`, `textGradient(...)`
- `textWidth(font, str, size)` → number
- `textHeight(font, size)` → number
- `wrapText(font, str, size, maxWidth)` , `trimText(font, str, size, maxWidth)`

Images:

- `loadImage(path)` → handle (check `handle.isValid()`).
- `destroyImage(handle)`
- `image(handle, x, y, w, h[, radius])`
- `imageTinted(handle, x, y, w, h, color[, radius])`

Vector paths:

- `beginPath()`, `moveTo(x, y)`, `lineTo(x, y)`, `quadTo(cx, cy, x, y)`,
  `cubicTo(c1x, c1y, c2x, c2y, x, y)`, `closePath()`
- `strokeColor(color)`, `strokeWidth(w)`, `stroke()`

Transform / clip:

- `scale(s)`, `rotate(rad)`, `globalAlpha(a)`, `scissor(x, y, w, h)`

Color helpers (all return packed ints — never use raw `0xAARRGGBB` literals):

- `color(r, g, b[, a])`
- `withAlpha(color, a)`
- `applyOpacity(color, factor)`
- `interpolate(colorA, colorB, t)`
- `darker(color, f)` , `brighter(color, f)`

## Palette

- `palette.createView({ id, title, description, placeholder, footer, render, keyPressed, charTyped, mouseClicked })` → id
  - `footer`: array of `{ key, label }` hint chips.
  - `render(x, y, w, h, dt)` — draw into the clipped content rect; `dt` = seconds since last frame.
  - `keyPressed(keyCode, mods)` → return `true` if consumed.
  - `charTyped(ch)` , `mouseClicked(mx, my, button)` — optional, return boolean.
- `palette.openView(id)`
- `palette.removeView(id)`

Esc always closes the active view.

## Overlay (Dynamic Island)

- `overlay.createIsland({ width, height, priority, render })` → id
  - `render(x, y, w, h, progress)` — `progress` is the show/hide animation 0..1.
- `overlay.showIsland(id)` , `overlay.hideIsland(id)` , `overlay.destroyIsland(id)`
- `overlay.setIslandWidth(id, w)` , `setIslandHeight(id, h)` , `setIslandPriority(id, p)`

## Notifications

- `notification.success(title, desc[, ms])`
- `notification.error(title, desc[, ms])`
- `notification.warn(title, desc[, ms])`
- `notification.info(title, desc[, ms])`
- `notification.show(type, title, desc[, ms])`

## Keys

GLFW key constants for `keyPressed` / input handling:

- Arrows: `keys.UP`, `keys.DOWN`, `keys.LEFT`, `keys.RIGHT`
- Letters: `keys.A` … `keys.Z` (e.g. `keys.W`, `keys.S`)
- Specials: `keys.SPACE`, `keys.ENTER`, `keys.ESCAPE`, `keys.TAB`
- Numbers: `keys.NUM_0` … `keys.NUM_9`

## Other globals

These proxies expose client state and actions. Members vary by build; prefer
reading a shipped example (`opal/scripts/ScriptScaffold.js`) over guessing.

- `client` — scaled screen size (`getScaledWidth()`, `getScaledHeight()`) and client info.
- `player` — local player (`getHealth()`, `getBlockPosition()`, `getEyePosition()`, `swingHand(...)`, `useItem(...)`).
- `world` — world queries (`isReplaceable(pos)`, `getAdjacentDirections(pos)`, ...).
- `inventory` — slots/items (`findBlock()`, `findItem(name)`, `countBlocks()`, `getSelectedSlot()`, `setSlot(...)`, `setSlotSilent(...)`, `sendSlotPacket(...)`).
- `movement` — movement state and helpers.
- `rotation` — view rotation (`getRotation()`, `set(yaw, pitch)`, raycast helpers).
- `esp` — entity/box highlighting.
- `mc` — raw Minecraft handle (`mc.player`, `mc.world`, `mc.interactionManager`, ...). Always null-check `mc.player` / `mc.world`.
