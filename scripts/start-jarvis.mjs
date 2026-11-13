#!/usr/bin/env node
/**
 * J.A.R.V.I.S v3.0 - 1-Command Cross-Platform Bootstrapper & Launcher
 * Usage:
 *   npm run jarvis
 *   node scripts/start-jarvis.mjs --open
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const shouldOpenBrowser = process.argv.includes("--open");
const port = process.env.PORT || "3000";
const url = `http://localhost:${port}`;

console.log("\n==========================================================");
console.log("  J.A.R.V.I.S v3.0 Studio - Automated 1-Command Launcher  ");
console.log("==========================================================\n");

// 1. Ensure .env exists (copy from .env.example if missing)
const envPath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, ".env.example");
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log("[1/3] Created default .env from .env.example");
} else {
  console.log("[1/3] Environment configuration verified");
}

// 2. Ensure ./data directories exist
const dataDir = path.join(rootDir, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 3. Verify complete installation (check actual core packages in case a prior install failed midway)
const vitePkg = path.join(rootDir, "node_modules", "vite", "package.json");
const tsxPkg = path.join(rootDir, "node_modules", "tsx", "package.json");
const expressPkg = path.join(rootDir, "node_modules", "express", "package.json");

if (!fs.existsSync(vitePkg) || !fs.existsSync(tsxPkg) || !fs.existsSync(expressPkg)) {
  console.log("[2/3] Installing dependencies (first-time setup)...");
  try {
    execSync("npm install --legacy-peer-deps --no-audit --no-fund", {
      cwd: rootDir,
      stdio: "inherit",
    });
  } catch {
    console.log("[2/3] Retrying dependency installation with --force...");
    execSync("npm install --force --no-audit --no-fund", {
      cwd: rootDir,
      stdio: "inherit",
    });
  }
} else {
  console.log("[2/3] Dependencies verified");
}

// 4. Open browser automatically once server is ready if --open was passed
if (shouldOpenBrowser) {
  setTimeout(() => {
    const platform = process.platform;
    try {
      if (platform === "win32") {
        spawn("cmd", ["/c", "start", "", url], {
          detached: true,
          stdio: "ignore",
        }).unref();
      } else if (platform === "darwin") {
        spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
      } else {
        spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
      }
    } catch {
      // Ignore browser launch error on headless systems
    }
  }, 2400);
}

console.log(`[3/3] Starting J.A.R.V.I.S Studio on ${url} ...\n`);
const child = spawn("npx", ["tsx", "server.ts"], {
  cwd: rootDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
