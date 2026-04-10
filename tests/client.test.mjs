// tests/client.test.mjs
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// We test executeTask by providing a mock query function via dependency injection.
import { createExecuteTask } from "../plugins/cma/scripts/lib/cma-client.mjs";

function createMockQuery(messages) {
  return async function* mockQuery(_request) {
    for (const msg of messages) {
      yield msg;
    }
  };
}

describe("executeTask", () => {
  it("returns result on successful completion", async () => {
    const executeTask = createExecuteTask(createMockQuery([
      { type: "system", subtype: "init", session_id: "sess-1" },
      { type: "result", subtype: "success", result: "Task done.", stop_reason: "end_turn", total_cost_usd: 0.05, duration_ms: 1200, num_turns: 3, usage: {} }
    ]));

    const result = await executeTask({
      profileName: "test",
      profile: { env: { ANTHROPIC_API_KEY: "sk-123" } },
      cwd: "/tmp",
      prompt: "Do something"
    });

    assert.strictEqual(result.content, "Task done.");
    assert.strictEqual(result.subtype, "success");
    assert.strictEqual(result.costUsd, 0.05);
    assert.strictEqual(result.numTurns, 3);
  });

  it("returns error subtype on max turns", async () => {
    const executeTask = createExecuteTask(createMockQuery([
      { type: "system", subtype: "init", session_id: "sess-1" },
      { type: "result", subtype: "error_max_turns", result: "Partial work.", stop_reason: null, total_cost_usd: 0.10, duration_ms: 5000, num_turns: 30, usage: {} }
    ]));

    const result = await executeTask({
      profileName: "test",
      profile: { env: {} },
      cwd: "/tmp",
      prompt: "Big task"
    });

    assert.strictEqual(result.subtype, "error_max_turns");
    assert.strictEqual(result.content, "Partial work.");
  });

  it("returns null when no result message", async () => {
    const executeTask = createExecuteTask(createMockQuery([
      { type: "system", subtype: "init", session_id: "sess-1" }
    ]));

    const result = await executeTask({
      profileName: "test",
      profile: { env: {} },
      cwd: "/tmp",
      prompt: "Something"
    });

    assert.strictEqual(result, null);
  });

  it("disallows write tools by default", async () => {
    let capturedOptions = null;
    const mockQuery = async function* (request) {
      capturedOptions = request.options;
      yield { type: "result", subtype: "success", result: "Done." };
    };

    const executeTask = createExecuteTask(mockQuery);
    await executeTask({
      profileName: "test",
      profile: { env: {} },
      cwd: "/tmp",
      prompt: "Read stuff"
    });

    assert.deepStrictEqual(capturedOptions.disallowedTools, ["Write", "Edit", "NotebookEdit"]);
  });

  it("allows write tools when write=true", async () => {
    let capturedOptions = null;
    const mockQuery = async function* (request) {
      capturedOptions = request.options;
      yield { type: "result", subtype: "success", result: "Done." };
    };

    const executeTask = createExecuteTask(mockQuery);
    await executeTask({
      profileName: "test",
      profile: { env: {} },
      cwd: "/tmp",
      prompt: "Edit files",
      write: true
    });

    assert.deepStrictEqual(capturedOptions.disallowedTools, []);
  });

  it("calls onProgress on init message", async () => {
    const events = [];
    const executeTask = createExecuteTask(createMockQuery([
      { type: "system", subtype: "init", session_id: "sess-1" },
      { type: "result", subtype: "success", result: "Done." }
    ]));

    await executeTask({
      profileName: "bedrock",
      profile: { env: {} },
      cwd: "/tmp",
      prompt: "Go",
      onProgress: (e) => events.push(e)
    });

    assert.strictEqual(events.length, 1);
    assert.ok(events[0].message.includes("bedrock"));
  });

  it("passes env and model from profile", async () => {
    let capturedOptions = null;
    const mockQuery = async function* (request) {
      capturedOptions = request.options;
      yield { type: "result", subtype: "success", result: "Done." };
    };

    const executeTask = createExecuteTask(mockQuery);
    await executeTask({
      profileName: "test",
      profile: { env: { ANTHROPIC_API_KEY: "sk-123" }, model: "sonnet" },
      cwd: "/tmp",
      prompt: "Go"
    });

    assert.deepStrictEqual(capturedOptions.env, { ANTHROPIC_API_KEY: "sk-123" });
    assert.strictEqual(capturedOptions.model, "sonnet");
  });

  it("forwards abortController to query options", async () => {
    let capturedOptions = null;
    const mockQuery = async function* (request) {
      capturedOptions = request.options;
      yield { type: "result", subtype: "success", result: "Done." };
    };

    const controller = new AbortController();
    const executeTask = createExecuteTask(mockQuery);
    await executeTask({
      profileName: "test",
      profile: { env: {} },
      cwd: "/tmp",
      prompt: "Go",
      abortController: controller
    });

    assert.strictEqual(capturedOptions.abortController, controller);
  });

  it("overrides profile model with explicit model", async () => {
    let capturedOptions = null;
    const mockQuery = async function* (request) {
      capturedOptions = request.options;
      yield { type: "result", subtype: "success", result: "Done." };
    };

    const executeTask = createExecuteTask(mockQuery);
    await executeTask({
      profileName: "test",
      profile: { env: {}, model: "sonnet" },
      cwd: "/tmp",
      prompt: "Go",
      model: "opus"
    });

    assert.strictEqual(capturedOptions.model, "opus");
  });
});
