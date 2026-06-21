# Specter

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Docs](https://img.shields.io/badge/docs-repo-blue)](docs/en/) <br>
[Documentation](docs/en/) · [Issues](https://github.com/abelcondev/spectre/issues) · [中文](README.zh-CN.md)

Specter is a fork of [Kimi Code](https://github.com/MoonshotAI/kimi-code) where the default agent is the **SDD orchestrator**. It is an AI coding agent that runs in your terminal — it can read and edit code, run shell commands, search files, fetch web pages, and choose the next step based on the feedback it receives. Spec-Driven Development (SDD) is native to the workflow.

## Install

Install with the official script. No Node.js required.

> **Note:** Intel Macs (`x86_64`) are not supported. Specter builds native artifacts for Apple Silicon only.

- **macOS (Apple Silicon) or Linux**:

```sh
curl -fsSL https://raw.githubusercontent.com/abelcondev/spectre/main/install.sh | bash
```

Then, run it with a new shell session:

```sh
spectre --version
```

## Quick Start

Open a project and start the interactive UI:

```sh
cd your-project
spectre
```

On first launch, run `/login` inside Specter and choose either OAuth or a compatible API key. After login, try your first task:

```
Take a look at this project and explain its main directories.
```

## Key Features

- **SDD-native orchestrator.** The default agent profile is the Spec-Driven Development orchestrator, with built-in product, design, tech-spec, developer, and auditor subagents.
- **Single-binary distribution.** Install with one command: no Node.js setup, PATH gymnastics, or global module conflicts.
- **Blazing-fast startup.** The TUI is ready in milliseconds, so starting a session never feels heavy.
- **Purpose-built TUI.** A carefully tuned interface, optimized end to end for long, focused agent sessions.
- **Subagents for focused, parallel work.** Dispatch built-in `coder`, `explore`, and `plan` subagents in isolated contexts while keeping the main conversation clean.
- **Lifecycle hooks.** Run local commands at key points to gate risky tool calls, audit decisions, trigger desktop notifications, or connect to your own automation.
- **Editor & IDE integration (ACP).** Drive a Specter session straight from Zed, JetBrains, or any [Agent Client Protocol](https://agentclientprotocol.com/) client with `spectre acp`.

## Use it in your editor (ACP)

Specter speaks the [Agent Client Protocol](https://agentclientprotocol.com/), so ACP-compatible editors and IDEs (Zed, JetBrains, …) can drive a session over stdio. Log in once, then point your editor at the `spectre acp` subcommand — no extra login needed.

For Zed, add this to `~/.config/zed/settings.json`:

```json
{
  "agent_servers": {
    "Specter": {
      "type": "custom",
      "command": "spectre",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

Then open a new conversation in Zed's Agent panel.

## Specter SDD

Specter uses the SDD (Spec-Driven Development) workflow natively. The `spectre sdd` command manages the SDD harness directly in the CLI, without relying on external scripts.

Initialize the SDD harness in the current Git repository:

```sh
spectre sdd init
```

Create a feature worktree (a sibling directory with its own branch):

```sh
spectre sdd worktree create <feature-slug>
```

Move an Issue between state folders and commit the change:

```sh
spectre sdd move <feature-slug> <issue-name> <source-state> <target-state>
```

Example:

```sh
spectre sdd move login-y-dashboard-layout login design/spec-needed design/designing
```

The legacy shell scripts `scripts/sdd-worktree.sh` and `scripts/sdd-move.sh` are no longer installed by `spectre sdd init`; they remain in the repository only as reference/legacy.

## Docs

- [Documentation](docs/en/)
- [SDD Workflow](sdd/README.md)
- [Contributing](CONTRIBUTING.md)

## Develop

Requirements: Node.js ≥ 24.15.0, pnpm 10.33.0.

```sh
git clone https://github.com/abelcondev/spectre.git
cd spectre
pnpm install
```

```sh
pnpm dev:cli    # run the CLI in dev mode
pnpm test       # run tests
pnpm typecheck  # TypeScript check
pnpm lint       # oxlint
pnpm build      # build all packages
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

## Community

- [Issues](https://github.com/abelcondev/spectre/issues)
- For security vulnerabilities, see [SECURITY.md](SECURITY.md).

## Acknowledgements

Our TUI is built on top of [`pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui). We thank the authors of `pi-tui` for their valuable work. Specter is a fork of [Kimi Code](https://github.com/MoonshotAI/kimi-code) by Moonshot AI.

## License

Released under the [MIT License](LICENSE).
