#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");

const SOURCE_DIR = path.join(__dirname, "..", "commands", "csd");
const TARGET_DIR = path.join(os.homedir(), ".claude", "commands", "csd");

const command = process.argv[2];

switch (command) {
  case "install": {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      fs.cpSync(path.join(SOURCE_DIR, file), path.join(TARGET_DIR, file));
    }
    console.log("");
    console.log("claude-slightly-dangerous installed!");
    console.log("");
    console.log("Available commands in Claude Code:");
    console.log("  /csd:enable          — auto-approve local ops, deny git");
    console.log("  /csd:enable-with-git — auto-approve local ops + git");
    console.log("  /csd:disable         — reset to default permissions");
    console.log("");
    break;
  }
  case "uninstall": {
    if (fs.existsSync(TARGET_DIR)) {
      fs.rmSync(TARGET_DIR, { recursive: true });
      console.log(`claude-slightly-dangerous uninstalled. Removed ${TARGET_DIR}`);
    } else {
      console.log("claude-slightly-dangerous: nothing to clean up");
    }
    break;
  }
  default: {
    console.log("Usage: claude-slightly-dangerous <install|uninstall>");
    console.log("");
    console.log("  install    Copy slash commands to ~/.claude/commands/csd/");
    console.log("  uninstall  Remove slash commands from ~/.claude/commands/csd/");
    process.exit(1);
  }
}
