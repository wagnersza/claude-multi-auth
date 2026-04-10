---
description: Manage auth profiles for multi-auth Claude Code subagents
argument-hint: '[add|remove|test|default|show] [name] [--env KEY=VALUE]'
allowed-tools: Bash(node:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cma-companion.mjs" setup $ARGUMENTS --json
```

If the subcommand is `add` and the user has not provided `--env` flags:
- Use `AskUserQuestion` to ask which environment variables to set.
- Prompt for key-value pairs one at a time.
- Common env vars: ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, CLAUDE_CODE_USE_BEDROCK, CLAUDE_CODE_SKIP_BEDROCK_AUTH, ANTHROPIC_CUSTOM_HEADERS, ANTHROPIC_DEFAULT_SONNET_MODEL, ANTHROPIC_DEFAULT_OPUS_MODEL, ANTHROPIC_DEFAULT_HAIKU_MODEL, CLAUDE_CODE_MAX_OUTPUT_TOKENS.

If the subcommand is `test`:
- Run the test and present the result.
- If authentication fails, suggest checking the env vars with `/cma:setup show <name>`.

Output rules:
- Present the final output to the user.
- For `show`, display the masked profile config.
