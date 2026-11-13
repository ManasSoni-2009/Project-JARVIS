#!/usr/bin/env node
/**
 * J.A.R.V.I.S v3.0 - Self-Healing & Auto-Updating 1-Command Launcher
 * - Automatically checks GitHub (ManasSoni-2009/Project-JARVIS) on boot and updates changed files
 * - Repairs any esbuild/Vite peer version mismatch automatically
 * - Pre-warms the server and Vite module graph before launching the browser (zero white screen)
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
const REPO = "ManasSoni-2009/Project-JARVIS";
const BRANCH = "main";
const VERSION_FILE = path.join(rootDir, ".jarvis-version.json");

const CORE_SYNC_FILES = [
  "package.json",
  ".npmrc",
  "vite.config.ts",
  "index.html",
  "server.ts",
  "jarvis.bat",
  "jarvis.sh",
  "scripts/start-jarvis.mjs",
  "server/config.ts",
  "server/updater.ts",
  "server/brain/jevReflex.ts",
  "server/brain/supervisor.ts",
  "server/brain/state.ts",
  "server/transport/pipeline.ts",
  "server/transport/tts.ts",
  "server/transport/stt.ts",
  "src/main.tsx",
  "src/App.tsx",
  "src/index.css",
  "src/types/jarvis.ts",
  "src/components/JevPetPill.tsx",
  "src/components/CodexWorkbench.tsx",
  "src/components/StudioDropdown.tsx",
];

function getLocalCommit() {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(VERSION_FILE, "utf-8"));
      if (data.commit) return String(data.commit).slice(0, 7);
    }
  } catch {
    // ignore
  }
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: rootDir,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

async function autoUpdateFromGitHubOnBoot() {
  console.log("[1/4] Checking GitHub repository for latest J.A.R.V.I.S updates...");
  const localCommit = getLocalCommit();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/commits/${BRANCH}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "Project-JARVIS-v3-BootUpdater",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (!res.ok) {
      console.log(`      Using local build (${localCommit}).`);
      return false;
    }

    const commitData = await res.json();
    const remoteShortSha = String(commitData.sha || "").slice(0, 7);
    const commitMsg =
      commitData.commit?.message?.split("\n")[0] || "Latest update";

    if (!remoteShortSha) return false;

    if (localCommit === remoteShortSha) {
      console.log(`      Up to date with GitHub (${remoteShortSha}: ${commitMsg})`);
      return false;
    }

    console.log(
      `      New update detected on GitHub (${localCommit} -> ${remoteShortSha}): "${commitMsg}"`
    );

    const hasGit = fs.existsSync(path.join(rootDir, ".git"));
    if (hasGit) {
      try {
        execSync(`git fetch origin ${BRANCH}`, { cwd: rootDir, stdio: "ignore" });
        execSync(`git pull --rebase --autostash origin ${BRANCH}`, {
          cwd: rootDir,
          stdio: "inherit",
        });
        fs.writeFileSync(
          VERSION_FILE,
          JSON.stringify(
            {
              version: "3.0.0",
              commit: remoteShortSha,
              message: commitMsg,
              updatedAt: new Date().toISOString(),
            },
            null,
            2
          )
        );
        console.log(`      Successfully updated repository to ${remoteShortSha}.`);
        return true;
      } catch {
        // Fall back to direct file sync if git pull fails
      }
    }

    // Direct raw file downloader for Release ZIP folders without .git
    let updatedCount = 0;
    for (const relPath of CORE_SYNC_FILES) {
      try {
        const rawRes = await fetch(
          `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${relPath}`
        );
        if (!rawRes.ok) continue;
        const remoteText = await rawRes.text();
        const absPath = path.join(rootDir, relPath);
        const localText = fs.existsSync(absPath)
          ? fs.readFileSync(absPath, "utf-8")
          : null;
        if (localText !== remoteText) {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, remoteText, "utf-8");
          updatedCount++;
        }
      } catch {
        // continue
      }
    }

    fs.writeFileSync(
      VERSION_FILE,
      JSON.stringify(
        {
          version: "3.0.0",
          commit: remoteShortSha,
          message: commitMsg,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
    console.log(
      `      Auto-updated ${updatedCount} file(s) from GitHub (${remoteShortSha}).`
    );
    return updatedCount > 0;
  } catch {
    console.log(`      Offline or GitHub unreachable - booting local files (${localCommit}).`);
    return false;
  }
}

function ensureEnvironmentAndDependencies(filesWereUpdated) {
  // Ensure .env exists
  const envPath = path.join(rootDir, ".env");
  const envExamplePath = path.join(rootDir, ".env.example");
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log("[2/4] Created default .env from .env.example");
  } else {
    console.log("[2/4] Environment configuration verified");
  }

  // Ensure ./data directory exists
  const dataDir = path.join(rootDir, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Ensure .npmrc has legacy-peer-deps=true
  const npmrcPath = path.join(rootDir, ".npmrc");
  if (!fs.existsSync(npmrcPath)) {
    fs.writeFileSync(
      npmrcPath,
      "legacy-peer-deps=true\nfund=false\naudit=false\n",
      "utf-8"
    );
  }

  // Check if package.json still has the old conflicting esbuild@^0.25.0 entry
  const pkgJsonPath = path.join(rootDir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      if (pkg.devDependencies && pkg.devDependencies.esbuild === "^0.25.0") {
        delete pkg.devDependencies.esbuild;
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
      }
    } catch {
      // ignore
    }
  }

  // Verify core packages + check for esbuild 0.25.x mismatch with Vite 8
  const requiredPackages = ["vite", "tsx", "express", "react", "gsap", "motion"];
  const missingAny = requiredPackages.some(
    (name) => !fs.existsSync(path.join(rootDir, "node_modules", name, "package.json"))
  );

  let hasIncompatibleEsbuild = false;
  const esbuildPkgPath = path.join(rootDir, "node_modules", "esbuild", "package.json");
  const vitePkgPath = path.join(rootDir, "node_modules", "vite", "package.json");
  if (fs.existsSync(esbuildPkgPath) && fs.existsSync(vitePkgPath)) {
    try {
      const esbuildVer = JSON.parse(fs.readFileSync(esbuildPkgPath, "utf-8")).version || "";
      const viteVer = JSON.parse(fs.readFileSync(vitePkgPath, "utf-8")).version || "";
      if (viteVer.startsWith("8.") && esbuildVer.startsWith("0.25.")) {
        hasIncompatibleEsbuild = true;
      }
    } catch {
      // ignore
    }
  }

  if (missingAny || hasIncompatibleEsbuild) {
    console.log("[3/4] Installing & aligning dependencies...");
    try {
      execSync("npm install --legacy-peer-deps --no-audit --no-fund", {
        cwd: rootDir,
        stdio: "inherit",
      });
      if (hasIncompatibleEsbuild) {
        execSync("npm install esbuild@^0.27.0 --save-dev --legacy-peer-deps --no-audit --no-fund", {
          cwd: rootDir,
          stdio: "inherit",
        });
      }
    } catch {
      execSync("npm install --force --no-audit --no-fund", {
        cwd: rootDir,
        stdio: "inherit",
      });
    }
  } else {
    console.log("[3/4] Dependencies verified");
  }

  // Clear stale Vite cache if files were auto-updated or esbuild was repaired
  const viteCacheDir = path.join(rootDir, "node_modules", ".vite");
  if ((filesWereUpdated || hasIncompatibleEsbuild) && fs.existsSync(viteCacheDir)) {
    try {
      fs.rmSync(viteCacheDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

async function waitForServerAndWarmup() {
  for (let i = 0; i < 40; i++) {
    try {
      const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (healthRes.ok) {
        // Pre-warm Vite index.html and entry modules so browser never sees a white screen
        await fetch(`http://127.0.0.1:${port}/`).catch(() => {});
        await fetch(`http://127.0.0.1:${port}/src/main.tsx`).catch(() => {});
        await fetch(`http://127.0.0.1:${port}/src/App.tsx`).catch(() => {});
        return true;
      }
    } catch {
      // Server still booting
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

function openBrowser(targetUrl) {
  const platform = process.platform;
  try {
    if (platform === "win32") {
      spawn("cmd", ["/c", "start", "", targetUrl], {
        detached: true,
        stdio: "ignore",
      }).unref();
    } else if (platform === "darwin") {
      spawn("open", [targetUrl], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [targetUrl], { detached: true, stdio: "ignore" }).unref();
    }
  } catch {
    // Ignore browser launch error on headless machines
  }
}

async function main() {
  console.log("\n==========================================================");
  console.log("  J.A.R.V.I.S v3.0 Studio - Automated 1-Command Launcher  ");
  console.log("==========================================================\n");

  const filesWereUpdated = await autoUpdateFromGitHubOnBoot();
  ensureEnvironmentAndDependencies(filesWereUpdated);

  console.log(`[4/4] Starting J.A.R.V.I.S Studio on ${url} ...\n`);
  const child = spawn("npx", ["tsx", "server.ts"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (shouldOpenBrowser) {
    void waitForServerAndWarmup().then((ready) => {
      if (ready) {
        console.log(`\n[READY] J.A.R.V.I.S Studio compiled & ready -> Opening ${url}\n`);
        openBrowser(url);
      }
    });
  }

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

void main();
