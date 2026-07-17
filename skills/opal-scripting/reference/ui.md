# UI proxies — renderer, palette

The 2D drawing canvas and the command-palette view system. See
[`../reference.md`](../reference.md) for the module/event model and
[`../palette-views.md`](../palette-views.md) for a complete worked example.

## Renderer

**Global binding:** `renderer`

Draws filled shapes, gradients, outlines, composite effects, images, vector
paths, and text. Draw **only** inside a render context: a module's
`renderScreen` callback, a palette view's `render`, or a Dynamic Island
`render` callback. Outside an active frame the canvas is unavailable and image
draws are silently skipped.

Shapes:

- `rect(x, y, w, h, color)`
- `roundedRect(x, y, w, h, radius, color)`
- `roundedRectVarying(x, y, w, h, tl, tr, br, bl, color)`
- `circle(cx, cy, radius, color)`
- `rainbowRect(x, y, w, h)` — animated rainbow fill (exactly 4 args).

Gradients (`angle` is in degrees):

- `rectGradient(x, y, w, h, color1, color2, angle)`
- `roundedRectGradient(x, y, w, h, radius, color1, color2, angle)`
- `roundedRectVaryingGradient(x, y, w, h, tl, tr, br, bl, color1, color2, angle)`

Outlines / strokes:

- `rectOutline(x, y, w, h, thickness, color)`
- `roundedRectOutline(x, y, w, h, radius, thickness, color)`
- `roundedRectOutlineVarying(x, y, w, h, tl, tr, br, bl, thickness, color)`
- `rectStroke(x, y, w, h, strokeThickness, color, strokeColor)`
- `rectOutlineStroke(x, y, w, h, outlineThickness, strokeThickness, outlineColor, strokeColor)`

Composite effects:

- `shadow(x, y, w, h, radius, blur, offX, offY, color)`
- `blurFill(x, y, w, h, radius)` — frosted blur behind a region.
- `blurFillVarying(x, y, w, h, tl, tr, br, bl)`
- `glowFill(x, y, w, h, radius)` — fills with the bloom-pass texture (5 args).
- `innerGlow(x, y, w, h, radius, spread, color)` — rim glow fading inward;
  **experimental** — present and stable, but has no native Opal UI caller yet
  and its rendered appearance is unverified.

Text (font is one of `"productsans-medium"`, `"productsans-bold"`,
`"materialicons-regular"`):

- `text(fontName, text, x, y, size, color)` → returns advance width.
- `textShadow(fontName, text, x, y, size, color)` → returns advance width.
- `textGradient(fontName, text, x, y, size, color1, color2)`
- `textWidth(fontName, text, size)` → number
- `textHeight(fontName, text, size)` → number — note `text` is required.
- `wrapText(fontName, text, width, size)` → `ScriptList<String>` — the lines
  after wrapping to `width`. Note the order is `text, width, size`. It is a
  **`ScriptList`, not an array**: `size()` / `get(i)` only — `.length` and
  `[i]` read as `undefined`, silently.
- `trimText(fontName, text, width, size)` → `String` (adds an ellipsis if
  truncated) — note order is `text, width, size`.

```js
const lines = renderer.wrapText("productsans-medium", msg, 180, 8);
for (let i = 0; i < lines.size(); i++) {
    renderer.text("productsans-medium", lines.get(i), x, y + i * 10, 8, fg);
}
```

Images (all `radius` args are **required**, not optional). Images load once
into a GPU handle; the renderer caches by path, so repeated `loadImage` calls
with the same path are cheap.

- `loadImage(path)` → `ScriptImage` — never throws on a missing/broken file; it
  returns an image whose `isValid()` is `false`. **Check `img.isValid()` before
  drawing.** Also exposes `getWidth()` / `getHeight()`.
- `destroyImage(image)`
- `image(image, x, y, w, h, radius)`
- `imageTinted(image, x, y, w, h, radius, tint)` — `radius` comes before
  `tint`.

Vector paths:

- `beginPath()`, `moveTo(x, y)`, `lineTo(x, y)`, `quadTo(cx, cy, x, y)`,
  `cubicTo(c1x, c1y, c2x, c2y, x, y)`, `closePath()`
- `strokeColor(color)`, `strokeWidth(w)`, `stroke()`

Transform / clip — `scale`, `rotate`, and `scissor` are **scoped**: they take a
rect plus a `content` function and run `save → content() → restore`, so draws
made inside the callback are transformed/clipped and nothing leaks out. Draw
relative to the rect you pass.

- `scale(factor, x, y, w, h, content)` — uniform scale; pivot is the rect center.
- `rotate(degrees, x, y, w, h, content)` — rotation in **degrees**; origin is
  translated to the rect center, so the callback draws relative to that origin.
- `scissor(x, y, w, h, content)` — clip the callback's draws to the rect.
- `globalAlpha(alpha)` — set a 0.0–1.0 alpha multiplier for subsequent draws this
  frame (not scoped; not a callback).

```js
renderer.scissor(x, y, w, h, function () {
    renderer.rect(x, y, 9999, 9999, C.bg); // clipped to (x, y, w, h)
});
```

Color helpers (all return packed ARGB ints — never use raw `0xAARRGGBB` literals):

