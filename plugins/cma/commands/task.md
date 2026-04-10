---
description: Delegate a task to a Claude Code subagent using a specific auth profile
argument-hint: '[--profile <name>] [--model <model>] [--write] [--background] [--max-turns <n>] <prompt>'
context: fork
allowed-tools: Bash(node:*), AskUserQuestion
---

Route this request to the `cma:cma-rescue` subagent.
The final user-visible response must be the subagent's output verbatim.

Raw user request:
$ARGUMENTS

Execution mode:
- If the request includes `--background`, run the subagent in the background.
- If the request includes `--wait`, run the subagent in the foreground.
- If neither flag is present, default to foreground.
- `--background` and `--wait` are execution flags. Do not forward them to `task`.

Operating rules:
- The subagent is a thin forwarder only. It should use one `Bash` call to invoke `node "${CLAUDE_PLUGIN_ROOT}/scripts/cma-companion.mjs" task ...` and return stdout as-is.
- Return the companion stdout verbatim to the user.
- Do not paraphrase, summarize, rewrite, or add commentary.
- Do not ask the subagent to inspect files, monitor progress, poll status, fetch results, cancel jobs, summarize output, or do any follow-up work.
- If the user did not supply a prompt, ask what the subagent should do.
