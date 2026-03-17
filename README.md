# Claude: Slightly Dangerous

[![CI](https://github.com/matuscvengros/claude-slightly-dangerous/actions/workflows/ci.yml/badge.svg)](https://github.com/matuscvengros/claude-slightly-dangerous/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/claude-slightly-dangerous)](https://www.npmjs.com/package/claude-slightly-dangerous)
[![npm downloads](https://img.shields.io/npm/dm/claude-slightly-dangerous)](https://www.npmjs.com/package/claude-slightly-dangerous)
[![license](https://img.shields.io/npm/l/claude-slightly-dangerous)](./LICENSE)

A lot of users like to run with `--dangerously-skip-permissions`; that is insane — unless you're sandboxing. This is a controlled alternative that tries to create as frictionless of a workflow as possible, while preserving some degree of sanity.

The basic idea is that all operations *within the project directory* are allowed; anything else requires approval.

## Install

Requires Node.js 18+.

```bash
npx claude-slightly-dangerous@latest install
```

This installs slash commands and the bash guard hook script to `~/.claude/`. Nothing is activated yet — the files are just placed where Claude Code can find them.

**What gets installed:**

| Component | Location | Purpose |
|-----------|----------|---------|
| `/csd:enable` | `~/.claude/commands/csd/` | Slash command — auto-approve local ops, deny git |
| `/csd:enable-with-git` | `~/.claude/commands/csd/` | Slash command — auto-approve local ops + git |
| `/csd:disable` | `~/.claude/commands/csd/` | Slash command — reset to default permissions |
| `csd-bash-guard.js` | `~/.claude/hooks/` | Hook script — inspects bash commands for dangerous patterns |

## Usage

In any Claude Code session, run `/csd:enable` to activate. Each project needs its own activation — enabling in project A does not affect project B.

| Command | What it does |
|---------|-------------|
| `/csd:enable` | Auto-approve all local operations. Write/Edit scoped to project directory. Git operations denied. |
| `/csd:enable-with-git` | Same as above, but also allows git and gh commands (destructive git ops still denied). |
| `/csd:disable` | Remove CSD permissions and hook. Restores defaults. |

### How it works

When you run `/csd:enable`, Claude writes two keys to `.claude/settings.local.json` in your project directory:

1. **`permissions`** — allow/deny lists that Claude Code's permission system enforces for the session
2. **`hooks.PreToolUse`** — registers the bash guard hook to inspect every bash command before execution

Both are **per-project** and only active after you run the enable command. `/csd:disable` removes both keys (preserving any other settings or hooks you may have configured).

### What gets allowed

- `Read(*)`, `Bash(*)`, `Glob(*)`, `Grep(*)`, `Agent(*)`, `WebFetch(*)`, `WebSearch(*)`
- `Write(<project>/**)`, `Edit(<project>/**)`, `NotebookEdit(<project>/**)`

### What stays denied

**Filesystem destruction** — `rm -rf` and `rm -fr` targeting `/`, `~`, `/*`, `~/`, `~/*`, `.`, `..`

**Privilege escalation** — `sudo`, `su`, `pkexec`, `doas`

**Disk/system commands** — `mkfs`, `wipefs`, `fdisk`, `parted`, `shutdown`, `reboot`

**Env/secrets protection** — `Read/Write/Edit` on `.env`, `.env.*`, `secrets/**` plus bash-level `cat`, `cp`, `mv` on those paths

**Symlink attacks** — `ln -s` to `/etc`, `/root`, `~/.ssh`, `~/.gnupg`

**Git** — `git:*`, `gh:*` (unless using `/csd:enable-with-git`, which still denies `push --force`, `push -f`, `reset --hard`, `clean -f`, `gh repo delete`)

### Bash guard hook

The static deny list above blocks commands by prefix matching. The bash guard hook adds a deeper inspection layer that:

- **Splits piped/chained commands** (`|`, `&&`, `||`, `;`) and checks each segment independently
- **Inspects command substitutions** — `$(...)`, backticks, and `<(...)` process substitutions
- **Detects privilege escalation** in any position (e.g., `echo test | sudo tee /etc/hosts`)
- **Scans the full command** for `.env` and `secrets/` references regardless of position
- **Handles quoted strings** correctly (e.g., `python -c "open('.env').read()"`)
- **Blocks symlink creation** to sensitive system paths

The hook is only active when CSD mode is enabled via `/csd:enable`. It does not interfere with normal Claude Code operation when CSD is not enabled.

### Security model

> **This is a UX guardrail, not a security sandbox.**
>
> `Bash(*)` allows arbitrary command execution. The deny list and bash guard hook block common dangerous patterns but cannot be exhaustive — there are always alternative ways to express destructive operations via bash. This tool reduces friction from permission prompts for routine development workflows. If you are running untrusted code or need actual isolation, use a proper sandbox (Docker, VM, etc.).

## Uninstall

```bash
npx claude-slightly-dangerous uninstall
```

Removes CSD command and hook files from `~/.claude/`.

**Note:** If you enabled CSD in any projects, run `/csd:disable` in each project first to clean up `.claude/settings.local.json`. Otherwise those projects will have orphaned settings pointing to a deleted hook script.

## Development

```bash
npm test
```

Runs unit and integration tests using Node's built-in test runner. Tests cover CLI install/uninstall, command file structure, permission correctness, cross-file consistency, and bash guard hook behavior (safe commands, privilege escalation, pipe inspection, command substitution, .env/secrets protection, symlink attacks, false positive avoidance, edge cases).
