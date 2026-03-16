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

Step 1: Read the existing settings file.

```bash
cat .claude/settings.local.json 2>/dev/null || echo 'NOFILE'
```

Step 2: If the file doesn't exist (output was "NOFILE"), print "No settings to reset." and stop.

If the file exists, parse the JSON and remove the `permissions` key entirely. Preserve all other keys.

- If the resulting object is empty (`{}`), delete the file:
  ```bash
  rm .claude/settings.local.json
  ```
- Otherwise, write the remaining JSON (formatted) back to `.claude/settings.local.json`.

Step 3: Confirm by printing:

```
Slightly Dangerous mode disabled. Default permissions restored.
```
