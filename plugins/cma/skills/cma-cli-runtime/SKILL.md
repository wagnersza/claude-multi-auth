---
name: cma-cli-runtime
description: Internal helper contract for calling the cma-companion runtime from Claude Code
user-invocable: false
---

# CMA Runtime

Use this skill only inside the `cma:cma-rescue` subagent.

Primary helper:
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/cma-companion.mjs" task "<raw arguments>"`

Execution rules:
- The rescue subagent is a forwarder, not an orchestrator.
- Its only job is to invoke `task` once and return stdout unchanged.
- Do not call `setup`, `status`, `result`, or `cancel`.
- Use `task` for every request.
- Preserve the user's arguments as-is.
- Return stdout exactly as-is.
