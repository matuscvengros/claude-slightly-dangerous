#!/usr/bin/env node
// CSD Bash Guard — PreToolUse hook for Claude Code
// Inspects bash commands (including pipes, subshells, substitutions)
// for dangerous patterns. Receives tool input as JSON on stdin.
// Exits non-zero to block.

"use strict";

class BlockedError extends Error {
  constructor(reason) {
    super(`CSD blocked: ${reason}`);
    this.name = "BlockedError";
  }
}

function block(reason) {
  if (require.main === module) {
    process.stderr.write(`CSD blocked: ${reason}\n`);
    process.exit(1);
  }
  throw new BlockedError(reason);
}

// Split a command string on unquoted pipe/chain operators.
// Respects single quotes, double quotes, and escapes.
function splitSegments(cmd) {
  const segments = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let escaped = false;

  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    // Only split on operators when not inside quotes
    if (!inSingle && !inDouble) {
      if (ch === "|" && cmd[i + 1] === "|") {
        segments.push(current);
        current = "";
        i++;
        continue;
      }
      if (ch === "&" && cmd[i + 1] === "&") {
        segments.push(current);
        current = "";
        i++;
        continue;
      }
      if (ch === ";" || ch === "|") {
        segments.push(current);
        current = "";
        continue;
      }
    }

    current += ch;
  }

  segments.push(current);
  return segments.map((s) => s.trim()).filter(Boolean);
}

// Extract content from $(...) and backtick substitutions for inspection
function extractSubstitutions(cmd) {
  const subs = [];

  // $(...) — handle nesting by counting parens
  let i = 0;
  while (i < cmd.length) {
    if (cmd[i] === "$" && cmd[i + 1] === "(") {
      let depth = 1;
      let start = i + 2;
      let j = start;
      while (j < cmd.length && depth > 0) {
        if (cmd[j] === "(") depth++;
        if (cmd[j] === ")") depth--;
        j++;
      }
      if (depth === 0) {
        subs.push(cmd.slice(start, j - 1));
      }
      i = j;
    } else {
      i++;
    }
  }

  // Backtick substitutions
  const backtickRe = /`([^`]*)`/g;
  let m;
  while ((m = backtickRe.exec(cmd)) !== null) {
    subs.push(m[1]);
  }

  // Process substitution <(...)
  const procSubRe = /<\(([^)]*)\)/g;
  while ((m = procSubRe.exec(cmd)) !== null) {
    subs.push(m[1]);
  }

  return subs;
}

function checkSegment(segment) {
  // Privilege escalation
  if (/^(sudo|su|pkexec|doas)\b/.test(segment)) {
    block("privilege escalation detected in command chain");
  }

  // Destructive rm targeting system/parent paths
  // Handles: rm -rf /, rm / -rf, rm --recursive --force /, etc.
  if (/^rm\b/.test(segment)) {
    // Extract what looks like path targets (non-flag arguments)
    const parts = segment.split(/\s+/).slice(1);
    const targets = parts.filter((p) => !p.startsWith("-"));
    const hasRecursive = parts.some(
      (p) =>
        /^-[a-zA-Z]*r/.test(p) ||
        p === "--recursive"
    );
    const dangerousPaths = /^(\/|~\/?|~\/?\*|\.\.|\.|\.\.\/.*)$/;
    for (const target of targets) {
      if (dangerousPaths.test(target) && hasRecursive) {
        block("destructive rm targeting system/parent paths");
      }
      // rm / even without -r is dangerous
      if (/^\/$/.test(target)) {
        block("destructive rm targeting system/parent paths");
      }
    }
  }

  // Disk destruction
  if (/^(mkfs|wipefs|fdisk|parted)\b/.test(segment)) {
    block("disk destruction command detected");
  }
}

function checkFullCommand(cmd) {
  // .env access — match .env as a standalone filename, not as part of a larger word
  // Matches: .env, .env.production, .env.local, '.env', ".env"
  // Does NOT match: .environment, .envs/, .env-parser (hyphenated package names)
  if (/(^|[\s'"/])\.env(\s|['"\/.;|&]|$)/.test(cmd) &&
      !/(^|[\s'"/])\.envs?\//.test(cmd)) {
    block("command references .env file");
  }

  // secrets/ directory access — must be a path component, not part of a word
  // Matches: secrets/foo, ./secrets/, /path/to/secrets/
  // Does NOT match: generate-secrets, my-secrets-lib
  if (/(^|[\s.\/])secrets\//.test(cmd)) {
    block("command references secrets/ directory");
  }

  // Symlinks to sensitive system paths
  if (/ln\s+(-[a-zA-Z]*\s+)*-?s\s+.*(\/etc[\/\s]|\/root[\/\s]|\.ssh[\/\s]|\.gnupg[\/\s]|\/etc$|\/root$|\.ssh$|\.gnupg$)/.test(cmd)) {
    block("symlink to sensitive system path");
  }
}

function main() {
  let input = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    let cmd;
    try {
      const data = JSON.parse(input);
      cmd = data.tool_input?.command;
    } catch {
      process.exit(0);
    }

    if (!cmd) {
      process.exit(0);
    }

    // Check each segment of piped/chained commands
    const segments = splitSegments(cmd);
    for (const segment of segments) {
      checkSegment(segment);
    }

    // Check the full command string for sensitive patterns
    checkFullCommand(cmd);

    // Extract and check command substitutions ($(...), backticks, <(...))
    const subs = extractSubstitutions(cmd);
    for (const sub of subs) {
      const subSegments = splitSegments(sub);
      for (const segment of subSegments) {
        checkSegment(segment);
      }
      checkFullCommand(sub);
    }

    process.exit(0);
  });
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    splitSegments,
    extractSubstitutions,
    checkSegment,
    checkFullCommand,
    block,
    BlockedError,
  };
}
