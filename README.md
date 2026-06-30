# Spectre

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE) [![Docs](https://img.shields.io/badge/docs-repo-blue)](docs/en/) <br>
[Documentation](docs/en/) · [Issues](https://github.com/abelcondev/spectre/issues) · [中文](README.zh-CN.md)

Spectre is a fork of [Kimi Code](https://github.com/MoonshotAI/kimi-code) where the default agent is the **SDD orchestrator**. It is an AI coding agent that runs in your terminal — it can read and edit code, run shell commands, search files, fetch web pages, and choose the next step based on the feedback it receives. Spec-Driven Development (SDD) is native to the workflow.

## Install

Install with the official script. No Node.js required.

> **Note:** Intel Macs (`x86_64`) are not supported. Spectre builds native artifacts for Apple Silicon only.

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

On first launch, run `/login` inside Spectre and choose either OAuth or a compatible API key. After login, try your first task:

```
Take a look at this project and explain its main directories.
```

## Key Features

- **SDD-native orchestrator.** The default agent profile is the Spec-Driven Development orchestrator: it drafts proposals for your review, archives approved decisions, and tracks work as Gherkin tasks under `sdd/`.
- **Single-binary distribution.** Install with one command: no Node.js setup, PATH gymnastics, or global module conflicts.
- **Blazing-fast startup.** The TUI is ready in milliseconds, so starting a session never feels heavy.
- **Purpose-built TUI.** A carefully tuned interface, optimized end to end for long, focused agent sessions.
- **Subagents for focused, parallel work.** Dispatch built-in `coder`, `explore`, `plan`, and `stack` (library/version research) subagents in isolated contexts while keeping the main conversation clean.
- **Lifecycle hooks.** Run local commands at key points to gate risky tool calls, audit decisions, trigger desktop notifications, or connect to your own automation.
- **Editor & IDE integration (ACP).** Drive a Spectre session straight from Zed, JetBrains, or any [Agent Client Protocol](https://agentclientprotocol.com/) client with `spectre acp`.

## Use it in your editor (ACP)

Spectre speaks the [Agent Client Protocol](https://agentclientprotocol.com/), so ACP-compatible editors and IDEs (Zed, JetBrains, …) can drive a session over stdio. Log in once, then point your editor at the `spectre acp` subcommand — no extra login needed.

For Zed, add this to `~/.config/zed/settings.json`:

```json
{
  "agent_servers": {
    "Spectre": {
      "type": "custom",
      "command": "spectre",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

Then open a new conversation in Zed's Agent panel.

## Spectre mini-SDD

Spectre includes a lightweight project-memory scaffold inspired by SDD (Spec-Driven Development). Use slash commands inside the TUI to create and verify a minimal `sdd/` folder.

Scaffold the project-memory files in the current working directory:

```sh
/sdd-setup
```

Check that the memory structure is present and that a root `AGENTS.md` exists:

```sh
/sdd-status
```

The scaffold creates:

- `sdd/memory.md` — project overview, current focus, and links to decisions/tasks.
- `sdd/stack.md` — tech stack, versions, testing/security rules.
- `sdd/decisions/` — folder for decision records.
- `sdd/tasks/` — folder for task notes.

`AGENTS.md` stays at the project root and remains human-owned; Spectre reads it for context but does not edit it automatically.

## Docs

- [Documentation](docs/en/)
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

> **Note:** Spectre is developed as a normal TypeScript monorepo with Kimi Code CLI. We do *not* use `/sdd-setup` on this repository. Mini-SDD is a lightweight memory scaffold Spectre offers to its users, not the workflow used to build Spectre itself.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution guide.

## Community

- [Issues](https://github.com/abelcondev/spectre/issues)
- For security vulnerabilities, see [SECURITY.md](SECURITY.md).

## Acknowledgements

Our TUI is built on top of [`pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui). We thank the authors of `pi-tui` for their valuable work. Spectre is a fork of [Kimi Code](https://github.com/MoonshotAI/kimi-code) by Moonshot AI.

## License

Released under the [MIT License](LICENSE).
