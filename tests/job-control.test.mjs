// tests/job-control.test.mjs
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { createTempDir, removeTempDir } from "./helpers.mjs";
import { upsertJob } from "../plugins/cma/scripts/lib/state.mjs";
import {
  buildStatusSnapshot,
  buildSingleJobSnapshot,
  resolveResultJob,
  resolveCancelableJob,
  sortJobsNewestFirst
} from "../plugins/cma/scripts/lib/job-control.mjs";

let tmpDir;

beforeEach(() => {
  tmpDir = createTempDir();
  process.env.CLAUDE_PLUGIN_DATA = tmpDir;
});

afterEach(() => {
  delete process.env.CLAUDE_PLUGIN_DATA;
  removeTempDir(tmpDir);
});

describe("sortJobsNewestFirst", () => {
  it("sorts by updatedAt descending", () => {
    const sorted = sortJobsNewestFirst([
      { id: "a", updatedAt: "2026-01-01T00:00:00Z" },
      { id: "b", updatedAt: "2026-01-02T00:00:00Z" }
    ]);
    assert.strictEqual(sorted[0].id, "b");
  });
});

describe("buildStatusSnapshot", () => {
  it("returns empty state when no jobs", () => {
    const snapshot = buildStatusSnapshot(tmpDir);
    assert.deepStrictEqual(snapshot.running, []);
    assert.strictEqual(snapshot.latestFinished, null);
  });

  it("separates running and finished jobs", () => {
    upsertJob(tmpDir, { id: "j1", status: "running", phase: "starting" });
    upsertJob(tmpDir, { id: "j2", status: "completed", phase: "done" });
    const snapshot = buildStatusSnapshot(tmpDir);
    assert.strictEqual(snapshot.running.length, 1);
    assert.strictEqual(snapshot.running[0].id, "j1");
    assert.strictEqual(snapshot.latestFinished.id, "j2");
  });
});

describe("buildSingleJobSnapshot", () => {
  it("returns job by id", () => {
    upsertJob(tmpDir, { id: "j1", status: "running" });
    const snapshot = buildSingleJobSnapshot(tmpDir, "j1");
    assert.strictEqual(snapshot.job.id, "j1");
  });

  it("throws on unknown job", () => {
    assert.throws(
      () => buildSingleJobSnapshot(tmpDir, "nope"),
      /No job found/
    );
  });
});

describe("resolveResultJob", () => {
  it("returns completed job", () => {
    upsertJob(tmpDir, { id: "j1", status: "completed" });
    const { job } = resolveResultJob(tmpDir, "j1");
    assert.strictEqual(job.id, "j1");
  });

  it("throws if job is still running", () => {
    upsertJob(tmpDir, { id: "j1", status: "running" });
    assert.throws(
      () => resolveResultJob(tmpDir, "j1"),
      /still running/
    );
  });
});

describe("resolveCancelableJob", () => {
  it("returns active job", () => {
    upsertJob(tmpDir, { id: "j1", status: "running" });
    const { job } = resolveCancelableJob(tmpDir, "j1");
    assert.strictEqual(job.id, "j1");
  });

  it("auto-selects single active job when no reference", () => {
    upsertJob(tmpDir, { id: "j1", status: "running" });
    const { job } = resolveCancelableJob(tmpDir, "");
    assert.strictEqual(job.id, "j1");
  });

  it("throws when no active jobs", () => {
    assert.throws(
      () => resolveCancelableJob(tmpDir, ""),
      /No active/
    );
  });
});
