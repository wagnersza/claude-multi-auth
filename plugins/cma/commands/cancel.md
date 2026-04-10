---
description: Cancel an active background CMA task
argument-hint: '[job-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/cma-companion.mjs" cancel $ARGUMENTS`