- `color(r, g, b[, a])` — channels 0–255; `a` defaults to 255 (opaque).
- `withAlpha(color, alpha)` — replace the alpha channel; **`alpha` is 0–255**.
- `applyOpacity(color, factor)` — scale the alpha by a **0.0–1.0** `factor`. Use
  this (not `withAlpha`) to dim by a fraction.
- `interpolate(color1, color2, factor)` — blend; `factor` 0.0→color1, 1.0→color2.
- `darker(color, factor)` , `brighter(color, factor)`

```js
module.on("renderScreen", () => {
    const sw = client.getScaledWidth();
    const x = sw - 150, y = 10;

    renderer.shadow(x, y, 140, 60, 6, 12, 0, 3, renderer.color(0, 0, 0, 130));
    renderer.blurFill(x, y, 140, 60, 6);
    renderer.roundedRect(x, y, 140, 60, 6, renderer.color(15, 15, 20, 160));
    renderer.textShadow("productsans-bold", "Status", x + 10, y + 16, 9, client.getThemePrimary());
});
```

---

## Palette

**Global binding:** `palette`

Registers custom **command-palette views** — canvas-backed mini-apps and
games that take over the palette's content rectangle. Once registered, a view
behaves like any other palette entry: the user searches for it by title and
presses Enter, or a script opens it directly. While open, it owns the whole
region between the search row and the footer — the palette routes per-frame
rendering plus raw keyboard/mouse input to the view's callbacks instead of
drawing the normal result list.

### Creating a view

`createView(config)` → `String | null` — registers a view and returns its id,
or `null` if the config was invalid. Requires at least `{ id, render }`.

| Member | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `String` | **yes** | Unique view id. Passed to `openView` / `removeView`. |
| `render` | `function(x, y, w, h, dt)` | **yes** | Draws one frame into the content rectangle. |
| `title` | `String` | no | Display title in the palette list (searchable). Defaults to `id`. |
| `description` | `String` | no | Sub-text beside the title. Defaults to `"Script view"`. |
| `placeholder` | `String` | no | Placeholder text in the search row while open. |
| `footer` | `Array<{key, label}>` | no | Footer key-hint chips, e.g. `[{ key: "Space", label: "Start" }]`. |
| `keyPressed` | `function(keyCode, mods)` | no | Handles a key press. Return `true` to consume. |
| `charTyped` | `function(codepoint)` | no | Handles a typed character. Return `true` to consume. |
| `mouseClicked` | `function(localX, localY, button)` | no | Handles a click in content-local coordinates. Return `true` to consume. |

A callback that throws is reported to chat **once**, then suppressed — a
misbehaving script can never tear down the palette frame. Returning a
non-boolean from an input callback is treated as not-consumed.

- `openView(id)` — opens the palette directly into a registered view (enables
  the command-palette module if it isn't already on). Logs an error if `id`
  isn't registered.
- `removeView(id)` — unregisters a view so it no longer appears in the
  palette.

### The render callback

`render(x, y, w, h, dt)` runs once per frame while the view is open. `(x, y)`
is the content rectangle's top-left, `(w, h)` its size — the rect is **not**
anchored at `(0, 0)`, so draw relative to the passed origin. The canvas frame
is already open and scissor-clipped to the rect when `render` is called, so
drawing outside those bounds is harmless (simply clipped away).

`dt` is real elapsed wall-clock seconds since the previous frame, not a fixed
tick — multiply velocities by it for framerate-independent motion. It is
clamped to a maximum of `0.1` seconds (so a backgrounded/paused frame can't
teleport state), and is `0.0` on the very first frame after the view opens.

### Input callbacks

All three are optional; return a boolean, `true` when the event was handled.

- `keyPressed(keyCode, mods)` → `boolean` — `keyCode` is a GLFW code, compare
  against the `keys` global. `mods` is a bitmask: bit 0 = shift, bit 1 = ctrl.
- `charTyped(codepoint)` → `boolean` — Unicode code point of a typed
  character.
- `mouseClicked(localX, localY, button)` → `boolean` — coordinates are
  content-local (origin at the content rect's top-left, not the window);
  `button` is `0` = left, `1` = right, `2` = middle.

**Esc always closes the view** — the palette intercepts it before your
handlers run, so `keys.ESCAPE` never reaches `keyPressed`. A view can never
trap the user.

### Keys

GLFW key codes as plain integer fields on the `keys` global (scripts can't
reference `org.lwjgl.*` directly):

| Group | Constants |
| --- | --- |
| Arrows | `keys.UP`, `keys.DOWN`, `keys.LEFT`, `keys.RIGHT` |
| Action | `keys.SPACE`, `keys.ENTER`, `keys.ESCAPE`, `keys.TAB`, `keys.BACKSPACE`, `keys.LEFT_SHIFT`, `keys.LEFT_CONTROL` |
| Letters | `keys.A` … `keys.Z` |
| Digit row | `keys.NUM_0` … `keys.NUM_9` |
| Function | `keys.F1` … `keys.F12` |
| Mouse | `keys.MOUSE_0` … `keys.MOUSE_4` (`0`–`4`) |
| Unbound | `keys.NONE` (`-2`) |

The last two groups matter mainly for `module.setBind(code)`, where any code
below `10` is treated as a mouse button and `keys.NONE` unbinds — see
[`../reference.md`](../reference.md#module-handle).

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

See [`../palette-views.md`](../palette-views.md) for a complete worked
example (a bouncing-ball clicker), and the shipped `Pacman.js` for the
flagship full-featured demonstration.
