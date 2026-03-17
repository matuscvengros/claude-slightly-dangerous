const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const COMMANDS_DIR = path.join(__dirname, "..", "commands", "csd");

function readCommand(name) {
  return fs.readFileSync(path.join(COMMANDS_DIR, name), "utf-8");
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const lines = match[1].split("\n");
  const result = {};
  let currentKey = null;
  let currentList = null;
  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (kvMatch) {
      if (currentKey && currentList) {
        result[currentKey] = currentList;
      }
      currentKey = kvMatch[1];
      const value = kvMatch[2].trim();
      if (value === "") {
        currentList = [];
      } else {
        result[currentKey] = value;
        currentKey = null;
        currentList = null;
      }
    } else if (line.match(/^\s+-\s+(.+)/)) {
      const item = line.match(/^\s+-\s+(.+)/)[1];
      if (currentList) currentList.push(item);
    }
  }
  if (currentKey && currentList) {
    result[currentKey] = currentList;
  }
  return result;
}

function extractPermissions(content, section) {
  const sectionRegex = new RegExp(
    `Set \`permissions\\.${section}\` to:[\\s\\S]*?(?=Set \`permissions|\\*\\*For the \`hooks\`|Write the result|$)`
  );
  const match = content.match(sectionRegex);
  if (!match) return [];
  const items = [];
  const itemRegex = /- `([^`]+)`/g;
  let m;
  while ((m = itemRegex.exec(match[0])) !== null) {
    items.push(m[1]);
  }
  return items;
}

describe("command files exist", () => {
  for (const file of ["enable.md", "enable-with-git.md", "disable.md"]) {
    it(`${file} exists`, () => {
      assert.ok(
        fs.existsSync(path.join(COMMANDS_DIR, file)),
        `${file} should exist`
      );
    });
  }
});

describe("frontmatter", () => {
  for (const file of ["enable.md", "enable-with-git.md", "disable.md"]) {
    it(`${file} has valid frontmatter with required tools`, () => {
      const content = readCommand(file);
      const fm = parseFrontmatter(content);
      assert.ok(fm, `${file} should have frontmatter`);
      assert.ok(fm.name, `${file} should have a name`);
      assert.ok(fm["allowed-tools"], `${file} should have allowed-tools`);
      for (const tool of ["Bash", "Read", "Write", "Edit"]) {
        assert.ok(
          fm["allowed-tools"].includes(tool),
          `${file} should allow ${tool}`
        );
      }
    });
  }
});

describe("enable.md permissions", () => {
  const content = readCommand("enable.md");
  const allow = extractPermissions(content, "allow");
  const deny = extractPermissions(content, "deny");

  it("allows expected tools", () => {
    const expected = [
      "Read(*)", "Bash(*)", "Glob(*)", "Grep(*)",
      "Agent(*)", "WebFetch(*)", "WebSearch(*)",
    ];
    for (const perm of expected) {
      assert.ok(allow.includes(perm), `allow should include ${perm}`);
    }
  });

  it("scopes Write/Edit to PROJECT_DIR", () => {
    assert.ok(allow.some((p) => p.startsWith("Write(PROJECT_DIR")));
    assert.ok(allow.some((p) => p.startsWith("Edit(PROJECT_DIR")));
  });

  it("denies git operations", () => {
    assert.ok(deny.includes("Bash(git:*)"));
    assert.ok(deny.includes("Bash(gh:*)"));
  });

  it("denies privilege escalation commands", () => {
    for (const cmd of ["Bash(sudo:*)", "Bash(su:*)", "Bash(pkexec:*)", "Bash(doas:*)"]) {
      assert.ok(deny.includes(cmd), `should deny ${cmd}`);
    }
  });

  it("denies filesystem destruction patterns", () => {
    for (const cmd of [
      "Bash(rm -rf /)", "Bash(rm -rf ~)", "Bash(rm -rf /*)",
      "Bash(rm -rf .)", "Bash(rm -rf ..)",
      "Bash(rm -fr /)", "Bash(rm -fr ~)", "Bash(rm -fr /*)",
    ]) {
      assert.ok(deny.includes(cmd), `should deny ${cmd}`);
    }
  });

  it("denies disk/system destruction commands", () => {
    for (const cmd of ["Bash(mkfs:*)", "Bash(wipefs:*)", "Bash(fdisk:*)", "Bash(parted:*)"]) {
      assert.ok(deny.includes(cmd), `should deny ${cmd}`);
    }
  });

  it("does not over-block legitimate dev commands", () => {
    for (const cmd of ["Bash(dd:*)", "Bash(chown:*)", "Bash(systemctl:*)", "Bash(launchctl:*)"]) {
      assert.ok(!deny.some((d) => d === cmd), `${cmd} should not be denied`);
    }
  });

  it("protects .env files via Read/Write/Edit tools", () => {
    assert.ok(deny.includes("Read(./.env)"));
    assert.ok(deny.includes("Write(./.env)"));
    assert.ok(deny.includes("Edit(./.env)"));
    assert.ok(deny.includes("Read(./.env.*)"));
  });

  it("protects secrets/ via Read/Write/Edit tools", () => {
    assert.ok(deny.includes("Read(./secrets/**)"));
    assert.ok(deny.includes("Write(./secrets/**)"));
    assert.ok(deny.includes("Edit(./secrets/**)"));
  });

  it("protects .env/secrets via common bash commands", () => {
    assert.ok(deny.includes("Bash(cat .env)"));
    assert.ok(deny.includes("Bash(cat ./.env)"));
    assert.ok(deny.includes("Bash(cp .env:*)"));
    assert.ok(deny.includes("Bash(mv .env:*)"));
  });

  it("blocks symlink attacks to sensitive paths", () => {
    assert.ok(deny.includes("Bash(ln -s /etc:*)"));
    assert.ok(deny.includes("Bash(ln -s ~/.ssh:*)"));
  });

  it("includes security disclaimer in confirmation output", () => {
    assert.match(content, /UX guardrail, not a sandbox/);
  });
});

describe("enable.md hook configuration", () => {
  const content = readCommand("enable.md");

  it("references the global hook script with quoted path", () => {
    assert.match(content, /node 'HOME_DIR\/\.claude\/hooks\/csd\/csd-bash-guard\.js'/);
  });

  it("configures PreToolUse hook for Bash", () => {
    assert.match(content, /"matcher":\s*"Bash"/);
    assert.match(content, /"type":\s*"command"/);
  });

  it("merges into existing hooks instead of replacing", () => {
    assert.match(content, /do NOT replace it entirely/i);
    assert.match(content, /merge/i);
    assert.match(content, /remove any entry whose command contains.*csd-bash-guard/i);
    assert.match(content, /Preserve all other/i);
  });

  it("reports hook status in confirmation", () => {
    assert.match(content, /Bash guard hook: ACTIVE/);
  });
});

describe("enable-with-git.md permissions", () => {
  const content = readCommand("enable-with-git.md");
  const allow = extractPermissions(content, "allow");
  const deny = extractPermissions(content, "deny");

  it("allows git and gh in allowlist", () => {
    assert.ok(allow.includes("Bash(git:*)"));
    assert.ok(allow.includes("Bash(gh:*)"));
  });

  it("does NOT deny git/gh globally", () => {
    assert.ok(!deny.includes("Bash(git:*)"));
    assert.ok(!deny.includes("Bash(gh:*)"));
  });

  it("denies destructive git operations", () => {
    for (const cmd of [
      "Bash(git push --force:*)", "Bash(git push -f:*)",
      "Bash(git reset --hard:*)", "Bash(git clean -f:*)",
      "Bash(gh repo delete:*)",
    ]) {
      assert.ok(deny.includes(cmd), `should deny ${cmd}`);
    }
  });

  it("has same privilege escalation denies as enable.md", () => {
    for (const cmd of ["Bash(sudo:*)", "Bash(su:*)", "Bash(pkexec:*)", "Bash(doas:*)"]) {
      assert.ok(deny.includes(cmd), `should deny ${cmd}`);
    }
  });

  it("has same .env/secrets protection as enable.md", () => {
    assert.ok(deny.includes("Read(./.env)"));
    assert.ok(deny.includes("Bash(cat .env)"));
    assert.ok(deny.includes("Read(./secrets/**)"));
  });

  it("merges hooks instead of replacing", () => {
    assert.match(content, /do NOT replace it entirely/i);
    assert.match(content, /merge/i);
  });

  it("includes security disclaimer", () => {
    assert.match(content, /UX guardrail, not a sandbox/);
  });
});

describe("disable.md", () => {
  const content = readCommand("disable.md");

  it("instructs to remove permissions key", () => {
    assert.match(content, /remove the `permissions` key/i);
  });

  it("removes only CSD hook entry, not all hooks", () => {
    assert.match(content, /remove only the entry whose command contains.*csd-bash-guard/i);
    assert.match(content, /Keep all other PreToolUse entries/i);
    assert.match(content, /all other hook events/i);
  });

  it("cleans up empty hooks structure", () => {
    assert.match(content, /empty array.*delete the `PreToolUse` key/i);
    assert.match(content, /empty object.*delete the `hooks` key/i);
  });

  it("preserves other keys", () => {
    assert.match(content, /Preserve all other top-level keys/i);
  });

  it("handles missing settings file", () => {
    assert.match(content, /doesn't exist|does not exist/i);
  });

  it("cleans up empty settings file", () => {
    assert.match(content, /empty|`\{\}`/i);
  });
});

describe("cross-file consistency", () => {
  const enable = readCommand("enable.md");
  const enableGit = readCommand("enable-with-git.md");

  const enableAllow = extractPermissions(enable, "allow");
  const gitAllow = extractPermissions(enableGit, "allow");
  const enableDeny = extractPermissions(enable, "deny");
  const gitDeny = extractPermissions(enableGit, "deny");

  it("enable-with-git has all allow entries from enable (plus git)", () => {
    for (const perm of enableAllow) {
      assert.ok(gitAllow.includes(perm), `enable-with-git allow should include ${perm}`);
    }
  });

  it("enable-with-git has all non-git deny entries from enable", () => {
    const nonGitDenies = enableDeny.filter(
      (d) => d !== "Bash(git:*)" && d !== "Bash(gh:*)"
    );
    for (const perm of nonGitDenies) {
      assert.ok(gitDeny.includes(perm), `enable-with-git deny should include ${perm}`);
    }
  });
});
