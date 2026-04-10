import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createTempDir, removeTempDir } from "./helpers.mjs";

import {
  resolveStateDir,
  loadState,
  saveState,
  updateState,
  generateJobId,
  upsertJob,
  listJobs,
  writeJobFile,
  readJobFile,
  resolveJobFile
} from "../plugins/cma/scripts/lib/state.mjs";

let tmpDir;

beforeEach(() => {
  tmpDir = createTempDir();
  process.env.CLAUDE_PLUGIN_DATA = tmpDir;
});

afterEach(() => {
  delete process.env.CLAUDE_PLUGIN_DATA;
  removeTempDir(tmpDir);
});

describe("resolveStateDir", () => {
  it("returns a path under CLAUDE_PLUGIN_DATA", () => {
    const dir = resolveStateDir(tmpDir);
    assert.ok(dir.startsWith(path.join(tmpDir, "state")));
  });
});

describe("loadState / saveState", () => {
  it("returns default state when no file exists", () => {
    const state = loadState(tmpDir);
    assert.strictEqual(state.version, 1);
    assert.deepStrictEqual(state.jobs, []);
  });

  it("round-trips state", () => {
    const state = loadState(tmpDir);
    state.jobs.push({ id: "job-1", status: "running" });
    saveState(tmpDir, state);
    const loaded = loadState(tmpDir);
    assert.strictEqual(loaded.jobs.length, 1);
    assert.strictEqual(loaded.jobs[0].id, "job-1");
  });
});

describe("generateJobId", () => {
  it("generates unique ids with prefix", () => {
    const id1 = generateJobId("task");
    const id2 = generateJobId("task");
    assert.ok(id1.startsWith("task-"));
    assert.notStrictEqual(id1, id2);
  });
});

describe("upsertJob", () => {
  it("inserts a new job", () => {
    upsertJob(tmpDir, { id: "job-1", status: "running", title: "Test" });
    const jobs = listJobs(tmpDir);
    assert.strictEqual(jobs.length, 1);
    assert.strictEqual(jobs[0].id, "job-1");
    assert.ok(jobs[0].createdAt);
  });

  it("updates an existing job", () => {
    upsertJob(tmpDir, { id: "job-1", status: "running" });
    upsertJob(tmpDir, { id: "job-1", status: "completed" });
    const jobs = listJobs(tmpDir);
    assert.strictEqual(jobs.length, 1);
    assert.strictEqual(jobs[0].status, "completed");
  });
});

describe("writeJobFile / readJobFile", () => {
  it("writes and reads job data", () => {
    writeJobFile(tmpDir, "job-1", { result: "hello" });
    const data = readJobFile(resolveJobFile(tmpDir, "job-1"));
    assert.strictEqual(data.result, "hello");
  });
});

describe("updateState", () => {
  it("applies a mutation and saves", () => {
    updateState(tmpDir, (state) => {
      state.jobs.push({ id: "job-x", status: "queued" });
    });
    const jobs = listJobs(tmpDir);
    assert.strictEqual(jobs[0].id, "job-x");
  });
});
