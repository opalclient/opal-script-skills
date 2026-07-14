import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
    existsSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CLI = join(ROOT, "bin", "install.mjs");

const tempDirs = [];
function freshDir() {
    const dir = mkdtempSync(join(tmpdir(), "opal-skills-test-"));
    tempDirs.push(dir);
    return dir;
}

function run(args, opts = {}) {
    return spawnSync(process.execPath, [CLI, ...args], {
        encoding: "utf8",
        ...opts,
    });
}

after(() => {
    for (const dir of tempDirs) {
        rmSync(dir, { recursive: true, force: true });
    }
});

test("list prints every supported target", () => {
    const r = run(["list"]);
    assert.equal(r.status, 0);
    for (const t of [
        "claude-code",
        "codex",
        "gemini",
        "copilot",
        "cursor",
        "windsurf",
        "generic",
    ]) {
        assert.ok(r.stdout.includes(t), `list output should mention ${t}`);
    }
});

test("--all writes the expected file for every target", () => {
    const dir = freshDir();
    const r = run(["add", "--all", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);

    const expected = [
        ".claude/skills/opal-scripting/SKILL.md",
        ".claude/skills/opal-scripting/reference.md",
        ".claude/skills/opal-scripting/reference/core.md",
        ".claude/skills/opal-scripting/reference/character.md",
        ".claude/skills/opal-scripting/reference/world.md",
        ".claude/skills/opal-scripting/reference/ui.md",
        ".claude/skills/opal-scripting/palette-views.md",
        ".cursor/rules/opal-scripting.md",
        "OPAL_SCRIPTING.md",
        "AGENTS.md",
        "GEMINI.md",
        ".github/copilot-instructions.md",
        ".windsurfrules",
    ];
    for (const rel of expected) {
        assert.ok(existsSync(join(dir, rel)), `expected ${rel} to be written`);
    }
});

test("claude-code copies the full skill files", () => {
    const dir = freshDir();
    const r = run(["add", "--target", "claude-code", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);

    const skill = readFileSync(
        join(dir, ".claude/skills/opal-scripting/SKILL.md"),
        "utf8",
    );
    assert.ok(skill.startsWith("---"), "SKILL.md should keep its frontmatter");
    assert.ok(skill.includes("name: opal-scripting"));
});

test("codex writes a delimited block and is idempotent", () => {
    const dir = freshDir();
    const file = join(dir, "AGENTS.md");

    let r = run(["add", "--target", "codex", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    let body = readFileSync(file, "utf8");
    assert.ok(body.includes("<!-- opal-scripting:start -->"));
    assert.ok(body.includes("<!-- opal-scripting:end -->"));
    assert.ok(!body.includes("name: opal-scripting"), "block strips frontmatter");

    // Re-running replaces the block, not duplicates it.
    r = run(["add", "--target", "codex", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    body = readFileSync(file, "utf8");
    const starts = body.split("<!-- opal-scripting:start -->").length - 1;
    assert.equal(starts, 1, "re-run should not duplicate the block");
});

test("block target preserves surrounding user content", () => {
    const dir = freshDir();
    const file = join(dir, "GEMINI.md");
    writeFileSync(file, "# My project notes\n\nKeep me.\n");

    const r = run(["add", "--target", "gemini", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    const body = readFileSync(file, "utf8");
    assert.ok(body.includes("# My project notes"), "existing content preserved");
    assert.ok(body.includes("Keep me."));
    assert.ok(body.includes("<!-- opal-scripting:start -->"));
});

test("copilot writes under .github", () => {
    const dir = freshDir();
    const r = run(["add", "--target", "copilot", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, ".github/copilot-instructions.md")));
});

test("generic combined file contains all three skill sections", () => {
    const dir = freshDir();
    const r = run(["add", "--target", "generic", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    const body = readFileSync(join(dir, "OPAL_SCRIPTING.md"), "utf8");
    assert.ok(body.includes("# Opal scripting"));
    assert.ok(body.includes("# API reference"));
    assert.ok(body.includes("# Palette views"));
});

test("auto-detect installs only matching targets", () => {
    const dir = freshDir();
    writeFileSync(join(dir, "AGENTS.md"), "# notes\n");

    const r = run(["add", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes("codex"), "should detect codex via AGENTS.md");
    assert.ok(
        readFileSync(join(dir, "AGENTS.md"), "utf8").includes(
            "<!-- opal-scripting:start -->",
        ),
    );
    assert.ok(!existsSync(join(dir, "OPAL_SCRIPTING.md")), "no generic fallback");
});

test("auto-detect falls back to generic when nothing matches", () => {
    const dir = freshDir();
    const r = run(["add", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, "OPAL_SCRIPTING.md")));
});

test("default command is add", () => {
    const dir = freshDir();
    const r = run(["--target", "generic", "--dir", dir]);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(existsSync(join(dir, "OPAL_SCRIPTING.md")));
});

test("unknown target exits non-zero with a helpful message", () => {
    const dir = freshDir();
    const r = run(["add", "--target", "nope", "--dir", dir]);
    assert.notEqual(r.status, 0);
    assert.ok(r.stderr.includes("unknown target"));
});
