# Character proxies — player, movement, rotation, inventory, interaction

Local player state, movement, rotation, inventory, and block/entity
interaction. See [`../reference.md`](../reference.md) for the module/event
model and [`world.md`](world.md) for the `BlockPos` / `Vec2f` / `Vec3d`
globals and the `ScriptVec3` / `ScriptEntity` / `ScriptBox3D` /
`ScriptItemStack` wrapper types these methods pass around.

## Player

**Global binding:** `player`

Every method reads the local player, which is absent on the main menu, during
world loads, and between disconnects — guard every handler with
`if (mc.getPlayer() === null) return;`. (**Not** `mc.player`: that property
does not exist, reads `undefined`, and makes the guard a silent no-op.) Entity
helpers fail soft on a non-living entity: `getDistanceToEntity()` returns
`-1.0`, `getClosestPoint()` returns `null` — test for those sentinels.

### Position

- `getEyePosition()` → `ScriptVec3` — eye position in world space; the raycast
  origin.
- `getPosition()` → `ScriptVec3` — alias of `getEyePosition()`.
- `getBlockPosition()` → `BlockPos` — floored block coordinates, with
  `getX()`/`getY()`/`getZ()`.
- `getVelocity()` → `ScriptVec3` — current per-tick velocity (delta movement).
- `getYaw()` / `getPitch()` → `float` — current rotation in degrees.
- `getFallDistance()` → `double` — blocks fallen since last touching ground.

The `ScriptVec3` values are fully readable — `getX()` / `getY()` / `getZ()`,
plus `length()`, `distanceTo(other)`, `add(other)`, `subtract(other)`. Property
access (`pos.x`) reads `undefined`; always use the getters. Pass them into proxy
methods (`rotation.getRotationFromPosition`, `esp.projectVec`) as-is.

### State

- `isOnGround()` / `isInAir()` → `boolean`
- `getAirTicks()` / `getGroundTicks()` → `int` — ticks continuously in that
  state.
- `isSneaking()` / `isSprinting()` → `boolean`
- `isUsingItem()` → `boolean` — eating, blocking, drawing a bow, etc.

### Health & effects

- `getHealth()` / `getMaxHealth()` / `getAbsorption()` → `float`
- `getArmor()` → `int` — total armour points (0–20).
- `hasEffect(name)` → `boolean` — whether the effect is active. `name` takes
  either `"speed"` or `"minecraft:speed"`.
- `getEffect(name)` → `ScriptEffect | null` — `null` when not active.
- `getEffects()` → `ScriptList<ScriptEffect>` — every active effect. A
  `ScriptList`: array-like (`for..of`, `.length`, `[i]`), read-only.

