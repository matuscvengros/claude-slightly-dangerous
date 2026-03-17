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

Step 1: Get the project directory and the user's home directory.

```bash
echo "PROJECT_DIR=$(pwd)" && echo "HOME_DIR=$HOME"
```

Step 2: Read the existing settings file if it exists. Use the `Read` tool on `.claude/settings.local.json`. If it doesn't exist, treat it as `{}`.

Step 3: Now update `.claude/settings.local.json`. Parse the existing JSON from step 2. Create the `.claude/` directory if needed.

Use PROJECT_DIR and HOME_DIR from step 1 in the paths below.

**For the `permissions` key:** replace it entirely with the values below.

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
- `Bash(rm -rf ~/)`
- `Bash(rm -rf ~/*)`
- `Bash(rm -rf .)`
- `Bash(rm -rf ..)`
- `Bash(rm -fr /)`
- `Bash(rm -fr ~)`
- `Bash(rm -fr /*)`
- `Bash(sudo:*)`
- `Bash(su:*)`
- `Bash(pkexec:*)`
- `Bash(doas:*)`
- `Bash(mkfs:*)`
- `Bash(wipefs:*)`
- `Bash(fdisk:*)`
- `Bash(parted:*)`
- `Bash(shutdown:*)`
- `Bash(reboot:*)`
- `Read(./.env)`
- `Read(./.env.*)`
- `Read(./secrets/**)`
- `Write(./.env)`
- `Write(./.env.*)`
- `Write(./secrets/**)`
- `Edit(./.env)`
- `Edit(./.env.*)`
- `Edit(./secrets/**)`
- `Bash(cat .env)`
- `Bash(cat .env:*)`
- `Bash(cat ./.env)`
- `Bash(cat ./.env:*)`
- `Bash(cat secrets/:*)`
- `Bash(cat ./secrets/:*)`
- `Bash(cp .env:*)`
- `Bash(cp ./.env:*)`
- `Bash(cp secrets/:*)`
- `Bash(cp ./secrets/:*)`
- `Bash(mv .env:*)`
- `Bash(mv ./.env:*)`
- `Bash(mv secrets/:*)`
- `Bash(mv ./secrets/:*)`
- `Bash(ln -s /etc:*)`
- `Bash(ln -s /root:*)`
- `Bash(ln -s ~/.ssh:*)`
- `Bash(ln -s ~/.gnupg:*)`
- `Bash(git:*)`
- `Bash(gh:*)`

**For the `hooks` key:** do NOT replace it entirely. Instead, merge the CSD hook into the existing hooks. If `hooks.PreToolUse` already exists as an array, first remove any entry whose command contains `csd-bash-guard`, then append the new entry below. If `hooks.PreToolUse` does not exist, create it. Preserve all other hook events (PostToolUse, etc.) and all other PreToolUse entries.

Append this entry to `hooks.PreToolUse`:

```json
{
  "matcher": "Bash",
  "hooks": [
    {
      "type": "command",
      "command": "node 'HOME_DIR/.claude/hooks/csd-bash-guard.js'"
    }
  ]
}
```

Replace HOME_DIR in the hook command with the actual home directory path from step 1.

Write the result as formatted JSON to `.claude/settings.local.json`.

Step 4: Confirm by printing:

```
Slightly Dangerous mode enabled.
- All local operations auto-approved
- Write/Edit scoped to: PROJECT_DIR
- Git operations: DENIED (use /csd:enable-with-git to allow)
- Bash guard hook: ACTIVE

⚠ Security model: This is a UX guardrail, not a sandbox.
  Bash(*) allows arbitrary command execution — deny rules block
  common dangerous patterns but cannot be exhaustive.
  Do not use this in place of a proper sandbox for untrusted code.
```
