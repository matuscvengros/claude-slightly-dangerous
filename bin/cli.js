#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const SOURCE_COMMANDS = path.join(__dirname, "..", "commands", "csd");
const SOURCE_HOOKS = path.join(__dirname, "..", "hooks");
const PKG = require(path.join(__dirname, "..", "package.json"));

const GLOBAL_BASE = path.join(os.homedir(), ".claude");

// ANSI helpers
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

const BANNER = `
  ${bold("██████╗███████╗██████╗")}
  ${bold("██╔════╝██╔════╝██╔══██╗")}
  ${bold("██║     ███████╗██║  ██║")}
  ${bold("██║     ╚════██║██║  ██║")}
  ${bold("╚██████╗███████║██████╔╝")}
  ${bold("╚═════╝╚══════╝╚═════╝")}
  ${dim(`Claude: Slightly Dangerous v${PKG.version}`)}
  ${dim("Controlled permissions for Claude Code.")}
`;

function displayPath(p) {
  return p.replace(os.homedir(), "~");
}

function installFiles(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const files = fs.readdirSync(sourceDir).filter((f) => !f.startsWith("."));
  for (const file of files) {
    const src = path.join(sourceDir, file);
    const dest = path.join(targetDir, file);
    fs.cpSync(src, dest);
    console.log(`    ${green("✓")} ${file}`);
  }
  return files;
}

function install() {
  console.log(BANNER);

  const commandsDir = path.join(GLOBAL_BASE, "commands", "csd");
  const hooksDir = path.join(GLOBAL_BASE, "hooks");

  console.log(`  ${cyan("⇒")} Installing commands to ${dim(displayPath(commandsDir))}`);
  console.log("");
  const cmdFiles = installFiles(SOURCE_COMMANDS, commandsDir);

  console.log("");
  console.log(`  ${cyan("⇒")} Installing hook to ${dim(displayPath(hooksDir))}`);
  console.log("");
  const hookFiles = installFiles(SOURCE_HOOKS, hooksDir);

  console.log("");
  console.log(`  ${cyan("⇒")} Commands available`);
  console.log("");
  console.log(`    ${bold("/csd:enable")}            Auto-approve local ops, deny git`);
  console.log(`    ${bold("/csd:enable-with-git")}   Auto-approve local ops + git`);
  console.log(`    ${bold("/csd:disable")}           Reset to default permissions`);
  console.log("");
  console.log(`  ${green("✓")} ${cmdFiles.length} commands, ${hookFiles.length} hook installed.`);
  console.log(`  ${dim("Run /csd:enable in a Claude Code session to activate.")}`);
  console.log("");
}

function uninstall() {
  console.log(BANNER);

  const commandsDir = path.join(GLOBAL_BASE, "commands", "csd");
  const hookFile = path.join(GLOBAL_BASE, "hooks", "csd-bash-guard.js");

  const hasCommands = fs.existsSync(commandsDir);
  const hasHook = fs.existsSync(hookFile);

  if (!hasCommands && !hasHook) {
    console.log(`  ${green("✓")} Nothing to clean up — not installed.`);
    console.log("");
    return;
  }

  console.log(`  ${cyan("⇒")} Removing from ${dim(displayPath(GLOBAL_BASE))}`);
  console.log("");

  if (hasCommands) {
    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      console.log(`    ${red("✗")} commands/csd/${file}`);
    }
    fs.rmSync(commandsDir, { recursive: true });
  }

  if (hasHook) {
    console.log(`    ${red("✗")} hooks/csd-bash-guard.js`);
    fs.rmSync(hookFile);
  }

  console.log("");
  console.log(`  ${green("✓")} CSD removed.`);
  console.log("");
  console.log(`  ${yellow("⚠")} If you enabled CSD in any projects, run ${bold("/csd:disable")} in each`);
  console.log(`    project to clean up .claude/settings.local.json, or manually`);
  console.log(`    remove the "permissions" and CSD hook entry from that file.`);
  console.log("");
}

const command = process.argv[2];

switch (command) {
  case "install":
    install();
    break;
  case "uninstall":
    uninstall();
    break;
  default:
    console.log(BANNER);
    console.log(`  ${bold("Usage:")} npx claude-slightly-dangerous ${cyan("<command>")}`);
    console.log("");
    console.log(`    ${bold("install")}     Install slash commands and bash guard hook`);
    console.log(`    ${bold("uninstall")}   Remove all CSD files`);
    console.log("");
    process.exit(1);
}