Mind `ScriptEffect`'s two level conventions: `getAmplifier()` is **0-based**
(vanilla — Speed II is `1`), `getLevel()` is **1-based** (display — Speed II is
`2`). `getDurationSeconds()` returns **`-1`** when the effect is infinite. Full
member table in [`world.md`](world.md#scripteffect).

```js
// Only sprint-boost when Speed isn't already doing the work.
if (!player.hasEffect("speed")) {
    movement.setSpeed(0.35);
}
```

### Combat

- `canCrit()` → `boolean` — whether the next attack would be a critical hit
  (falling, not on ground, not in water, etc.).
- `getAttackDamage()` → `double` — main-hand attack damage.
- `getAttackCooldown()` → `double` — attack strength scale, `0.0` right after
  swinging rising to `1.0` once fully recharged (gate a KillAura-style hit on
  it approaching `1.0`). **`1.0` (fully charged) when there is no local
  player** — the one entity read here that answers a full-charge sentinel
  instead of `-1`.
- `getEntityInteractionRange()` → `double` — max attack/interact distance.
- `isHoldingWeapon()` → `boolean` — sword, axe, or pickaxe in main hand.

### Entity utilities

`entity` is a `ScriptEntity` — from `world.getLivingEntitiesInRange()`,
`world.getEntities()`, or `AttackEvent.getTarget()`.

- `getDistanceToEntity(entity)` → `double` — bounding-box-to-bounding-box
  distance, or `-1.0` if not living.
- `getClosestPoint(entity)` → `ScriptVec3 | null` — closest point on the
  entity's box to the player's eye (the point KillAura aims at); `null` if not
  living.
- `isBoxEmpty(dx, dy, dz)` → `boolean` — whether the player's box, offset by
  `(dx, dy, dz)`, has no collisions.
- `isBoxEmptyBelow(dy)` → `boolean` — Scaffold-style edge check for the space
  below at offset `dy` (typically negative).
- `getBoundingBox()` → `ScriptBox3D` — read via `getMinX()` … `getMaxZ()`,
  `getWidth()` / `getHeight()` / `getDepth()`.
- `getStandingEyeHeight()` → `float`

### Actions

- `swingHand(hand)` — plays the swing animation (`MAIN_HAND` / `OFF_HAND`).
- `useItem(hand)` — right-click use + swing. Both null-check internally, but
  guard the handler anyway for consistent logic.

```js
// Aim at and attack the nearest reachable living entity.
module.on("preGameTick", () => {
    if (mc.getPlayer() === null || mc.getWorld() === null) return;

    const targets = world.getLivingEntitiesInRange(player.getEntityInteractionRange());
    if (targets.isEmpty()) return;

    const target = targets.get(0);
    const aim = player.getClosestPoint(target);
    if (aim === null) return;

    const rot = rotation.getRotationFromPosition(aim);
    rotation.set(rot.getYaw(), rot.getPitch());

    mc.interactionManager.attackEntity(target);
    player.swingHand(MAIN_HAND);
});
```

---

## Movement

**Global binding:** `movement`

Speed manipulation, direction calculation, and movement state queries. Angles
are in degrees unless the method name ends in `Radians`.

### Speed queries

- `getBlocksPerSecond()` → `double` — horizontal speed, blocks/second.
- `getSpeed()` → `double` — horizontal speed, blocks/tick (`getBlocksPerSecond`
  is roughly `getSpeed() * 20`; use blocks/tick when feeding back into
  `setSpeed`).

### Speed manipulation

- `yawPos(yaw, value)` → `ScriptList<Double>` — the `[deltaX, deltaZ]` offset
  for a yaw direction and distance. A two-element `ScriptList`: read it with
  `[0]` / `[1]` or `get(0)` / `get(1)`.
- `setEntitySpeed(entity, speed, yaw)` — sets an arbitrary `ScriptEntity`'s
  velocity.
- `setSpeed(speed)` — sets the player's speed along the current input
  direction.
- `setSpeed(speed, strafePercentage)` — blends forward (`0.0`) and strafe
  (`1.0`) motion.
- `setSpeed(speed, yaw)` — sets speed along a specific yaw. **Both two-arg
  overloads take two numbers** — the engine can't distinguish a strafe blend
  from a yaw angle by value alone. Prefer `yawPos(...)` for an explicit
  direction, and test either overload in-game before shipping.
- `getSwiftnessSpeed(speed[, multiplier])` → `double` — applies the Swiftness
  potion bonus to a base speed (default multiplier if omitted).

### Direction

- `getMoveYaw()` → `float` — current movement yaw from WASD input + camera.
- `getMoveYaw(fromX, fromZ, toX, toZ)` → `float` — yaw from one point to
  another. **Four plain numbers**, and they are world **X and Z** (not Y): the
  old two-vector form is no longer script-callable.
- `getDirectionDegrees([yaw])` / `getDirectionRadians([yaw])` → `float`/`double`
  — current (or yaw-relative) movement direction.
- `getDirection(rotationYaw, moveForward, moveStrafing)` → `double` — exact
  direction in radians from raw input values.

### State

- `isMoving()` → `boolean` — whether any movement key is currently pressed
  (input-based, not velocity-based — held against a wall while pressing W
  still counts; sliding on ice after releasing keys does not).

```js
module.on("preGameTick", () => {
    if (movement.isMoving()) {
        client.print("Speed: " + movement.getSpeed().toFixed(2));
        movement.setSpeed(0.5);
    }
});
```

---

## Rotation

**Global binding:** `rotation`

Two halves: **stateful** submission (`set`, `setSmooth`) drives the client's
shared rotation handler — the same system KillAura and Scaffold use, with
automatic server-side movement correction — while the **stateless** methods
only compute angles/vectors and never touch client state.

### Stateful submission

- `set(yaw, pitch)` — instant (snap) rotation, applied on the next movement
  packet.
- `setSmooth(yaw, pitch, speed)` — linear rotation capped to `speed` degrees
  per tick.

Both interact with native modules that also submit rotations — submit your
target every tick (e.g. from `preGameTick`) rather than once.

### Rotation calculation (stateless)

- `getRotationFromPosition(pos)` → `ScriptVec2f` — yaw/pitch to look at a world
  position. `pos` is a `Vec3d`/`ScriptVec3`.
- `getRotationFromBlock(blockPos, direction)` → `ScriptVec2f` — yaw/pitch to
  look at the center of a block face.
- `getRotationFromRaycastedBlock(blockPos, side, priorityRotations, playerPos)`
  → `ScriptRaytracedRotation | null` — validates a rotation actually hits the
  intended block face within reach (the method Scaffold uses).
- `getRotationFromRaycastedEntity(entity, closestVector, range)` →
  `ScriptRaytracedRotation | null` — validates a rotation hits a living entity
  within range (the method KillAura uses).
- `getRotationVector(pitch, yaw)` → `ScriptVec3` — unit look vector.

A `ScriptVec2f` is read with **`getYaw()` / `getPitch()`** — there is no `.x` /
`.y` (and no `x = yaw, y = pitch` convention to remember).

Both raycast methods return `null` when no valid rotation reaches the target —
always null-check before using the result.

### Rotation queries & math

- `getRotation()` → `ScriptVec2f` — current server-side rotation.
- `getRotationDifference(a, b)` → `float` — angular difference between two `ScriptVec2f`, wrap-aware.
- `getCursorDelta(rotationDelta, sensitivityMultiplier)` → `double`.
- `patchConstantRotation(rotation, prevRotation)` → `ScriptVec2f` — adds jitter to
  avoid constant-delta detection.
- `getSensitivityModifiedRotation(original)` → `float` — snaps to Minecraft's
  sensitivity grid.
- `getSentRotation(original)` → `ScriptVec2f` — full sensitivity + vanilla transform.
- `getSensitivityModifiedRotationVec(original)` → `ScriptVec2f`.
- `getVanillaRotation(original)` → `ScriptVec2f`.
- `getDuplicateWrapped(value, target)` → `float` — avoids duplicate-angle
  detection.

### FOV checks

- `getEntityFOV(entity)` → `double` — angle from look direction to entity.
- `isEntityInFOV(entity, fov)` → `boolean` — `fov` is the half-angle in
  degrees (`180` = full sphere).

```js
// Scaffold-style: raycast the block below, aim at it, and place.
module.on("preGameTick", () => {
    if (mc.getPlayer() === null || mc.getWorld() === null) return;

    const feet = player.getBlockPosition();
    const below = new BlockPos(feet.getX(), feet.getY() - 1, feet.getZ());
    if (!world.isReplaceable(below)) return;

    const dirs = world.getAdjacentDirections(below);
    if (dirs.isEmpty()) return;

    const side = dirs.get(0);
    const neighbor = below.offset(side);

    const raytrace = rotation.getRotationFromRaycastedBlock(
        neighbor, side.getOpposite(), rotation.getRotation(), player.getEyePosition()
    );
    if (raytrace === null) return;

    rotation.set(raytrace.getYaw(), raytrace.getPitch());
    mc.interactionManager.interactBlock(MAIN_HAND, raytrace.getHitResult());
    player.swingHand(MAIN_HAND);
});
```

---

## Inventory

**Global binding:** `inventory`

Hotbar slots are `0`–`8`; the full inventory is `0`–`35` (hotbar `0`–`8`, main
inventory `9`–`35`). The name-based search/count helpers match display name as a
case-insensitive substring; the `*ById` helpers match the stable registry id
exactly. All methods read the local player without an internal null guard —
check `if (mc.getPlayer() === null) return;` first.

### Slot switching

- `setSlot(slot)` — switches normally (visible to client and server).
- `setSlotSilent(slot)` — server sees the change; client held-item render may
  be preserved.
- `setSlotFullSilent(slot)` — fully spoofed: server sees the switch, client
  keeps rendering the original slot.
- `sendSlotPacket(slot)` — sends a raw slot-change packet (forces a switch for
  one action within a tick).
- `getSelectedSlot()` → `int` — currently selected hotbar index.

### Item searching

- `findBlock()` → `int` — first valid placeable block in the hotbar, or `-1`.
- `findItem(name)` → `int` — hotbar slot matching `name` (substring,
  case-insensitive), or `-1`.
- `findItemInInventory(name)` → `int` — same search across the full inventory
  (`0`–`35`), or `-1`.
- `findItemById(id)` → `int` — hotbar slot holding the item with registry `id`,
  or `-1`. `id` is `"diamond"` or `"minecraft:diamond"` (default namespace
  `minecraft`). Prefer this over `findItem` for logic: the display name is
  locale-dependent and anvil-renameable, the registry id is not. Matches
  `ScriptItemStack.getId()`.

### Stack inspection

- `getStack(slot)` → `ScriptItemStack` — read with `getName()` / `getId()` /
  `getCount()` / `isEmpty()` / `isBlock()` / `isDamageable()` / `getDamage()` /
  `getMaxDamage()`. See [`world.md`](world.md#scriptitemstack).
- `getMainHandStack()` / `getOffHandStack()` → `ScriptItemStack` (main-hand resolves
  through the same silent-switch state as `setSlotSilent`).
- `isHeldItemBlock()` → `boolean` — main hand holds a placeable block.
- `isBlock(slot)` → `boolean`
- `getItemName(slot)` → `String`
- `getItemCount(slot)` → `int`
- `countItem(name)` → `int` — total across the whole inventory (display-name
  substring).
- `countItemById(id)` → `int` — total across the whole inventory (`0`–`35`) of
  the item with registry `id`, bare or namespaced. The id-keyed counterpart to
  `countItem`; use it when the count feeds logic.
- `countBlocks()` → `int` — total placeable blocks in hotbar + off hand.

```js
module.on("preGameTick", () => {
    if (mc.getPlayer() === null) return;

    const blockSlot = inventory.findBlock();
    if (blockSlot !== -1) {
        inventory.setSlotSilent(blockSlot);
    }

    if (inventory.countBlocks() < 16) {
        notification.warn("Low Blocks", "Running out", 2000);
    }
});
```

---

## Interaction manager

**Field:** `mc.interactionManager` (an `InteractionManagerProxy`)

Wraps `ClientPlayerInteractionManager`; the local player is injected
automatically, and every method is null-guarded internally.

### Block interaction

- `interactBlock(hand, hitResult)` — right-clicks a block face. `hitResult`
  comes from a `ScriptRaytracedRotation.getHitResult()` and is an opaque token —
  pass it straight through, never read from it.
- `updateBlockBreakingProgress(pos, direction)` → `boolean` — advances
  block-breaking progress on the given face.
- `cancelBlockBreaking()` — cancels any in-progress break.
- `isBreakingBlock()` → `boolean`.

### Entity & item interaction

- `attackEntity(entity)` — attacks the given `ScriptEntity` with the main hand.
- `interactItem(hand)` — right-click use without targeting (throw a pearl,
  eat, etc.).
- `stopUsingItem()` — stops current use (release a bow, stop eating).

```js
// Place a block using a raycasted hit result, then swing.
mc.interactionManager.interactBlock(MAIN_HAND, raytrace.getHitResult());
player.swingHand(MAIN_HAND);

// Attack the closest living entity.
const targets = world.getLivingEntitiesInRange(5.0);
if (!targets.isEmpty()) {
    mc.interactionManager.attackEntity(targets.get(0));
    player.swingHand(MAIN_HAND);
}
```
