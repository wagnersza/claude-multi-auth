#!/usr/bin/env node
// plugins/cma/scripts/cma-companion.mjs

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { parseArgs, splitRawArgumentString } from "./lib/args.mjs";
import {
  loadConfig,
  addProfile,
  removeProfile,
  getProfile,
  listProfiles,
  setDefaultProfile,
  resolveProfileName,
  maskProfileSecrets,
  DEFAULT_CONFIG_PATH
} from "./lib/profiles.mjs";
import { executeTask } from "./lib/cma-client.mjs";
import { resolveWorkspaceRoot } from "./lib/workspace.mjs";
import { terminateProcessTree } from "./lib/process.mjs";
import {
  generateJobId,
  upsertJob,
  writeJobFile
} from "./lib/state.mjs";
import {
  buildSingleJobSnapshot,
  buildStatusSnapshot,
  readStoredJob,
  resolveCancelableJob,
  resolveResultJob
} from "./lib/job-control.mjs";
import {
  appendLogLine,
  createJobLogFile,
  createJobProgressUpdater,
  createJobRecord,
  createProgressReporter,
  nowIso,
  runTrackedJob
} from "./lib/tracked-jobs.mjs";
import {
  renderCancelReport,
  renderJobStatusReport,
  renderQueuedTaskLaunch,
  renderSetupReport,
  renderStatusReport,
  renderStoredJobResult,
  renderTaskResult
} from "./lib/render.mjs";

const ROOT_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

function printUsage() {
  console.log([
    "Usage:",
    "  cma-companion setup [add|remove|test|default|show] [name] [--json]",
    "  cma-companion task [--profile <name>] [--model <model>] [--write] [--background] [--max-turns <n>] [prompt]",
    "  cma-companion task-worker --job-id <id> [--cwd <dir>]",
    "  cma-companion status [job-id] [--json]",
    "  cma-companion result [job-id] [--json]",
    "  cma-companion cancel [job-id] [--json]"
  ].join("\n"));
}

function resolveConfigPath() {
  return process.env.CMA_CONFIG_PATH || DEFAULT_CONFIG_PATH;
}

function outputResult(value, asJson) {
  if (asJson) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    process.stdout.write(typeof value === "string" ? value : JSON.stringify(value, null, 2));
  }
}

function outputCommandResult(payload, rendered, asJson) {
  outputResult(asJson ? payload : rendered, asJson);
}

function parseCommandInput(argv, config = {}) {
  const normalized = argv.length === 1 && argv[0]?.includes(" ")
    ? splitRawArgumentString(argv[0])
    : argv;
  return parseArgs(normalized, {
    ...config,
    aliasMap: { C: "cwd", ...(config.aliasMap ?? {}) }
  });
}

function resolveCommandCwd(options = {}) {
  return options.cwd ? path.resolve(process.cwd(), options.cwd) : process.cwd();
}

function shorten(text, limit = 96) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  return normalized.length <= limit ? normalized : `${normalized.slice(0, limit - 3)}...`;
}

// --- Setup ---

function handleSetup(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd", "env"],
    booleanOptions: ["json"]
  });
  const configPath = resolveConfigPath();
  const subcommand = positionals[0] ?? "";
  const name = positionals[1] ?? "";

  if (subcommand === "add") {
    if (!name) throw new Error("Profile name required: /cma:setup add <name>");
    const envPairs = {};
    if (options.env) {
      for (const pair of Array.isArray(options.env) ? options.env : [options.env]) {
        const eqIdx = pair.indexOf("=");
        if (eqIdx === -1) throw new Error(`Invalid env format: "${pair}". Use KEY=VALUE.`);
        envPairs[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
      }
    }
    addProfile(configPath, name, { env: envPairs });
    const profiles = listProfiles(configPath);
    const config = loadConfig(configPath);
    const report = { profiles, defaultProfile: config.defaultProfile };
    outputCommandResult(report, renderSetupReport(report), options.json);
    return;
  }

  if (subcommand === "remove") {
    if (!name) throw new Error("Profile name required: /cma:setup remove <name>");
    removeProfile(configPath, name);
    const profiles = listProfiles(configPath);
    const config = loadConfig(configPath);
    const report = { profiles, defaultProfile: config.defaultProfile };
    outputCommandResult(report, renderSetupReport(report), options.json);
    return;
  }

  if (subcommand === "default") {
    if (!name) throw new Error("Profile name required: /cma:setup default <name>");
    setDefaultProfile(configPath, name);
    const profiles = listProfiles(configPath);
    const config = loadConfig(configPath);
    const report = { profiles, defaultProfile: config.defaultProfile };
    outputCommandResult(report, renderSetupReport(report), options.json);
    return;
  }

  if (subcommand === "show") {
    if (!name) throw new Error("Profile name required: /cma:setup show <name>");
    const profile = getProfile(configPath, name);
    const masked = maskProfileSecrets(profile);
    outputResult(options.json ? masked : JSON.stringify(masked, null, 2) + "\n", options.json);
    return;
  }

  if (subcommand === "test") {
    if (!name) throw new Error("Profile name required: /cma:setup test <name>");
    return { asyncTest: true, name, asJson: options.json };
  }

  // Default: list profiles
  const profiles = listProfiles(configPath);
  const config = loadConfig(configPath);
  const report = { profiles, defaultProfile: config.defaultProfile };
  outputCommandResult(report, renderSetupReport(report), options.json);
}

