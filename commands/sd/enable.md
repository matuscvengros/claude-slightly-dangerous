---
name: enable
description: 
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

Slightly Dangerous mode: auto-approve local operations, deny git. Follow these steps exactly.

Step 1: Get the project directory.

```bash
pwd
```

Step 2: Read the existing settings file if it exists.

```bash
cat .claude/settings.local.json 2>/dev/null || echo '{}'
```

Step 3: Now update `.claude/settings.local.json`. Parse the existing JSON from step 2. Replace ONLY the `permissions` key with the values below, preserving all other keys (hooks, plugins, etc.). Create the `.claude/` directory if needed.

Use the project directory from step 1 as PROJECT_DIR in the paths below.

Set `permissions.allow` to:
- `Read(*)`
- `Bash(*)`
- `Write(PROJECT_DIR/**)`
- `Edit(PROJECT_DIR/**)`
- `Glob(*)`
- `Grep(*)`
- `Agent(*)`
- `WebFetch(*)`
- `WebSearch(*)`
- `NotebookEdit(PROJECT_DIR/**)`

Set `permissions.deny` to:
- `Bash(rm -rf /)`
- `Bash(rm -rf ~)`
- `Bash(rm -rf /*)`
- `Bash(sudo:*)`
- `Read(./.env)`
- `Read(./.env.*)`
- `Read(./secrets/**)`
- `Write(./.env)`
- `Write(./.env.*)`
- `Write(./secrets/**)`
- `Edit(./.env)`
- `Edit(./.env.*)`
- `Edit(./secrets/**)`
- `Bash(git:*)`
- `Bash(gh:*)`

Write the result as formatted JSON to `.claude/settings.local.json`.

Step 4: Confirm by printing:

```
Slightly Dangerous mode enabled.
- All local operations auto-approved
- Write/Edit scoped to: PROJECT_DIR
- Git operations: DENIED (use /sd:enable-with-git to allow)
```
