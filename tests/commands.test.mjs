// tests/commands.test.mjs
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { createTempDir, removeTempDir, writeTempJson } from "./helpers.mjs";

let tmpDir;
let configPath;
const COMPANION = path.resolve("plugins/cma/scripts/cma-companion.mjs");

function run(args, options = {}) {
  const env = {
    ...process.env,
    CLAUDE_PLUGIN_DATA: tmpDir,
    CMA_CONFIG_PATH: configPath,
    ...options.env
  };
  try {
    const stdout = execFileSync(process.execPath, [COMPANION, ...args], {
      cwd: options.cwd ?? tmpDir,
      env,
      encoding: "utf8",
      timeout: 10000
    });
    return { stdout, status: 0 };
  } catch (error) {
    return {
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      status: error.status ?? 1
    };
  }
}

beforeEach(() => {
  tmpDir = createTempDir();
  configPath = path.join(tmpDir, "profiles.json");
});

afterEach(() => {
  removeTempDir(tmpDir);
});

describe("setup subcommand", () => {
  it("lists profiles when none configured", () => {
    const result = run(["setup", "--json"]);
    const data = JSON.parse(result.stdout);
    assert.deepStrictEqual(data.profiles, []);
  });

  it("adds a profile", () => {
    writeTempJson(tmpDir, "profiles.json", {
      defaultProfile: null,
      profiles: {}
    });
    const result = run(["setup", "add", "test", "--env", "ANTHROPIC_API_KEY=sk-123", "--json"]);
    assert.strictEqual(result.status, 0);
    const data = JSON.parse(result.stdout);
    assert.ok(data.profiles.find(p => p.name === "test"));
  });
});

describe("task subcommand", () => {
  it("errors when no profile is configured", () => {
    const result = run(["task", "do something"]);
    assert.notStrictEqual(result.status, 0);
    assert.ok(result.stderr.includes("No default profile"));
  });
});

describe("status subcommand", () => {
  it("returns empty status", () => {
    const result = run(["status", "--json"]);
    assert.strictEqual(result.status, 0);
    const data = JSON.parse(result.stdout);
    assert.deepStrictEqual(data.running, []);
  });
});

describe("cancel subcommand", () => {
  it("errors when no active jobs", () => {
    const result = run(["cancel"]);
    assert.notStrictEqual(result.status, 0);
    assert.ok(result.stderr.includes("No active"));
  });
});

describe("result subcommand", () => {
  it("errors when no finished jobs", () => {
    const result = run(["result"]);
    assert.notStrictEqual(result.status, 0);
    assert.ok(result.stderr.includes("No finished"));
  });
});

describe("help", () => {
  it("prints usage", () => {
    const result = run(["help"]);
    assert.ok(result.stdout.includes("Usage:"));
  });
});
