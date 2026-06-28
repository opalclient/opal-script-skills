# Opal scripting — palette views

`palette.createView` is Opal's flagship scripting surface: it registers a custom
**command-palette view** — a mini-app or game that takes over the palette's
content rectangle, draws every frame, and receives keyboard / mouse input. The
shipped `Pacman.js` is a full example; this is the minimal one.

## The shape of a view

```js
const id = palette.createView({
    id: "my-view",                 // unique string id
    title: "My View",              // shown in the palette list
    description: "What it does",    // sub-line in the list
    placeholder: "Hint text shown in the palette input",
    footer: [                       // optional key hint chips
        { key: "Space", label: "Action" },
        { key: "Esc", label: "Close" },
    ],
    render: function (x, y, w, h, dt) { /* draw here */ },
    keyPressed: function (keyCode, mods) { return false; },
    charTyped: function (ch) { return false; },     // optional
    mouseClicked: function (mx, my, button) { return false; }, // optional
});

palette.openView(id);   // open it now (or call openView("my-view"))
// palette.removeView(id);   // unregister when done
```

Contract:

- **`render(x, y, w, h, dt)`** draws into an auto-clipped content rect. `(x, y)`
  is the top-left, `(w, h)` the size, and `dt` is wall-clock seconds since the
  last frame — use it to advance animations and game logic frame-rate
  independently. Draw with the global `renderer` (see `reference.md`).
- **`keyPressed(keyCode, mods)`** returns `true` if it handled the key, `false`
  to pass it through. `keyCode` is a GLFW code from the `keys` global.
- **Esc always closes** the view — you never handle it yourself.
- `charTyped` and `mouseClicked` are optional; return a boolean for consumed.

## Complete example — a bouncing-ball clicker

A small, self-contained view: a ball bounces around the content rect, Space
pauses, clicking inside scores a point. It shows the render/update split, frame-
rate-independent motion via `dt`, the color rule, and input handling.

```js
const script = registerScript({
    name: "Bouncer",
    version: "1.0.0",
    authors: ["you"],
});

// Colors — always via renderer.color(), never raw 0xAARRGGBB literals.
const C = {
    bg: renderer.color(12, 12, 26),
    ball: renderer.color(255, 222, 51),
    text: renderer.color(244, 244, 250),
    dim: renderer.color(150, 150, 170),
};

const state = {
    bx: 40, by: 40, vx: 90, vy: 70, // position (px) + velocity (px/s)
    r: 14, score: 0, paused: false,
};

function update(w, h, dt) {
    if (state.paused) return;
    dt = Math.min(dt, 0.05); // clamp so a stalled frame can't teleport the ball
    state.bx += state.vx * dt;
    state.by += state.vy * dt;
    if (state.bx < state.r)        { state.bx = state.r;        state.vx = Math.abs(state.vx); }
    if (state.bx > w - state.r)    { state.bx = w - state.r;    state.vx = -Math.abs(state.vx); }
    if (state.by < state.r)        { state.by = state.r;        state.vy = Math.abs(state.vy); }
    if (state.by > h - state.r)    { state.by = h - state.r;    state.vy = -Math.abs(state.vy); }
}

palette.createView({
    id: "bouncer",
    title: "Bouncer",
    description: "Click the ball to score",
    placeholder: "Space to pause · click the ball · Esc to quit",
    footer: [
        { key: "Space", label: "Pause" },
        { key: "Click", label: "Score" },
    ],
    render: function (x, y, w, h, dt) {
        update(w, h, dt);
        // Coordinates are relative to (x, y); add the origin when drawing.
        renderer.roundedRect(x, y, w, h, 10, C.bg);
        renderer.circle(x + state.bx, y + state.by, state.r, C.ball);
        renderer.text("productsans-bold", "Score " + state.score, x + 12, y + 12, 9, C.text);
        if (state.paused) {
            const msg = "PAUSED";
            const tw = renderer.textWidth("productsans-bold", msg, 14);
            renderer.text("productsans-bold", msg, x + (w - tw) / 2, y + h / 2 - 7, 14, C.dim);
        }
    },
    keyPressed: function (keyCode, _mods) {
        if (keyCode === keys.SPACE) {
            state.paused = !state.paused;
            return true;
        }
        return false;
    },
    mouseClicked: function (mx, my, _button) {
        // mx, my are relative to the content rect's top-left.
        const dx = mx - state.bx;
        const dy = my - state.by;
        if (dx * dx + dy * dy <= state.r * state.r) {
            state.score++;
            return true;
        }
        return false;
    },
});
```

Open it from the palette by searching its title, or eagerly with
`palette.openView("bouncer")`.

## Tips

- **One engine, two surfaces.** As `Pacman.js` shows, you can share a pure
  update/render engine between a palette view and a `renderScreen` overlay
  module. In the palette you get `dt` for free; in `renderScreen` you compute it
  yourself (e.g. from `Date.now()`).
- **Clamp `dt`.** A backgrounded or first frame can deliver a large `dt`; clamp
  it (`Math.min(dt, 0.05)`) so physics/logic never jumps.
- **Keep state in module/closure scope**, not globals you can't clean up. If you
  registered the view dynamically, `palette.removeView(id)` to unregister.
- **Draw relative to `(x, y)`.** Everything you draw must add the passed origin;
  the content rect is not at `(0, 0)`.
