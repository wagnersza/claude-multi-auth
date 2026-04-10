import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createTempDir, removeTempDir } from "./helpers.mjs";

import {
  loadConfig,
  saveConfig,
  addProfile,
  removeProfile,
  getProfile,
  listProfiles,
  setDefaultProfile,
  resolveProfileName,
  maskProfileSecrets,
  SENSITIVE_PATTERNS
} from "../plugins/cma/scripts/lib/profiles.mjs";

let tmpDir;
let configPath;

beforeEach(() => {
  tmpDir = createTempDir();
  configPath = path.join(tmpDir, "profiles.json");
});

afterEach(() => {
  removeTempDir(tmpDir);
});

describe("loadConfig", () => {
  it("returns empty config when file does not exist", () => {
    const config = loadConfig(configPath);
    assert.strictEqual(config.defaultProfile, null);
    assert.deepStrictEqual(config.profiles, {});
  });

  it("loads existing config", () => {
    fs.writeFileSync(configPath, JSON.stringify({
      defaultProfile: "test",
      profiles: { test: { env: { ANTHROPIC_API_KEY: "sk-123" } } }
    }));
    const config = loadConfig(configPath);
    assert.strictEqual(config.defaultProfile, "test");
    assert.strictEqual(config.profiles.test.env.ANTHROPIC_API_KEY, "sk-123");
  });

  it("returns empty config on corrupt file", () => {
    fs.writeFileSync(configPath, "not-json");
    const config = loadConfig(configPath);
    assert.strictEqual(config.defaultProfile, null);
  });
});

describe("saveConfig", () => {
  it("writes config with 0o600 permissions", () => {
    saveConfig(configPath, {
      defaultProfile: "test",
      profiles: { test: { env: {} } }
    });
    const stat = fs.statSync(configPath);
    assert.strictEqual(stat.mode & 0o777, 0o600);
  });

  it("creates parent directory", () => {
    const nested = path.join(tmpDir, "nested", "profiles.json");
    saveConfig(nested, { defaultProfile: null, profiles: {} });
    assert.ok(fs.existsSync(nested));
  });
});

describe("addProfile", () => {
  it("adds a profile to config", () => {
    const config = addProfile(configPath, "bedrock", {
      env: { ANTHROPIC_API_KEY: "sk-123" },
      model: "sonnet"
    });
    assert.ok(config.profiles.bedrock);
    assert.strictEqual(config.profiles.bedrock.model, "sonnet");
  });

  it("throws if profile already exists", () => {
    addProfile(configPath, "bedrock", { env: {} });
    assert.throws(
      () => addProfile(configPath, "bedrock", { env: {} }),
      /already exists/
    );
  });

  it("sets as default if first profile", () => {
    const config = addProfile(configPath, "first", { env: {} });
    assert.strictEqual(config.defaultProfile, "first");
  });
});

describe("removeProfile", () => {
  it("removes an existing profile", () => {
    addProfile(configPath, "test", { env: {} });
    const config = removeProfile(configPath, "test");
    assert.strictEqual(config.profiles.test, undefined);
  });

  it("clears default if removed profile was default", () => {
    addProfile(configPath, "test", { env: {} });
    const config = removeProfile(configPath, "test");
    assert.strictEqual(config.defaultProfile, null);
  });

  it("throws if profile does not exist", () => {
    assert.throws(
      () => removeProfile(configPath, "nope"),
      /not found/
    );
  });
});

describe("getProfile", () => {
  it("returns profile by name", () => {
    addProfile(configPath, "bedrock", { env: { KEY: "val" } });
    const profile = getProfile(configPath, "bedrock");
    assert.strictEqual(profile.env.KEY, "val");
  });

  it("throws if profile not found", () => {
    assert.throws(
      () => getProfile(configPath, "nope"),
      /not found/
    );
  });
});

describe("listProfiles", () => {
  it("returns empty list when no profiles", () => {
    const list = listProfiles(configPath);
    assert.deepStrictEqual(list, []);
  });

  it("returns profile names with default marker", () => {
    addProfile(configPath, "a", { env: {} });
    addProfile(configPath, "b", { env: {} });
    const list = listProfiles(configPath);
    assert.strictEqual(list.length, 2);
    assert.ok(list.find(p => p.name === "a" && p.isDefault));
    assert.ok(list.find(p => p.name === "b" && !p.isDefault));
  });
});

describe("setDefaultProfile", () => {
  it("sets the default", () => {
    addProfile(configPath, "a", { env: {} });
    addProfile(configPath, "b", { env: {} });
    const config = setDefaultProfile(configPath, "b");
    assert.strictEqual(config.defaultProfile, "b");
  });

  it("throws if profile does not exist", () => {
    assert.throws(
      () => setDefaultProfile(configPath, "nope"),
      /not found/
    );
  });
});

describe("resolveProfileName", () => {
  it("returns explicit name when provided", () => {
    assert.strictEqual(resolveProfileName(configPath, "bedrock"), "bedrock");
  });

  it("returns default profile when no explicit name", () => {
    addProfile(configPath, "myprofile", { env: {} });
    assert.strictEqual(resolveProfileName(configPath, null), "myprofile");
  });

  it("throws when no default and no explicit name", () => {
    assert.throws(
      () => resolveProfileName(configPath, null),
      /No default profile/
    );
  });
});

describe("maskProfileSecrets", () => {
  it("masks sensitive env values", () => {
    const masked = maskProfileSecrets({
      env: {
        ANTHROPIC_API_KEY: "sk-ant-very-long-key-here",
        ANTHROPIC_BASE_URL: "https://example.com",
        ANTHROPIC_CUSTOM_HEADERS: "x-api-key: sk-secret-header-val"
      }
    });
    assert.strictEqual(masked.env.ANTHROPIC_API_KEY, "sk-a...here");
    assert.strictEqual(masked.env.ANTHROPIC_BASE_URL, "https://example.com");
    assert.strictEqual(masked.env.ANTHROPIC_CUSTOM_HEADERS, "x-ap...-val");
  });

  it("masks short values completely", () => {
    const masked = maskProfileSecrets({
      env: { ANTHROPIC_API_KEY: "short" }
    });
    assert.strictEqual(masked.env.ANTHROPIC_API_KEY, "****");
  });
});
