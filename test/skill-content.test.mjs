// Tripwire test: makes sure every documented proxy/global name is still
// mentioned somewhere in the skill content. This does NOT validate signature
// accuracy (that's a manual job) — it just catches a whole section getting
// deleted, or a new proxy category shipping in the client without a skill
// update, before that silently ships to every installed adapter.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SKILL_DIR = join(ROOT, "skills", "opal-scripting");

// Recursively collect every .md file under `dir`.
function collectMarkdown(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            out.push(...collectMarkdown(full));
        } else if (entry.endsWith(".md")) {
            out.push(full);
        }
    }
    return out;
}

function readAllSkillContent() {
    return collectMarkdown(SKILL_DIR)
        .map((f) => readFileSync(f, "utf8"))
        .join("\n");
}

// Every proxy/global a script can reach, plus a representative sample of the
// bound Java/wrapper types. Not exhaustive signature coverage — just names
// that must appear *somewhere* in the skill content.
const REQUIRED_NAMES = [
    "client",
    "notification",
    "overlay",
    "modules",
    "mc",
    "player",
    "movement",
    "rotation",
    "inventory",
    "interaction", // mc.interactionManager
    "world",
    "esp",
    "renderer",
    "palette",
    "BlockPos",
    "Vec2f",
    "Vec3d",
    "MAIN_HAND",
];

test("skill content mentions every proxy/global name", () => {
    const content = readAllSkillContent();
    assert.ok(content.length > 0, "expected skill content to be non-empty");

    const missing = REQUIRED_NAMES.filter((name) => !content.includes(name));
    assert.deepEqual(
        missing,
        [],
        `skill content is missing mentions of: ${missing.join(", ")}. ` +
            "A proxy/global may have been deleted from the docs, or a new " +
            "one shipped in the client without a matching skill update.",
    );
});

test("skill content covers mc.interactionManager specifically", () => {
    const content = readAllSkillContent();
    assert.ok(
        content.includes("mc.interactionManager"),
        "expected at least one literal mention of mc.interactionManager",
    );
});

test("skill directory has the expected reference file layout", () => {
    const expected = [
        join(SKILL_DIR, "SKILL.md"),
        join(SKILL_DIR, "reference.md"),
        join(SKILL_DIR, "reference", "core.md"),
        join(SKILL_DIR, "reference", "character.md"),
        join(SKILL_DIR, "reference", "world.md"),
        join(SKILL_DIR, "reference", "ui.md"),
        join(SKILL_DIR, "palette-views.md"),
    ];
    for (const file of expected) {
        assert.doesNotThrow(
            () => readFileSync(file, "utf8"),
            `expected ${file} to exist`,
        );
    }
});
