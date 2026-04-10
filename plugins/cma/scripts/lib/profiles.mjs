import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".claude-multi-auth");
export const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, "profiles.json");

export const SENSITIVE_PATTERNS = [
  "API_KEY", "SECRET", "TOKEN", "PASSWORD", "CREDENTIALS", "CUSTOM_HEADERS"
];

function defaultConfig() {
  return { defaultProfile: null, profiles: {} };
}

export function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    return defaultConfig();
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return {
      defaultProfile: parsed.defaultProfile ?? null,
      profiles: parsed.profiles && typeof parsed.profiles === "object" ? parsed.profiles : {}
    };
  } catch {
    return defaultConfig();
  }
}

export function saveConfig(configPath, config) {
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  return config;
}

export function addProfile(configPath, name, profile) {
  const config = loadConfig(configPath);
  if (config.profiles[name]) {
    throw new Error(`Profile "${name}" already exists. Remove it first or choose a different name.`);
  }
  config.profiles[name] = {
    env: profile.env ?? {},
    ...(profile.model ? { model: profile.model } : {}),
    ...(profile.permissionMode ? { permissionMode: profile.permissionMode } : {})
  };
  if (!config.defaultProfile) {
    config.defaultProfile = name;
  }
  return saveConfig(configPath, config);
}

export function removeProfile(configPath, name) {
  const config = loadConfig(configPath);
  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" not found.`);
  }
  delete config.profiles[name];
  if (config.defaultProfile === name) {
    config.defaultProfile = null;
  }
  return saveConfig(configPath, config);
}

export function getProfile(configPath, name) {
  const config = loadConfig(configPath);
  const profile = config.profiles[name];
  if (!profile) {
    throw new Error(`Profile "${name}" not found. Run /cma:setup to see available profiles.`);
  }
  return profile;
}

export function listProfiles(configPath) {
  const config = loadConfig(configPath);
  return Object.keys(config.profiles).map(name => ({
    name,
    isDefault: config.defaultProfile === name,
    model: config.profiles[name].model ?? null,
    permissionMode: config.profiles[name].permissionMode ?? null,
    envKeyCount: Object.keys(config.profiles[name].env ?? {}).length
  }));
}

export function setDefaultProfile(configPath, name) {
  const config = loadConfig(configPath);
  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" not found.`);
  }
  config.defaultProfile = name;
  return saveConfig(configPath, config);
}

export function resolveProfileName(configPath, explicitName) {
  if (explicitName) {
    return explicitName;
  }
  const config = loadConfig(configPath);
  if (!config.defaultProfile) {
    throw new Error("No default profile configured. Run /cma:setup default <name>.");
  }
  return config.defaultProfile;
}

function maskValue(key, value) {
  const upper = key.toUpperCase();
  if (SENSITIVE_PATTERNS.some(p => upper.includes(p))) {
    return String(value).length > 8
      ? `${String(value).slice(0, 4)}...${String(value).slice(-4)}`
      : "****";
  }
  return value;
}

export function maskProfileSecrets(profile) {
  const maskedEnv = {};
  for (const [key, value] of Object.entries(profile.env ?? {})) {
    maskedEnv[key] = maskValue(key, value);
  }
  return { ...profile, env: maskedEnv };
}
