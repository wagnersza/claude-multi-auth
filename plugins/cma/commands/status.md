---
description: Show active and recent CMA background tasks for this repository
argument-hint: '[job-id] [--json]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/cma-companion.mjs" status $ARGUMENTS`

If the user did not pass a job ID:
- Render the command output as a compact Markdown table.
- Preserve job ID, status, phase, elapsed/duration, summary, and follow-up commands.

If the user did pass a job ID:
- Present the full command output to the user.
- Do not summarize or condense it.
