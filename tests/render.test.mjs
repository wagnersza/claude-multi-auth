// tests/render.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  renderTaskResult,
  renderStatusReport,
  renderJobStatusReport,
  renderStoredJobResult,
  renderCancelReport,
  renderSetupReport,
  renderQueuedTaskLaunch
} from "../plugins/cma/scripts/lib/render.mjs";

describe("renderTaskResult", () => {
  it("renders successful result", () => {
    const output = renderTaskResult({
      content: "The auth flow uses JWT tokens.",
      subtype: "success",
      costUsd: 0.05,
      numTurns: 3,
      durationMs: 1200
    }, { profileName: "bedrock", title: "CMA Task" });
    assert.ok(output.includes("The auth flow uses JWT tokens."));
    assert.ok(output.includes("$0.05"));
    assert.ok(output.includes("3 turns"));
  });

  it("renders max_turns warning", () => {
    const output = renderTaskResult({
      content: "Partial work.",
      subtype: "error_max_turns",
      costUsd: 0.10,
      numTurns: 30
    }, { profileName: "test", title: "CMA Task" });
    assert.ok(output.includes("turn limit"));
    assert.ok(output.includes("Partial work."));
  });

  it("renders null result", () => {
    const output = renderTaskResult(null, { profileName: "test", title: "CMA Task" });
    assert.ok(output.includes("no output"));
  });
});

describe("renderStatusReport", () => {
  it("renders empty state", () => {
    const output = renderStatusReport({ running: [], latestFinished: null, recent: [] });
    assert.ok(output.includes("No jobs"));
  });

  it("renders running jobs", () => {
    const output = renderStatusReport({
      running: [{ id: "task-1", status: "running", phase: "starting", kindLabel: "task", elapsed: "5s" }],
      latestFinished: null,
      recent: []
    });
    assert.ok(output.includes("task-1"));
    assert.ok(output.includes("running"));
  });
});

describe("renderJobStatusReport", () => {
  it("renders running job with cancel action", () => {
    const output = renderJobStatusReport({ id: "task-1", status: "running", phase: "starting", elapsed: "3s" });
    assert.ok(output.includes("task-1"));
    assert.ok(output.includes("running"));
    assert.ok(output.includes("/cma:cancel task-1"));
    assert.ok(!output.includes("/cma:result"));
  });

  it("renders finished job with result action", () => {
    const output = renderJobStatusReport({ id: "task-1", status: "completed", duration: "12s" });
    assert.ok(output.includes("/cma:result task-1"));
    assert.ok(!output.includes("/cma:cancel"));
  });
});

describe("renderStoredJobResult", () => {
  it("returns stored rendered output directly", () => {
    const output = renderStoredJobResult({ id: "j1", status: "completed" }, { rendered: "# Result\n\nDone." });
    assert.ok(output.includes("# Result"));
  });

  it("renders fallback when no stored rendered output", () => {
    const output = renderStoredJobResult({ id: "j1", status: "completed", title: "My Task" }, null);
    assert.ok(output.includes("j1"));
    assert.ok(output.includes("No captured result payload"));
  });
});

describe("renderCancelReport", () => {
  it("renders cancellation", () => {
    const output = renderCancelReport({ id: "task-1", title: "CMA Task" });
    assert.ok(output.includes("Cancelled"));
    assert.ok(output.includes("task-1"));
  });
});

describe("renderQueuedTaskLaunch", () => {
  it("renders launch confirmation", () => {
    const output = renderQueuedTaskLaunch({ title: "CMA Task", jobId: "task-abc123" });
    assert.ok(output.includes("task-abc123"));
    assert.ok(output.includes("/cma:status"));
  });
});

describe("renderSetupReport", () => {
  it("renders profile list", () => {
    const output = renderSetupReport({
      profiles: [
        { name: "bedrock", isDefault: true, model: "sonnet", envKeyCount: 5 },
        { name: "direct", isDefault: false, model: "opus", envKeyCount: 1 }
      ],
      defaultProfile: "bedrock"
    });
    assert.ok(output.includes("bedrock"));
    assert.ok(output.includes("default"));
    assert.ok(output.includes("direct"));
  });
});