async function handleSetupTest(name, asJson) {
  const configPath = resolveConfigPath();
  const profile = getProfile(configPath, name);
  const cwd = process.cwd();
  try {
    const result = await executeTask({
      profileName: name,
      profile,
      cwd,
      prompt: "Respond with exactly: OK",
      maxTurns: 1
    });
    const success = result?.content?.includes("OK") ?? false;
    const payload = { profile: name, success, content: result?.content ?? null };
    const rendered = success
      ? `Profile "${name}" authenticated successfully.\n`
      : `Profile "${name}" responded but did not return "OK": ${result?.content ?? "no output"}\n`;
    outputCommandResult(payload, rendered, asJson);
  } catch (error) {
    const payload = { profile: name, success: false, error: error.message };
    const rendered = `Profile "${name}" authentication failed: ${error.message}\n`;
    outputCommandResult(payload, rendered, asJson);
    process.exitCode = 1;
  }
}

// --- Task ---

async function executeTaskRun(request) {
  const configPath = resolveConfigPath();
  const profileName = resolveProfileName(configPath, request.profileName);
  const profile = getProfile(configPath, profileName);

  const result = await executeTask({
    profileName,
    profile,
    cwd: request.cwd,
    prompt: request.prompt,
    model: request.model,
    permissionMode: request.permissionMode,
    maxTurns: request.maxTurns,
    write: request.write,
    abortController: request.abortController,
    onProgress: request.onProgress
  });

  const rendered = renderTaskResult(result, {
    profileName,
    title: request.title ?? "CMA Task"
  });

  return {
    exitStatus: result?.subtype === "success" ? 0 : 1,
    payload: { profileName, result },
    rendered,
    summary: shorten(result?.content ?? "Task finished."),
    jobTitle: request.title ?? "CMA Task"
  };
}

function createTrackedProgress(job, options = {}) {
  const logFile = options.logFile ?? createJobLogFile(job.workspaceRoot, job.id, job.title);
  return {
    logFile,
    progress: createProgressReporter({
      stderr: Boolean(options.stderr),
      logFile,
      onEvent: createJobProgressUpdater(job.workspaceRoot, job.id)
    })
  };
}

async function runForegroundCommand(job, runner, options = {}) {
  const { logFile, progress } = createTrackedProgress(job, {
    logFile: options.logFile,
    stderr: !options.json
  });
  const execution = await runTrackedJob(job, () => runner(progress), { logFile });
  outputResult(options.json ? execution.payload : execution.rendered, options.json);
  if (execution.exitStatus !== 0) process.exitCode = execution.exitStatus;
  return execution;
}

function spawnDetachedTaskWorker(cwd, jobId) {
  const scriptPath = path.join(ROOT_DIR, "scripts", "cma-companion.mjs");
  const child = spawn(process.execPath, [scriptPath, "task-worker", "--cwd", cwd, "--job-id", jobId], {
    cwd,
    env: process.env,
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  child.unref();
  return child;
}

function enqueueBackgroundTask(cwd, job, request) {
  const { logFile } = createTrackedProgress(job);
  appendLogLine(logFile, "Queued for background execution.");

  const child = spawnDetachedTaskWorker(cwd, job.id);
  const queuedRecord = {
    ...job,
    status: "queued",
    phase: "queued",
    pid: child.pid ?? null,
    logFile,
    request
  };
  writeJobFile(job.workspaceRoot, job.id, queuedRecord);
  upsertJob(job.workspaceRoot, queuedRecord);

  return {
    payload: { jobId: job.id, status: "queued", title: job.title, summary: job.summary, logFile }
  };
}

async function handleTask(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["profile", "model", "cwd", "max-turns"],
    booleanOptions: ["json", "write", "background", "wait"],
    aliasMap: { m: "model", p: "profile" }
  });

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const prompt = positionals.join(" ");
  if (!prompt) throw new Error("Provide a prompt for the task.");

  const write = Boolean(options.write);
  const maxTurns = options["max-turns"] ? Number(options["max-turns"]) : undefined;
  const title = "CMA Task";

  const job = createJobRecord({
    id: generateJobId("task"),
    kind: "task",
    kindLabel: "task",
    title,
    workspaceRoot,
    jobClass: "task",
    summary: shorten(prompt),
    write
  });

  const request = {
    cwd,
    profileName: options.profile ?? null,
    model: options.model ?? null,
    prompt,
    write,
    maxTurns,
    title
  };

  if (options.background) {
    const { payload } = enqueueBackgroundTask(cwd, job, request);
    outputCommandResult(payload, renderQueuedTaskLaunch(payload), options.json);
    return;
  }

  await runForegroundCommand(
    job,
    (progress) => executeTaskRun({ ...request, onProgress: progress }),
    { json: options.json }
  );
}

