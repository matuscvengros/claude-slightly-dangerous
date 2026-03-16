# Claude Code: Slightly Dangerous

[![Build](https://github.com/matuscvengros/claude-slightly-dangerous/actions/workflows/ci.yml/badge.svg)](https://github.com/matuscvengros/claude-slightly-dangerous/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/claude-slightly-dangerous)](https://www.npmjs.com/package/claude-slightly-dangerous)
[![npm downloads](https://img.shields.io/npm/dm/claude-slightly-dangerous)](https://www.npmjs.com/package/claude-slightly-dangerous)
[![license](https://img.shields.io/npm/l/claude-slightly-dangerous)](./LICENSE)

A lot of users like to run with `--dangerously-skip-permissions`; that is insane -- unless you're sandboxing. This is an attempt for a simple fix that tries to create as frictionless of a workflow as possible, while preserving some degree of sanity. It's a controlled alternative to Claude's in-built optional flag to bypass all permissions.

The basic idea is that all operations *within the project directory* are allowed; anything else requires approval.

## Install

```bash
npx claude-slightly-dangerous@latest install
```

This copies slash commands to `~/.claude/commands/csd/`.

## Usage

In any Claude Code session:

| Command | What it does |
|---------|-------------|
| `/csd:enable` | Auto-approve all local operations. Write/Edit scoped to project directory. Git operations denied. |
| `/csd:enable-with-git` | Same as above, but also allows git and gh commands. |
| `/csd:disable` | Reset to default permissions (removes the `permissions` key from `.claude/settings.local.json`). |

### What gets allowed

- `Read(*)`, `Bash(*)`, `Glob(*)`, `Grep(*)`, `Agent(*)`, `WebFetch(*)`, `WebSearch(*)`
- `Write(<project>/**)`, `Edit(<project>/**)`, `NotebookEdit(<project>/**)`

### What stays denied

- `Bash(rm -rf /)`, `Bash(rm -rf ~)`, `Bash(rm -rf /*)`, `Bash(sudo:*)`
- `Read/Write/Edit(./.env)`, `Read/Write/Edit(./.env.*)`, `Read/Write/Edit(./secrets/**)`
- `Bash(git:*)`, `Bash(gh:*)` (unless using `/csd:enable-with-git`)

## Uninstall

```bash
npx claude-slightly-dangerous uninstall
```
