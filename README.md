# Claude Multi-Auth Plugin for Claude Code

Run multiple Claude Code subagent instances from a single session, each authenticated with a different auth method (API keys, Bedrock, Vertex, LiteLLM, etc.).

This plugin is for Claude Code users who need to delegate tasks to Claude Code instances that use different authentication backends — without leaving their current session.

## What You Get

- `/cma:setup` to manage named auth profiles with per-profile environment variables
- `/cma:task` to delegate work to a subagent using a specific auth profile
- `/cma:status`, `/cma:result`, and `/cma:cancel` to manage background tasks
- The `cma:cma-rescue` subagent for direct task delegation

## Requirements

- **Node.js 18.18 or later**
- **`@anthropic-ai/claude-agent-sdk`** — installed automatically when Claude Code runs the plugin

## Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add wagnersza/claude-multi-auth
```

Install the plugin:

```bash
/plugin install cma@wagnersza
```

Reload plugins:

```bash
/reload-plugins
```

Then set up your first profile:

```bash
/cma:setup add bedrock --env CLAUDE_CODE_USE_BEDROCK=1 --env AWS_PROFILE=my-aws-profile
```

After install, you should see:

- the slash commands listed below
- the `cma:cma-rescue` subagent in `/agents`

One simple first run is:

```bash
/cma:setup add bedrock --env CLAUDE_CODE_USE_BEDROCK=1 --env AWS_PROFILE=my-aws-profile
/cma:setup test bedrock
/cma:task --profile bedrock summarize the README
```

## Usage

### `/cma:setup`

Manages named auth profiles. Each profile stores environment variables that are injected into the subagent process at runtime.

Profiles are stored in `~/.claude-multi-auth/profiles.json` with `0600` permissions.

#### Add a profile

```bash
/cma:setup add bedrock --env CLAUDE_CODE_USE_BEDROCK=1 --env AWS_PROFILE=my-aws-profile
/cma:setup add vertex --env CLAUDE_CODE_USE_VERTEX=1 --env CLOUD_ML_REGION=us-east5
/cma:setup add litellm --env ANTHROPIC_BASE_URL=http://localhost:4000 --env ANTHROPIC_API_KEY=sk-litellm-key
/cma:setup add direct --env ANTHROPIC_API_KEY=sk-ant-...
```

If you omit `--env`, the command will interactively ask which environment variables to set.

Common environment variables:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Direct API key authentication |
| `ANTHROPIC_BASE_URL` | Custom API endpoint (LiteLLM, proxy) |
| `CLAUDE_CODE_USE_BEDROCK` | Enable AWS Bedrock backend |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH` | Skip Bedrock auth check |
| `AWS_PROFILE` | AWS profile for Bedrock |
| `CLAUDE_CODE_USE_VERTEX` | Enable Google Vertex backend |
| `CLOUD_ML_REGION` | Vertex AI region |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Override default Sonnet model |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Override default Opus model |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Override default Haiku model |

#### Remove a profile

```bash
/cma:setup remove bedrock
```

#### Set default profile

```bash
/cma:setup default bedrock
```

#### Show profile details

```bash
/cma:setup show bedrock
```

Displays the profile configuration with secrets masked.

#### Test a profile

```bash
/cma:setup test bedrock
```

Sends a quick test message to verify the profile authenticates successfully.

#### List all profiles

```bash
/cma:setup
```

### `/cma:task`

Delegates a task to a Claude Code subagent using the specified auth profile.

```bash
/cma:task --profile bedrock explain the authentication flow in this repo
/cma:task --profile vertex --model claude-sonnet-4-6 summarize the main module
/cma:task --profile litellm --write refactor the utils module
/cma:task --profile bedrock --background analyze the test coverage
/cma:task --profile bedrock --max-turns 5 find unused imports
```

Options:

| Flag | Description |
|---|---|
| `--profile <name>`, `-p` | Auth profile to use (uses default if omitted) |
| `--model <model>`, `-m` | Override model for the subagent |
| `--write` | Allow the subagent to use write tools (Edit, Write, Bash) |
| `--background` | Run the task in the background |
| `--max-turns <n>` | Limit the number of agentic turns |

> **Note:** Without `--write`, the subagent runs in read-only mode. It can read files and search the codebase but cannot make changes.

### `/cma:status`

Shows running and recent tasks for the current repository.

```bash
/cma:status
/cma:status task-abc123
```

Use it to:

- check progress on background work
- see the latest completed task
- confirm whether a task is still running

### `/cma:result`

Shows the stored final output for a finished task.

```bash
/cma:result
/cma:result task-abc123
```

### `/cma:cancel`

Cancels an active background task.

```bash
/cma:cancel
/cma:cancel task-abc123
```

## Typical Flows

### Quick Question with a Different Backend

```bash
/cma:task --profile bedrock what does the main function do?
```

### Delegate a Write Task

```bash
/cma:task --profile vertex --write add error handling to the API client
```

### Start Something Long-Running

```bash
/cma:task --profile bedrock --background analyze the entire codebase for security issues
```

Then check in with:

```bash
/cma:status
/cma:result
```

### Use Multiple Backends in One Session

```bash
/cma:setup add bedrock --env CLAUDE_CODE_USE_BEDROCK=1 --env AWS_PROFILE=prod
/cma:setup add vertex --env CLAUDE_CODE_USE_VERTEX=1 --env CLOUD_ML_REGION=us-east5
/cma:setup add direct --env ANTHROPIC_API_KEY=sk-ant-...

/cma:task --profile bedrock review the auth module
/cma:task --profile vertex summarize recent changes
/cma:task --profile direct --write fix the broken test
```

## How It Works

The plugin uses the Claude Agent SDK `query()` function to spawn subagent instances. Each profile's environment variables are injected into the subagent process via the `env` option, allowing different auth backends to coexist in a single Claude Code session.

Background tasks run as detached Node.js processes. Job state is tracked per-workspace in a `.cma/` directory, and a session lifecycle hook automatically cleans up jobs when the Claude Code session ends.

## FAQ

### Where are profiles stored?

Profiles are stored in `~/.claude-multi-auth/profiles.json` with file permissions set to `0600` (owner read/write only). Secrets like API keys are stored in plaintext in this file.

### Can I use this with AWS Bedrock?

Yes. Create a profile with the Bedrock environment variables:

```bash
/cma:setup add bedrock --env CLAUDE_CODE_USE_BEDROCK=1 --env AWS_PROFILE=my-profile
```

Make sure your AWS credentials are configured on the machine.

### Can I use this with Google Vertex AI?

Yes. Create a profile with the Vertex environment variables:

```bash
/cma:setup add vertex --env CLAUDE_CODE_USE_VERTEX=1 --env CLOUD_ML_REGION=us-east5
```

Make sure `gcloud` authentication is configured.

### Can I use this with LiteLLM or a proxy?

Yes. Point the base URL at your proxy:

```bash
/cma:setup add proxy --env ANTHROPIC_BASE_URL=http://localhost:4000 --env ANTHROPIC_API_KEY=sk-proxy-key
```

### What happens if I don't pass `--profile`?

The plugin uses the default profile. Set a default with `/cma:setup default <name>`.

### Can the subagent write files?

Only if you pass `--write`. Without it, write tools (Edit, Write, Bash with write operations) are disallowed.

### How do background tasks work?

Background tasks spawn a detached Node.js process that runs the Agent SDK query independently. Use `/cma:status` to monitor progress, `/cma:result` to get the output, and `/cma:cancel` to stop a running task. Jobs are automatically cleaned up when the Claude Code session ends.