async function handleTaskWorker(argv) {
  const { options } = parseCommandInput(argv, {
    valueOptions: ["cwd", "job-id"]
  });

  if (!options["job-id"]) throw new Error("Missing required --job-id for task-worker.");

  const cwd = resolveCommandCwd(options);
  const workspaceRoot = resolveWorkspaceRoot(cwd);
  const storedJob = readStoredJob(workspaceRoot, options["job-id"]);
  if (!storedJob) throw new Error(`No stored job found for ${options["job-id"]}.`);

  const request = storedJob.request;
  if (!request) throw new Error(`Stored job ${options["job-id"]} is missing its task request payload.`);

  const { logFile, progress } = createTrackedProgress(
    { ...storedJob, workspaceRoot },
    { logFile: storedJob.logFile ?? null }
  );

  await runTrackedJob(
    { ...storedJob, workspaceRoot, logFile },
    () => executeTaskRun({ ...request, onProgress: progress }),
    { logFile }
  );
}

// --- Status ---

function handleStatus(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";

  if (reference) {
    const snapshot = buildSingleJobSnapshot(cwd, reference);
    outputCommandResult(snapshot, renderJobStatusReport(snapshot.job), options.json);
    return;
  }

  const report = buildStatusSnapshot(cwd);
  outputResult(options.json ? report : renderStatusReport(report), options.json);
}

// --- Result ---

function handleResult(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveResultJob(cwd, reference);
  const storedJob = readStoredJob(workspaceRoot, job.id);
  outputCommandResult({ job, storedJob }, renderStoredJobResult(job, storedJob), options.json);
}

// --- Cancel ---

function handleCancel(argv) {
  const { options, positionals } = parseCommandInput(argv, {
    valueOptions: ["cwd"],
    booleanOptions: ["json"]
  });

  const cwd = resolveCommandCwd(options);
  const reference = positionals[0] ?? "";
  const { workspaceRoot, job } = resolveCancelableJob(cwd, reference);
  const existing = readStoredJob(workspaceRoot, job.id) ?? {};

  terminateProcessTree(job.pid ?? Number.NaN);
  appendLogLine(job.logFile, "Cancelled by user.");

  const completedAt = nowIso();
  writeJobFile(workspaceRoot, job.id, {
    ...existing,
    ...job,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    completedAt,
    errorMessage: "Cancelled by user."
  });
  upsertJob(workspaceRoot, {
    id: job.id,
    status: "cancelled",
    phase: "cancelled",
    pid: null,
    errorMessage: "Cancelled by user.",
    completedAt
  });

  outputCommandResult(
    { jobId: job.id, status: "cancelled" },
    renderCancelReport({ id: job.id, title: job.title }),
    options.json
  );
}

// --- Main ---

async function main() {
  const [subcommand, ...argv] = process.argv.slice(2);
  if (!subcommand || subcommand === "help" || subcommand === "--help") {
    printUsage();
    return;
  }

  switch (subcommand) {
    case "setup": {
      const result = handleSetup(argv);
      if (result?.asyncTest) {
        await handleSetupTest(result.name, result.asJson);
      }
      break;
    }
    case "task":
      await handleTask(argv);
      break;
    case "task-worker":
      await handleTaskWorker(argv);
      break;
    case "status":
      handleStatus(argv);
      break;
    case "result":
      handleResult(argv);
      break;
    case "cancel":
      handleCancel(argv);
      break;
    default:
      throw new Error(`Unknown subcommand: ${subcommand}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
