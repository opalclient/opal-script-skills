# World proxies — world, esp, and bound types

Block/entity queries, world info, 3D-to-2D projection for ESP overlays, and
the script-safe wrapper types these proxies pass around. See
[`../reference.md`](../reference.md) for the module/event model and
[`character.md`](character.md) for `player` / `rotation` / `inventory`.

## World

**Global binding:** `world`

### Block queries

- `isAir(pos)` → `boolean`
- `isReplaceable(pos)` → `boolean` — air, fluid, grass, etc.
- `isSolid(pos)` → `boolean`
- `getBlockName(pos)` → `String` — localized display name.
- `getBlockState(pos)` → `BlockState`
- `getBlock(pos)` → `Block`
- `getBlockHardness(pos)` → `float` — breaking hardness; `-1` means
  unbreakable (bedrock).

### Block helpers

- `hasAdjacentBlock(pos)` → `boolean` — any face-adjacent block is solid
  (placeable-against).
- `getAdjacentDirections(pos)` → `List<Direction>` — directions with a solid
  neighbor; can be empty.

```js
const below = new BlockPos(pos.getX(), pos.getY() - 1, pos.getZ());
if (!world.isReplaceable(below)) return;

const dirs = world.getAdjacentDirections(below);
if (dirs.isEmpty()) return;

const side = dirs.get(0);
const neighbor = below.offset(side);
```

### Entity queries

- `getEntities()` → `Iterable` — every entity in the world.
- `getLivingEntitiesInRange(radius)` → `List<LivingEntity>` — mobs + players
  within `radius` blocks of the player, excluding self.

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

- `getEntityBox2D(entity, tickDelta)` → `Vector4d | null` — the entity's 3D
  bounding box projected to a 2D rectangle: `x`/`y` (top-left),
  `z` (width), `w` (height).

### Point projection

- `project(worldX, worldY, worldZ, tickDelta)` → `Vector3d | null` — screen
  `{x, y, z}` where `z` is depth; `z >= 1.0` means **behind the camera** (a
  non-null result does not guarantee visibility — check `p.z < 1.0`).
- `projectVec(pos, tickDelta)` → `Vector3d | null` — convenience wrapper over
  `project` taking a `Vec3d`.

### Interpolation

- `getInterpolatedPosition(entity, tickDelta)` → `Vec3d | null` — smooth,
  camera-relative entity position between ticks (for world-space rendering);
  `null` for a non-living entity.
- `lerp(start, end, tickDelta)` → `double` — linear interpolation.

### Visibility

- `isOnScreen(worldX, worldY, worldZ, tickDelta)` → `boolean`
- `isEntityOnScreen(entity, tickDelta)` → `boolean` — equivalent to
  `getEntityBox2D` returning non-null.

```js
module.on("renderScreen", () => {
    if (mc.player === null || mc.world === null) return;
    const tickDelta = client.getTickDelta();

    const entities = world.getLivingEntitiesInRange(64);
    for (let i = 0; i < entities.size(); i++) {
        const entity = entities.get(i);
        const box = esp.getEntityBox2D(entity, tickDelta);
        if (box === null) continue; // off-screen or behind camera

        renderer.rectOutline(box.x, box.y, box.z, box.w, 1.0, client.getThemePrimary());

        const name = entity.getName().getString();
        const tw = renderer.textWidth("productsans-medium", name, 7);
        renderer.roundedRect(box.x + box.z / 2 - tw / 2 - 4, box.y - 17, tw + 8, 14, 3,
            renderer.color(0, 0, 0, 160));
        renderer.text("productsans-medium", name, box.x + box.z / 2 - tw / 2, box.y - 10, 7,
            renderer.color(255, 255, 255));
    }
});
```

---

## Types

Bound Java and wrapper types injected as globals — no import needed.
Wrapper types (`BlockPos`, `Vec2f`, `Direction`, `RaytracedRotation`) expose
stable, readable method names. The raw Minecraft types (`Vec3d`, `Vec3i`) and
`MathHelper` use Fabric intermediary names at runtime, so **their methods are
not callable by readable name** — construct them and pass them into proxy
methods; do the actual math through the proxy globals. `Color` is a plain JDK
class and **is** directly callable.

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

### Direction

A cardinal/vertical facing direction. Scripts don't construct this directly —
obtain one from `world.getAdjacentDirections(pos)`.

- `getOpposite()` → `Direction`
- `getName()` → `String` — one of `north`/`south`/`east`/`west`/`up`/`down`.

### RaytracedRotation

A validated rotation paired with the hit result needed for interaction.
Returned by `rotation.getRotationFromRaycastedBlock()` and
`rotation.getRotationFromRaycastedEntity()`; may be `null` when no valid
rotation reaches the target.

- `getYaw()` / `getPitch()` → `float`
- `getHitResult()` → `HitResult` — pass to `mc.interactionManager.interactBlock()`.

```js
const raytrace = rotation.getRotationFromRaycastedBlock(
    neighbor, side.getOpposite(), rotation.getRotation(), player.getEyePosition()
);
if (raytrace === null) return;

rotation.set(raytrace.getYaw(), raytrace.getPitch());
mc.interactionManager.interactBlock(MAIN_HAND, raytrace.getHitResult());
```

### Vec3d / Vec3i

Raw Minecraft vectors (`net.minecraft.world.phys.Vec3` / `net.minecraft.core.Vec3i`).
Construct with `new Vec3d(x, y, z)` / `new Vec3i(x, y, z)`. Returned by
`player.getPosition()`, `player.getEyePosition()`,
`esp.getInterpolatedPosition()`, and accepted by `esp.projectVec(pos)`,
`rotation.getRotationFromPosition(pos)`. Intermediary-named at runtime — use
for construction and pass-through only; prefer `BlockPos` when you need
readable block coordinates.

### MathHelper

The raw `net.minecraft.util.Mth`, bound as `MathHelper`. Intermediary-named —
not callable by readable name. Use `esp.lerp(start, end, tickDelta)` for
interpolation, and JavaScript's built-in `Math` for general math.

### Color

The standard `java.awt.Color`, bound as `Color`. Unlike the Minecraft types
above, its methods **are** directly callable — use it as an alternative to
`renderer.color(r, g, b, a)`.

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
