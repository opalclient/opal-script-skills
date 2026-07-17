# World proxies — world, esp, and bound types

Block/entity queries, world info, 3D-to-2D projection for ESP overlays, and
the script-safe wrapper types these proxies pass around. See
[`../reference.md`](../reference.md) for the module/event model and
[`character.md`](character.md) for `player` / `rotation` / `inventory`.

## World

**Global binding:** `world`

### Block queries

All take a `BlockPos`.

- `isAir(pos)` → `boolean`
- `isReplaceable(pos)` → `boolean` — air, fluid, grass, etc.
- `isSolid(pos)` → `boolean`
- `getBlockName(pos)` → `String` — localized display name.
- `getBlockHardness(pos)` → `float` — breaking hardness; `-1` means
  unbreakable (bedrock).

There is **no `getBlockState(pos)` and no `getBlock(pos)`** — both were removed.
They returned raw Mojang objects a script could read nothing off. The five
methods above answer what they were used for.

### Block helpers

- `hasAdjacentBlock(pos)` → `boolean` — any face-adjacent block is solid
  (placeable-against).
- `getAdjacentDirections(pos)` → `ScriptList<ScriptDirection>` — directions with
  a solid neighbor; can be empty. A `ScriptList`: array-like and read-only — see
  [`core.md`](core.md#scriptlist).

```js
const below = new BlockPos(pos.getX(), pos.getY() - 1, pos.getZ());
if (!world.isReplaceable(below)) return;

const dirs = world.getAdjacentDirections(below);
if (dirs.isEmpty()) return;

const side = dirs.get(0);
const neighbor = below.offset(side);
```

### Entity queries

Both return a `ScriptList<ScriptEntity>` — array-like and read-only, so `for..of`
is idiomatic. See [`core.md`](core.md#scriptlist).

- `getEntities()` → `ScriptList<ScriptEntity>` — every entity in the world.
- `getLivingEntitiesInRange(radius)` → `ScriptList<ScriptEntity>` — mobs +
  players within `radius` blocks of the player, excluding self.

### World info

- `getTime()` → `long` — world time in ticks.
- `getTimeOfDay()` → `long` — `0` = sunrise, `6000` = noon, `12000` = sunset,
  `18000` = midnight.
- `getDimension()` → `String` — e.g. `"minecraft:overworld"`.

```js
const targets = world.getLivingEntitiesInRange(5.0);
if (!targets.isEmpty()) {
    mc.interactionManager.attackEntity(targets.get(0));
    player.swingHand(MAIN_HAND);
}
```

---

## ESP

**Global binding:** `esp`

3D-to-2D screen projection for custom ESP overlays, driven from
`renderScreen` (2D HUD) or `renderWorld` (3D world pass). Every method takes a
`tickDelta` — get it from `client.getTickDelta()` — to interpolate smoothly
between ticks. Projection methods return `null` when the target is
off-screen/behind the camera; **always null-check before drawing**.

### Entity projection

- `getEntityBox2D(entity, tickDelta)` → `ScriptBox2D | null` — the entity's 3D
  bounding box projected to a 2D rectangle. Read it through **getters**:
  `getX()`/`getY()` (top-left), `getZ()` (width), `getW()` (height) — or the
  clearer aliases `getX1()`/`getY1()`/`getX2()`/`getY2()` (corners) and
  `getWidth()`/`getHeight()`. There is no `box.x` — property access reads
  `undefined`.

### Point projection

- `project(worldX, worldY, worldZ, tickDelta)` → `ScriptVec3 | null` — screen
  position via `getX()`/`getY()`/`getZ()`, where `getZ()` is depth;
  `getZ() >= 1.0` means **behind the camera** (a non-null result does not
  guarantee visibility — check `p.getZ() < 1.0`).
- `projectVec(pos, tickDelta)` → `ScriptVec3 | null` — convenience wrapper over
  `project` taking a `Vec3d`.

### Interpolation

- `getInterpolatedPosition(entity, tickDelta)` → `ScriptVec3 | null` — smooth,
  camera-relative entity position between ticks (for world-space rendering);
  `null` for a non-living entity.
- `lerp(start, end, tickDelta)` → `double` — linear interpolation.

### Visibility

- `isOnScreen(worldX, worldY, worldZ, tickDelta)` → `boolean`
- `isEntityOnScreen(entity, tickDelta)` → `boolean` — equivalent to
  `getEntityBox2D` returning non-null.

```js
module.on("renderScreen", (event) => {
    // renderScreen hands you getPartialTicks()/getMouseX()/getMouseY();
    // getPartialTicks() equals client.getTickDelta().
    if (mc.getPlayer() === null || mc.getWorld() === null) return;
    const tickDelta = event.getPartialTicks();

    const entities = world.getLivingEntitiesInRange(64);
    for (const entity of entities) {
        const box = esp.getEntityBox2D(entity, tickDelta);
        if (box === null) continue; // off-screen or behind camera

        const bx = box.getX(), by = box.getY();      // getters — box.x is undefined
        const bw = box.getZ(), bh = box.getW();      // width, height
        renderer.rectOutline(bx, by, bw, bh, 1.0, client.getThemePrimary());

        const name = entity.getName();               // a plain String; no .getString()
        const tw = renderer.textWidth("productsans-medium", name, 7);
        renderer.roundedRect(bx + bw / 2 - tw / 2 - 4, by - 17, tw + 8, 14, 3,
            renderer.color(0, 0, 0, 160));
        renderer.text("productsans-medium", name, bx + bw / 2 - tw / 2, by - 10, 7,
            renderer.color(255, 255, 255));
    }
});
```

---

## Types

Two different things live here, and the difference matters:

- **Class globals** — the only classes a script can name and construct:
  `BlockPos`, `Vec2f`, `Vec3d`, `Color`, plus the `MAIN_HAND` / `OFF_HAND`
  constants. There is no `Java.type` and no import, so this list is closed.
- **Wrapper types** — what the proxies *return*: `ScriptVec3`, `ScriptEntity`,
  `ScriptEffect`, `ScriptBox2D`, `ScriptBox3D`, `ScriptItemStack`,
  `ScriptDirection`, `ScriptRaytracedRotation`, `ScriptImage`, `ScriptList`,
  `ScriptTimer`. A script receives these, never constructs them.

Every one of them is read through **exported getters**. Property access
(`vec.x`, `box.y`) is not member access — it reads `undefined`, silently. When
in doubt, call a getter.

### BlockPos

An integer block position. Construct with `new BlockPos(x, y, z)`. Returned by
`player.getBlockPosition()` and similar.

- `getX()` / `getY()` / `getZ()` → `int`
- `offset(direction)` → `BlockPos` — shifted one block in `direction`.

```js
const pos = player.getBlockPosition();
const below = new BlockPos(pos.getX(), pos.getY() - 1, pos.getZ());
```

### Vec2f

A yaw/pitch pair. Construct with `new Vec2f(yaw, pitch)`. Returned by
`rotation.getRotation()`, `rotation.getRotationFromPosition(pos)`, etc.

- `getYaw()` / `getPitch()` → `float`

### ScriptDirection

A cardinal/vertical facing direction. Not a global — scripts don't construct
one; obtain it from `world.getAdjacentDirections(pos)`.

- `getOpposite()` → `ScriptDirection`
- `getName()` → `String` — one of `north`/`south`/`east`/`west`/`up`/`down`.

### ScriptRaytracedRotation

A validated rotation paired with the hit result needed for interaction. Not a
global. Returned by `rotation.getRotationFromRaycastedBlock()` and
`rotation.getRotationFromRaycastedEntity()`; may be `null` when no valid
rotation reaches the target.

- `getYaw()` / `getPitch()` → `float`
- `getHitResult()` → an **opaque token** — it has no readable members. That is
  fine and intended: its only use is to hand straight back to
  `mc.interactionManager.interactBlock(hand, hitResult)`. Never try to read
  from it.

```js
const raytrace = rotation.getRotationFromRaycastedBlock(
    neighbor, side.getOpposite(), rotation.getRotation(), player.getEyePosition()
);
if (raytrace === null) return;

rotation.set(raytrace.getYaw(), raytrace.getPitch());
mc.interactionManager.interactBlock(MAIN_HAND, raytrace.getHitResult());
```

### Vec3d (a ScriptVec3)

A double-valued 3D vector. The global `Vec3d` is bound to the `ScriptVec3`
wrapper, so it is both constructible **and** fully readable — construct with
`new Vec3d(x, y, z)`. Returned by `player.getPosition()`,
`player.getEyePosition()`, `player.getVelocity()`, `player.getClosestPoint()`,
`rotation.getRotationVector()`, `esp.project()`, `esp.projectVec()`,
`esp.getInterpolatedPosition()`, and accepted by `esp.projectVec(pos)` /
`rotation.getRotationFromPosition(pos)`.

- `getX()` / `getY()` / `getZ()` → `double` — **not** `.x` / `.y` / `.z`.
- `length()` → `double`
- `distanceTo(other)` → `double`
- `add(other)` / `subtract(other)` → `ScriptVec3`

```js
const eye = player.getEyePosition();
const dist = eye.distanceTo(player.getPosition());  // getters, never eye.x
```

### Vec3i — removed

**`Vec3i` no longer exists as a global.** It was integer-valued, so the
double-valued `ScriptVec3` can't back it, and `BlockPos` already is the
integer-valued point type. Use `BlockPos`.

### MathHelper — dead global

`MathHelper` is bound to the raw `Mth` class, which has **nothing**
allow-listed, so **every call on it is denied**. It is not merely awkward; it
is unusable. Treat it as unavailable.

Use JavaScript's built-in `Math` instead — it covers `abs`, `floor`, `ceil`,
`round`, `min`, `max`, `pow`, `sqrt`, the trig functions, `hypot`, and
`random`. Opal-specific helpers live on the proxies: `esp.lerp(start, end, t)`
for interpolation, `rotation.getRotationDifference(a, b)` for wrap-aware angle
math, and `ScriptVec3`'s own `length()` / `distanceTo()`.

### ScriptEntity

Every entity a script sees — from `world.getEntities()`,
`world.getLivingEntitiesInRange()`, `mc.getPlayer()`, or
`AttackEvent.getTarget()`. Not a global; never constructed by a script. Pass it
back to any proxy method that takes an entity (`esp.getEntityBox2D`,
`player.getClosestPoint`, `mc.interactionManager.attackEntity`, …).

Reads that don't apply to this entity return **`-1`** rather than throwing —
`getHealth()`, `getMaxHealth()`, `getAbsorption()` and `getArmor()` on a
non-living entity, for example. Check the sentinel.

- Identity: `getName()` → `String` (a **plain string** — there is no
  `.getString()` on it), `getId()` → `int`, `getUuid()` → `String`.
- Kind: `isAlive()`, `isLiving()`, `isPlayer()` → `boolean`.
- Position: `getX()` / `getY()` / `getZ()` → `double`, `getYaw()` /
  `getPitch()` → `double`, `getDistance()` → `double` (from the local player).
- Health: `getHealth()`, `getMaxHealth()`, `getAbsorption()` → `double`,
  `getArmor()` → `int`.
- Effects: `hasEffect(name)` → `boolean`, `getEffect(name)` →
  `ScriptEffect | null`, `getEffects()` → `ScriptList<ScriptEffect>`.

```js
const entities = world.getLivingEntitiesInRange(16);
for (const e of entities) {
    if (!e.isPlayer()) continue;
    client.print(e.getName() + " " + e.getHealth() + "/" + e.getMaxHealth());
}
```

### ScriptEffect

A status (potion) effect on the local player or any entity, from
`player.getEffect(name)` / `getEffects()` or the same pair on a `ScriptEntity`.
Effect names accept either form: `"speed"` or `"minecraft:speed"`.

- `getId()` → `String` — namespaced id, e.g. `"minecraft:speed"`.
- `getName()` → `String` — localised display name.
- `getAmplifier()` → `int` — **0-based**, the raw vanilla value. Speed II → `1`.
- `getLevel()` → `int` — **1-based**, what the HUD displays. Speed II → `2`.
  This is `getAmplifier() + 1`; mixing the two up is an easy off-by-one.
- `getDuration()` → `int` — remaining duration in **ticks**.
- `getDurationSeconds()` → `int` — remaining whole seconds, or **`-1` when
  `isInfinite()`**.
- `isInfinite()` → `boolean`
- `isAmbient()` → `boolean` — from a beacon/conduit rather than a potion.
- `getColor()` → `int` — packed colour, matching the vanilla HUD's icon tint.

```js
if (player.hasEffect("speed")) {
    const speed = player.getEffect("speed");
    // Display "Speed II", not "Speed 1":
    client.print(speed.getName() + " " + speed.getLevel()
        + " (" + speed.getDurationSeconds() + "s)"); // -1 => infinite
}
```

### ScriptBox2D

A projected 2D rectangle from `esp.getEntityBox2D(entity, tickDelta)`. Two
naming schemes over the same rect, both exported — pick either:

- `getX()` / `getY()` / `getZ()` / `getW()` — top-left, width, height (the
  historical packing).
- `getX1()` / `getY1()` / `getX2()` / `getY2()` — the two corners; plus
  `getWidth()` / `getHeight()`.

There is no `box.x`.

### ScriptBox3D

An axis-aligned bounding box from `player.getBoundingBox()`.

- `getMinX()` / `getMinY()` / `getMinZ()` / `getMaxX()` / `getMaxY()` / `getMaxZ()`
  → `double`
- `getWidth()` / `getHeight()` / `getDepth()` → `double`

### ScriptItemStack

An item stack from `inventory.getStack(slot)` / `getMainHandStack()` /
`getOffHandStack()`.

- `isEmpty()` → `boolean`, `getCount()` → `int`
- `getName()` → `String` — display name. `getId()` → `String` — namespaced id.
- `isDamageable()` → `boolean`, `getDamage()` / `getMaxDamage()` → `int`
- `isBlock()` → `boolean`

### Color

The standard `java.awt.Color`, bound as `Color`. Its two constructors and
`getRGB()` are explicitly allow-listed, so unlike `MathHelper` it genuinely
works — use it as an alternative to `renderer.color(r, g, b, a)`.

```js
const c = new Color(255, 80, 0, 200);
renderer.rect(10, 10, 40, 40, c.getRGB());
```

- `getRGB()` → `int` — packed ARGB, valid in any `renderer` color parameter.

### Hand constants

`MAIN_HAND` / `OFF_HAND` — bound `net.minecraft.world.InteractionHand`
constants. Pass to `player.swingHand(hand)`, `player.useItem(hand)`,
`mc.interactionManager.interactBlock(hand, hitResult)`,
`mc.interactionManager.interactItem(hand)`.

```js
player.swingHand(MAIN_HAND);
```
