// plugins/cma/scripts/lib/cma-client.mjs

const WRITE_TOOLS = ["Write", "Edit", "NotebookEdit"];

export function createExecuteTask(queryFn) {
  return async function executeTask(request) {
    const { profileName, profile, cwd, prompt, model,
            permissionMode, maxTurns, write, abortController,
            onProgress } = request;

    const env = { ...(profile.env ?? {}) };
    const resolvedModel = model ?? profile.model ?? undefined;
    const resolvedPermissionMode = permissionMode ?? profile.permissionMode ?? undefined;
    const disallowedTools = write ? [] : WRITE_TOOLS;

    let result = null;

    for await (const message of queryFn({
      prompt,
      options: {
        cwd,
        env,
        model: resolvedModel,
        permissionMode: resolvedPermissionMode ?? "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        maxTurns: maxTurns ?? 30,
        disallowedTools,
        abortController: abortController ?? undefined,
      },
    })) {
      if (message.type === "system" && message.subtype === "init") {
        onProgress?.({
          message: `Agent started on profile "${profileName}".`,
          phase: "starting"
        });
      }

      if (message.type === "result") {
        result = {
          content: message.result,
          stopReason: message.stop_reason,
          subtype: message.subtype,
          costUsd: message.total_cost_usd ?? null,
          durationMs: message.duration_ms ?? null,
          numTurns: message.num_turns ?? null,
          usage: message.usage ?? null,
        };
      }
    }

    return result;
  };
}

// Default export uses the real Agent SDK.
// Lazy-loaded to avoid import errors when SDK isn't installed (e.g., in tests).
let _defaultExecuteTask = null;

export async function executeTask(request) {
  if (!_defaultExecuteTask) {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");
    _defaultExecuteTask = createExecuteTask(query);
  }
  return _defaultExecuteTask(request);
}
