---
name: disable
description:
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

Reset permissions to defaults. Follow these steps exactly.

Step 1: Read the existing settings file using the `Read` tool on `.claude/settings.local.json`. If the file doesn't exist, print "No settings to reset." and stop.

Step 2: Parse the JSON from step 1 and make these changes:

- Remove the `permissions` key entirely.
- From `hooks.PreToolUse`, remove only the entry whose command contains `csd-bash-guard`. Keep all other PreToolUse entries and all other hook events (PostToolUse, etc.) intact.
- If `hooks.PreToolUse` becomes an empty array after removal, delete the `PreToolUse` key.
- If `hooks` becomes an empty object after that, delete the `hooks` key.
- Preserve all other top-level keys.

If the resulting object is empty (`{}`), delete the file:
```bash
rm .claude/settings.local.json
```

Otherwise, write the remaining JSON (formatted) back to `.claude/settings.local.json`.

Step 3: Confirm by printing:

```
Slightly Dangerous mode disabled. Default permissions restored.
```
