const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const HOOK = path.join(__dirname, "..", "hooks", "csd-bash-guard.js");
const {
  splitSegments,
  extractSubstitutions,
  checkSegment,
  checkFullCommand,
} = require(HOOK);

function runHook(command) {
  const input = JSON.stringify({ tool_input: { command } });
  try {
    execFileSync("node", [HOOK], {
      input,
      encoding: "utf-8",
      timeout: 5_000,
    });
    return { blocked: false };
  } catch (err) {
    return { blocked: true, stderr: err.stderr || "" };
  }
}

describe("splitSegments", () => {
  it("splits on pipe", () => {
    assert.deepEqual(splitSegments("echo foo | grep bar"), [
      "echo foo",
      "grep bar",
    ]);
  });

  it("splits on &&", () => {
    assert.deepEqual(splitSegments("cd dir && npm test"), [
      "cd dir",
      "npm test",
    ]);
  });

  it("splits on ||", () => {
    assert.deepEqual(splitSegments("test -f x || echo missing"), [
      "test -f x",
      "echo missing",
    ]);
  });

  it("splits on semicolons", () => {
    assert.deepEqual(splitSegments("echo a; echo b"), ["echo a", "echo b"]);
  });

  it("does NOT split inside double quotes", () => {
    assert.deepEqual(splitSegments('echo "a|b" | grep x'), [
      'echo "a|b"',
      "grep x",
    ]);
  });

  it("does NOT split inside single quotes", () => {
    assert.deepEqual(splitSegments("echo 'a && b' && ls"), [
      "echo 'a && b'",
      "ls",
    ]);
  });

  it("handles escaped quotes", () => {
    const result = splitSegments('echo "hello \\"world\\"" | cat');
    assert.equal(result.length, 2);
  });

  it("handles empty input", () => {
    assert.deepEqual(splitSegments(""), []);
  });
});

describe("extractSubstitutions", () => {
  it("extracts $() substitutions", () => {
    const subs = extractSubstitutions("echo $(cat .env)");
    assert.ok(subs.some((s) => s.includes("cat .env")));
  });

  it("extracts backtick substitutions", () => {
    const subs = extractSubstitutions("echo `sudo whoami`");
    assert.ok(subs.some((s) => s.includes("sudo whoami")));
  });

  it("extracts process substitutions", () => {
    const subs = extractSubstitutions("diff <(cat .env) <(cat .env.bak)");
    assert.ok(subs.some((s) => s.includes("cat .env")));
  });

  it("handles nested $()", () => {
    const subs = extractSubstitutions("echo $(echo $(cat .env))");
    assert.ok(subs.length >= 1);
  });

  it("returns empty for no substitutions", () => {
    const subs = extractSubstitutions("echo hello");
    assert.equal(subs.length, 0);
  });
});

describe("checkSegment", () => {
  it("blocks sudo", () => {
    assert.throws(() => checkSegment("sudo rm -rf /tmp"), /privilege escalation/);
  });

  it("blocks su", () => {
    assert.throws(() => checkSegment("su - root"), /privilege escalation/);
  });

  it("blocks pkexec", () => {
    assert.throws(() => checkSegment("pkexec bash"), /privilege escalation/);
  });

  it("blocks doas", () => {
    assert.throws(() => checkSegment("doas reboot"), /privilege escalation/);
  });

  it("blocks mkfs", () => {
    assert.throws(() => checkSegment("mkfs.ext4 /dev/sda"), /disk destruction/);
  });

  it("blocks wipefs", () => {
    assert.throws(() => checkSegment("wipefs -a /dev/sda"), /disk destruction/);
  });

  it("allows normal rm", () => {
    checkSegment("rm -rf node_modules");
    checkSegment("rm -rf dist/");
    checkSegment("rm -r build");
  });

  it("blocks rm targeting /", () => {
    assert.throws(() => checkSegment("rm -rf /"), /destructive rm/);
  });

  it("blocks rm targeting ~", () => {
    assert.throws(() => checkSegment("rm -rf ~"), /destructive rm/);
  });

  it("blocks rm targeting ..", () => {
    assert.throws(() => checkSegment("rm -rf .."), /destructive rm/);
  });

  it("blocks rm targeting .", () => {
    assert.throws(() => checkSegment("rm -rf ."), /destructive rm/);
  });

  it("blocks rm with long flags", () => {
    assert.throws(
      () => checkSegment("rm --recursive --force /"),
      /destructive rm/
    );
  });

  it("blocks rm with path before flags", () => {
    assert.throws(() => checkSegment("rm / -rf"), /destructive rm/);
  });
});

