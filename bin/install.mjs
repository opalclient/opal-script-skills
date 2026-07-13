#!/usr/bin/env node
// @opalclient/opal-script-skills — cross-AI installer for the Opal scripting skill.
//
// Renders the source-of-truth skill (skills/opal-scripting/*.md) into whatever
// assistant-specific surface a project uses. No dependencies, no network.
//
//   opal-skills add [--target <t>] [--dir <path>] [--all]
//   opal-skills list
//
// Run via `npx opal-skills ...` or directly as `node bin/install.mjs ...`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);
const MARK_START = "<!-- opal-scripting:start -->";
const MARK_END = "<!-- opal-scripting:end -->";

// ---------------------------------------------------------------------------
// Locate the packaged skill files robustly, whether run from the repo, from a
// global install, or via npx (where the package is unpacked in a cache).
// ---------------------------------------------------------------------------
function findSkillDir(start) {
    let dir = start;
    for (let i = 0; i < 8; i++) {
        const candidate = join(dir, "skills", "opal-scripting");
        if (existsSync(join(candidate, "SKILL.md"))) return candidate;
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    throw new Error(
        "Could not locate skills/opal-scripting relative to the installer. " +
            "Is the package intact?",
    );
}

const SKILL_DIR = findSkillDir(dirname(SELF));
const SKILL_FILES = [
    "SKILL.md",
    "reference.md",
    "reference/core.md",
    "reference/character.md",
    "reference/world.md",
    "reference/ui.md",
    "palette-views.md",
];
// The condensed/combined renderers only pull in the deep-dive reference
// files, not SKILL.md or palette-views.md (those are handled separately).
const REFERENCE_FILES = SKILL_FILES.filter(
    (name) => name !== "SKILL.md" && name !== "palette-views.md",
);

// ---------------------------------------------------------------------------
// Target registry. `mode` decides how content is written:
//   dir    -> copy the full skill files into a directory.
//   file   -> write one combined file (full skill).
//   block  -> upsert a delimited block (condensed SKILL.md body) into a file.
// ---------------------------------------------------------------------------
const TARGETS = {
    "claude-code": { mode: "dir", dest: ".claude/skills/opal-scripting" },
    cursor: { mode: "file", dest: ".cursor/rules/opal-scripting.md" },
    generic: { mode: "file", dest: "OPAL_SCRIPTING.md" },
    codex: { mode: "block", dest: "AGENTS.md" },
    gemini: { mode: "block", dest: "GEMINI.md" },
    copilot: { mode: "block", dest: ".github/copilot-instructions.md" },
    windsurf: { mode: "block", dest: ".windsurfrules" },
};

const TARGET_NAMES = Object.keys(TARGETS);

// Auto-detection markers: if present in --dir, install that target.
const DETECTORS = [
    { marker: ".claude", target: "claude-code" },
    { marker: "AGENTS.md", target: "codex" },
    { marker: "GEMINI.md", target: "gemini" },
    { marker: ".github", target: "copilot" },
    { marker: ".cursor", target: "cursor" },
    { marker: ".windsurfrules", target: "windsurf" },
];

// ---------------------------------------------------------------------------
// Content rendering.
// ---------------------------------------------------------------------------
function readSkill(name) {
    return readFileSync(join(SKILL_DIR, name), "utf8");
}

function stripFrontmatter(md) {
    if (md.startsWith("---")) {
        const end = md.indexOf("\n---", 3);
        if (end !== -1) {
            const after = md.indexOf("\n", end + 1);
            return md.slice(after + 1).replace(/^\s+/, "");
        }
    }
    return md;
}

// Condensed content for single-file block targets: the SKILL.md body.
function condensedBody() {
    return stripFrontmatter(readSkill("SKILL.md")).trimEnd();
}

// Full combined content for `file` targets (cursor / generic).
function combinedBody() {
    const referenceBody = REFERENCE_FILES.map((name) =>
        stripFrontmatter(readSkill(name)).trimEnd(),
    ).join("\n\n---\n\n");

    const parts = [
        stripFrontmatter(readSkill("SKILL.md")).trimEnd(),
        "\n\n---\n\n# API reference\n\n" + referenceBody,
        "\n\n---\n\n# Palette views\n\n" +
            stripFrontmatter(readSkill("palette-views.md")).trimEnd(),
    ];
    return parts.join("") + "\n";
}

function ensureDir(path) {
    mkdirSync(path, { recursive: true });
}

// Insert or replace the delimited block in an existing/new file (idempotent).
function upsertBlock(filePath, body) {
    const block = `${MARK_START}\n${body}\n${MARK_END}`;
    if (existsSync(filePath)) {
        const current = readFileSync(filePath, "utf8");
        const s = current.indexOf(MARK_START);
        const e = current.indexOf(MARK_END);
        if (s !== -1 && e !== -1 && e > s) {
            const next =
                current.slice(0, s) + block + current.slice(e + MARK_END.length);
            writeFileSync(filePath, next);
            return "updated";
        }
        const sep = current.length === 0 || current.endsWith("\n") ? "\n" : "\n\n";
        writeFileSync(filePath, current + sep + block + "\n");
        return "appended";
    }
    ensureDir(dirname(filePath));
    writeFileSync(filePath, block + "\n");
    return "created";
}

// ---------------------------------------------------------------------------
// Install a single target into `baseDir`. Returns a list of written paths.
// ---------------------------------------------------------------------------
function installTarget(target, baseDir) {
    const cfg = TARGETS[target];
    const written = [];

    if (cfg.mode === "dir") {
        const destDir = resolve(baseDir, cfg.dest);
        ensureDir(destDir);
        for (const name of SKILL_FILES) {
            const out = join(destDir, name);
            ensureDir(dirname(out));
            writeFileSync(out, readSkill(name));
            written.push(out);
        }
    } else if (cfg.mode === "file") {
        const out = resolve(baseDir, cfg.dest);
        ensureDir(dirname(out));
        writeFileSync(out, combinedBody());
        written.push(out);
    } else if (cfg.mode === "block") {
        const out = resolve(baseDir, cfg.dest);
        upsertBlock(out, condensedBody());
        written.push(out);
    }

    return written;
}

// ---------------------------------------------------------------------------
// CLI.
// ---------------------------------------------------------------------------
function parseArgs(argv) {
    const opts = { target: null, dir: process.cwd(), all: false, help: false };
    let command = null;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--all") opts.all = true;
        else if (a === "--help" || a === "-h") opts.help = true;
        else if (a === "--target" || a === "-t") opts.target = argv[++i];
        else if (a === "--dir" || a === "-d") opts.dir = argv[++i];
        else if (a.startsWith("--target=")) opts.target = a.slice("--target=".length);
        else if (a.startsWith("--dir=")) opts.dir = a.slice("--dir=".length);
        else if (!command && !a.startsWith("-")) command = a;
    }
    return { command: command || "add", opts };
}

