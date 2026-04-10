---
description: Show the stored final output for a finished CMA task
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/cma-companion.mjs" result $ARGUMENTS`

Present the full command output to the user. Do not summarize or condense it.