describe("checkFullCommand", () => {
  it("blocks .env references", () => {
    assert.throws(() => checkFullCommand("cat .env"), /\.env/);
  });

  it("blocks .env.production references", () => {
    assert.throws(
      () => checkFullCommand("grep KEY .env.production"),
      /\.env/
    );
  });

  it("blocks quoted .env references", () => {
    assert.throws(
      () => checkFullCommand("python -c \"open('.env').read()\""),
      /\.env/
    );
  });

  it("does NOT block .envs/ directory", () => {
    checkFullCommand("ls .envs/myproject");
  });

  it("does NOT block .env-parser or similar package names", () => {
    checkFullCommand("cat node_modules/.env-parser/index.js");
  });

  it("blocks secrets/ references", () => {
    assert.throws(() => checkFullCommand("cat secrets/key.pem"), /secrets/);
  });

  it("blocks ./secrets/ references", () => {
    assert.throws(() => checkFullCommand("ls ./secrets/"), /secrets/);
  });

  it("does NOT block generate-secrets or similar compound words", () => {
    checkFullCommand("npm run generate-secrets");
  });

  it("does NOT block my-secrets-lib", () => {
    checkFullCommand("npm install my-secrets-lib");
  });

  it("blocks symlinks to /etc", () => {
    assert.throws(
      () => checkFullCommand("ln -s /etc/passwd ./pw"),
      /symlink/
    );
  });

  it("blocks symlinks to ~/.ssh", () => {
    assert.throws(
      () => checkFullCommand("ln -s ~/.ssh/id_rsa ./key"),
      /symlink/
    );
  });

  it("allows normal commands", () => {
    checkFullCommand("npm test");
    checkFullCommand("cat package.json");
    checkFullCommand("ls -la");
    checkFullCommand("python3 manage.py test");
  });
});

describe("integration: hook subprocess", () => {
  it("hook script exists", () => {
    assert.ok(fs.existsSync(HOOK));
  });

  describe("allows safe commands", () => {
    const safe = [
      "ls -la",
      "npm test",
      "node index.js",
      "mkdir -p dist",
      "rm -rf node_modules",
      "rm -rf dist",
      "cat package.json",
      "grep -r TODO src/",
      "echo hello",
      "python3 manage.py test",
      "git status",
      "git push origin main",
      'echo "a|b" | cat',
      "ls .envs/myproject",
      "npm run generate-secrets",
    ];

    for (const cmd of safe) {
      it(`allows: ${cmd}`, () => {
        assert.equal(runHook(cmd).blocked, false);
      });
    }
  });

  describe("blocks dangerous commands", () => {
    const blocked = [
      ["sudo rm -rf /tmp/test", "privilege escalation"],
      ["su - root", "privilege escalation"],
      ["echo test | sudo tee /etc/hosts", "privilege escalation in pipe"],
      ["cat .env", ".env access"],
      ['python -c "open(\'.env\').read()"', ".env in quoted string"],
      ["echo test | tee .env", ".env in pipe target"],
      ["cp something .env.backup", ".env variant"],
      ["grep SECRET .env.production", ".env variant"],
      ["cat secrets/key.pem", "secrets/ access"],
      ["ls secrets/", "secrets/ listing"],
      ["tar czf backup.tar.gz secrets/", "secrets/ in archive"],
      ["echo y | mkfs.ext4 /dev/sda", "disk destruction in pipe"],
      ["ln -s /etc/passwd ./passwd", "symlink to /etc"],
      ["ln -s ~/.ssh/id_rsa ./key", "symlink to .ssh"],
      ["rm --recursive --force /", "rm with long flags"],
    ];

    for (const [cmd, desc] of blocked) {
      it(`blocks: ${cmd} (${desc})`, () => {
        assert.equal(runHook(cmd).blocked, true);
      });
    }
  });

  describe("blocks command substitutions", () => {
    const blocked = [
      ["echo $(sudo whoami)", "sudo in $()"],
      ["echo $(cat .env)", ".env in $()"],
      ["echo `cat .env`", ".env in backticks"],
      ["diff <(cat .env) file.txt", ".env in process substitution"],
      ["echo $(cat secrets/key.pem)", "secrets/ in $()"],
    ];

    for (const [cmd, desc] of blocked) {
      it(`blocks: ${cmd} (${desc})`, () => {
        assert.equal(runHook(cmd).blocked, true);
      });
    }
  });

  describe("edge cases", () => {
    it("allows empty command", () => {
      assert.equal(runHook("").blocked, false);
    });

    it("handles malformed JSON gracefully", () => {
      try {
        execFileSync("node", [HOOK], {
          input: "not json",
          encoding: "utf-8",
          timeout: 5_000,
        });
      } catch {
        // Both allow and block are acceptable
      }
    });
  });
});
