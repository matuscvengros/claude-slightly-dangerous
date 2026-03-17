const { describe, it, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");

const CLI = path.join(__dirname, "..", "bin", "cli.js");
const SOURCE_COMMANDS = path.join(__dirname, "..", "commands", "csd");
const SOURCE_HOOKS = path.join(__dirname, "..", "hooks");
const GLOBAL_COMMANDS = path.join(os.homedir(), ".claude", "commands", "csd");
const GLOBAL_HOOKS = path.join(os.homedir(), ".claude", "hooks");

function run(args) {
  return execFileSync("node", [CLI, ...args], {
    encoding: "utf-8",
    timeout: 10_000,
  });
}

function cleanup() {
  if (fs.existsSync(GLOBAL_COMMANDS)) {
    fs.rmSync(GLOBAL_COMMANDS, { recursive: true });
  }
  const hookFile = path.join(GLOBAL_HOOKS, "csd-bash-guard.js");
  if (fs.existsSync(hookFile)) {
    fs.rmSync(hookFile);
  }
}

describe("CLI", () => {
  beforeEach(() => cleanup());
  after(() => cleanup());

  it("shows usage when no command given", () => {
    try {
      run([]);
      assert.fail("should have exited with code 1");
    } catch (err) {
      assert.equal(err.status, 1);
      assert.match(err.stdout.toString(), /install|uninstall/i);
    }
  });

  it("shows usage for unknown command", () => {
    try {
      run(["banana"]);
      assert.fail("should have exited with code 1");
    } catch (err) {
      assert.equal(err.status, 1);
      assert.match(err.stdout.toString(), /install|uninstall/i);
    }
  });

  it("installs command files and hook globally", () => {
    const output = run(["install"]);
    assert.match(output, /installed/i);

    // Check command files
    for (const file of ["enable.md", "enable-with-git.md", "disable.md"]) {
      const target = path.join(GLOBAL_COMMANDS, file);
      assert.ok(fs.existsSync(target), `${file} should exist after install`);
      const source = fs.readFileSync(path.join(SOURCE_COMMANDS, file), "utf-8");
      const installed = fs.readFileSync(target, "utf-8");
      assert.equal(installed, source, `${file} content should match source`);
    }

    // Check hook file
    const hookTarget = path.join(GLOBAL_HOOKS, "csd-bash-guard.js");
    assert.ok(fs.existsSync(hookTarget), "hook should exist after install");
    const hookSource = fs.readFileSync(
      path.join(SOURCE_HOOKS, "csd-bash-guard.js"),
      "utf-8"
    );
    const hookInstalled = fs.readFileSync(hookTarget, "utf-8");
    assert.equal(hookInstalled, hookSource, "hook content should match source");

    // Confirm no settings were modified
    assert.match(output, /\/csd:enable/i, "should tell user to run /csd:enable");
  });

  it("install is idempotent", () => {
    run(["install"]);
    run(["install"]); // should not throw
    assert.ok(fs.existsSync(path.join(GLOBAL_COMMANDS, "enable.md")));
  });

  it("uninstalls command files and hook", () => {
    run(["install"]);
    const hookTarget = path.join(GLOBAL_HOOKS, "csd-bash-guard.js");
    assert.ok(fs.existsSync(GLOBAL_COMMANDS));
    assert.ok(fs.existsSync(hookTarget));

    const output = run(["uninstall"]);
    assert.match(output, /removed|removing/i);
    assert.ok(!fs.existsSync(GLOBAL_COMMANDS), "commands dir should be removed");
    assert.ok(!fs.existsSync(hookTarget), "hook should be removed");
    // Should warn about orphaned project settings
    assert.match(output, /csd:disable/i, "should warn about project cleanup");
  });

  it("uninstall when nothing installed", () => {
    const output = run(["uninstall"]);
    assert.match(output, /nothing/i);
  });
});