function detectTargets(baseDir) {
    const found = [];
    for (const { marker, target } of DETECTORS) {
        if (existsSync(join(baseDir, marker)) && !found.includes(target)) {
            found.push(target);
        }
    }
    return found;
}

const USAGE = `opal-skills — install the Opal scripting skill for your AI assistant

Usage:
  opal-skills add [--target <t>] [--dir <path>] [--all]
  opal-skills list

Options:
  --target, -t   one of: ${TARGET_NAMES.join(", ")}
  --dir, -d      project directory to install into (default: cwd)
  --all          install every supported target
  --help, -h     show this help

With neither --target nor --all, the installer auto-detects which assistants a
project uses (.claude/, AGENTS.md, GEMINI.md, .github/, .cursor/, .windsurfrules)
and installs those; if none are detected it installs the 'generic' target.`;

function cmdList() {
    process.stdout.write("Supported targets:\n");
    for (const name of TARGET_NAMES) {
        process.stdout.write(`  ${name.padEnd(12)} -> ${TARGETS[name].dest}\n`);
    }
    return 0;
}

function cmdAdd(opts) {
    const baseDir = resolve(opts.dir);
    ensureDir(baseDir);

    let targets;
    if (opts.all) {
        targets = TARGET_NAMES.slice();
    } else if (opts.target) {
        if (!TARGETS[opts.target]) {
            process.stderr.write(
                `error: unknown target '${opts.target}'.\n` +
                    `valid targets: ${TARGET_NAMES.join(", ")}\n`,
            );
            return 2;
        }
        targets = [opts.target];
    } else {
        const detected = detectTargets(baseDir);
        targets = detected.length > 0 ? detected : ["generic"];
        process.stdout.write(
            detected.length > 0
                ? `Auto-detected: ${detected.join(", ")}\n`
                : "No assistant markers detected; installing 'generic'.\n",
        );
    }

    process.stdout.write(`Installing into ${baseDir}\n`);
    let count = 0;
    for (const target of targets) {
        const written = installTarget(target, baseDir);
        for (const file of written) {
            process.stdout.write(`  ${target.padEnd(12)} ${relative(baseDir, file)}\n`);
            count++;
        }
    }
    process.stdout.write(
        `Done: ${count} file(s) for ${targets.length} target(s).\n`,
    );
    return 0;
}

function main() {
    const { command, opts } = parseArgs(process.argv.slice(2));
    if (opts.help || command === "help") {
        process.stdout.write(USAGE + "\n");
        return 0;
    }
    if (command === "list") return cmdList();
    if (command === "add") return cmdAdd(opts);
    process.stderr.write(`error: unknown command '${command}'.\n\n${USAGE}\n`);
    return 2;
}

process.exit(main());
