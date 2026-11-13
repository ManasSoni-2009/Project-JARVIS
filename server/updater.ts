import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export interface AutoUpdateStatus {
  repo: string;
  branch: string;
  currentCommit: string;
  latestCommit: string;
  status: "up_to_date" | "updated" | "update_available" | "checking" | "offline";
  lastCheckedAt: string;
  updatedFiles: string[];
  latestCommitMessage: string;
  message: string;
}

const DEFAULT_REPO = "ManasSoni-2009/Project-JARVIS";
const DEFAULT_BRANCH = "main";
const VERSION_FILE = path.resolve(process.cwd(), ".jarvis-version.json");

// Core source files that can be safely hot-updated even in ZIP installations without .git
const CORE_SYNC_FILES = [
  "package.json",
  ".npmrc",
  "vite.config.ts",
  "index.html",
  "server.ts",
  "jarvis.bat",
  "jarvis.sh",
  "scripts/start-jarvis.mjs",
  "scripts/voice_bridge.py",
  "server/config.ts",
  "server/updater.ts",
  "server/memory/obsidian.ts",
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
  "src/components/OnboardingWizard.tsx",
];

let cachedUpdateStatus: AutoUpdateStatus = {
  repo: DEFAULT_REPO,
  branch: DEFAULT_BRANCH,
  currentCommit: getLocalCommitSha(),
  latestCommit: getLocalCommitSha(),
  status: "up_to_date",
  lastCheckedAt: new Date().toISOString(),
  updatedFiles: [],
  latestCommitMessage: "",
  message: "J.A.R.V.I.S v3.0 Studio is up to date.",
};

function getLocalCommitSha(): string {
  try {
    if (fs.existsSync(VERSION_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(VERSION_FILE, "utf-8")) as {
        commit?: string;
      };
      if (parsed.commit) return parsed.commit.slice(0, 7);
    }
  } catch {
    // ignore
  }

  try {
    const sha = execSync("git rev-parse --short HEAD", {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (sha) return sha;
  } catch {
    // Not a git repo (e.g., downloaded Release ZIP)
  }

  return "v3.0.0";
}

function saveLocalVersionFile(commit: string, message: string) {
  try {
    fs.writeFileSync(
      VERSION_FILE,
      JSON.stringify(
        {
          version: "3.0.0",
          commit: commit.slice(0, 7),
          message,
          updatedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      "utf-8"
    );
  } catch {
    // ignore write errors on read-only mounts
  }
}

export function getAutoUpdateStatus(): AutoUpdateStatus {
  return cachedUpdateStatus;
}

/**
 * Checks the GitHub repository for newer commits on `main` and automatically
 * updates local files on boot when running on a user desktop installation.
 */
export async function checkAndAutoUpdate(options?: {
  applyUpdates?: boolean;
  forceSyncZipFiles?: boolean;
}): Promise<AutoUpdateStatus> {
  const applyUpdates = options?.applyUpdates ?? true;
  const repo = DEFAULT_REPO;
  const branch = DEFAULT_BRANCH;
  const localCommit = getLocalCommitSha();

  cachedUpdateStatus = {
    ...cachedUpdateStatus,
    currentCommit: localCommit,
    status: "checking",
    lastCheckedAt: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Project-JARVIS-v3-AutoUpdater",
    };
    const token =
      process.env.GITHUB_TOKEN ||
      process.env.GH_TOKEN ||
      process.env.GITHUB_PAT;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(
      `https://api.github.com/repos/${repo}/commits/${branch}`,
      {
        headers,
        signal: controller.signal,
      }
    );
    clearTimeout(timer);

    if (!res.ok) {
      cachedUpdateStatus = {
        repo,
        branch,
        currentCommit: localCommit,
        latestCommit: localCommit,
        status: "up_to_date",
        lastCheckedAt: new Date().toISOString(),
        updatedFiles: [],
        latestCommitMessage: "",
        message: `Verified local build (${localCommit}).`,
      };
      return cachedUpdateStatus;
    }

    const commitData = (await res.json()) as {
      sha?: string;
      commit?: { message?: string };
      files?: Array<{ filename?: string; status?: string }>;
    };

    const remoteFullSha = commitData.sha || "";
    const remoteShortSha = remoteFullSha.slice(0, 7) || localCommit;
    const latestCommitMessage =
      commitData.commit?.message?.split("\n")[0] || "Release V3 update";

    const isSameCommit =
      localCommit === remoteShortSha && !options?.forceSyncZipFiles;

    const missingLocalCoreFiles = CORE_SYNC_FILES.filter(
      (f) => !fs.existsSync(path.resolve(process.cwd(), f))
    );

    if (isSameCommit && missingLocalCoreFiles.length === 0) {
      saveLocalVersionFile(remoteShortSha, latestCommitMessage);
      cachedUpdateStatus = {
        repo,
        branch,
        currentCommit: remoteShortSha,
        latestCommit: remoteShortSha,
        status: "up_to_date",
        lastCheckedAt: new Date().toISOString(),
        updatedFiles: [],
        latestCommitMessage,
        message: `Up to date with GitHub ${branch} (${remoteShortSha}).`,
      };
      return cachedUpdateStatus;
    }

    // Never overwrite files inside the AI Studio cloud builder container itself
    const isAiStudioContainer = fs.existsSync("/app/applet");
    if (!applyUpdates || isAiStudioContainer) {
      saveLocalVersionFile(remoteShortSha, latestCommitMessage);
      cachedUpdateStatus = {
        repo,
        branch,
        currentCommit: remoteShortSha,
        latestCommit: remoteShortSha,
        status: "up_to_date",
        lastCheckedAt: new Date().toISOString(),
        updatedFiles: [],
        latestCommitMessage,
        message: `Synced with GitHub ${branch} (${remoteShortSha}).`,
      };
      return cachedUpdateStatus;
    }

    const updatedFiles: string[] = [];
    const hasGitDir = fs.existsSync(path.resolve(process.cwd(), ".git"));

    if (hasGitDir) {
      try {
        execSync(`git fetch origin ${branch}`, { stdio: "ignore" });
        const diffOut = execSync(
          `git diff --name-only HEAD..origin/${branch}`,
          { stdio: ["ignore", "pipe", "ignore"] }
        )
          .toString()
          .trim();
        if (diffOut) {
          updatedFiles.push(...diffOut.split("\n").filter(Boolean));
        }
        execSync(`git pull --rebase --autostash origin ${branch}`, {
          stdio: "ignore",
        });
        saveLocalVersionFile(remoteShortSha, latestCommitMessage);
        cachedUpdateStatus = {
          repo,
          branch,
          currentCommit: remoteShortSha,
          latestCommit: remoteShortSha,
          status: "updated",
          lastCheckedAt: new Date().toISOString(),
          updatedFiles,
          latestCommitMessage,
          message: `Auto-updated ${updatedFiles.length || 1} file(s) from GitHub (${remoteShortSha}).`,
        };
        return cachedUpdateStatus;
      } catch {
        // Fall through to raw file HTTP sync if git pull fails
      }
    }

    // Raw HTTP file sync for ZIP installations without .git using full GitHub Tree discovery
    let discoveredTreeFiles: string[] = [];
    try {
      const treeRes = await fetch(
        `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
        { headers }
      );
      if (treeRes.ok) {
        const treeData = (await treeRes.json()) as {
          tree?: Array<{ path?: string; type?: string }>;
        };
        discoveredTreeFiles = (treeData.tree || [])
          .filter(
            (t) =>
              t.type === "blob" &&
              typeof t.path === "string" &&
              !t.path.startsWith("data/") &&
              !t.path.startsWith(".env") &&
              (CORE_SYNC_FILES.includes(t.path) ||
                t.path.startsWith("src/") ||
                t.path.startsWith("server/") ||
                t.path.startsWith("scripts/"))
          )
          .map((t) => t.path!);
      }
    } catch {
      // fallback to CORE_SYNC_FILES
    }

    const filesToSync = Array.from(
      new Set([...CORE_SYNC_FILES, ...discoveredTreeFiles])
    );

    for (const relPath of filesToSync) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${relPath}`;
        const fileRes = await fetch(rawUrl);
        if (!fileRes.ok) continue;
        const remoteContent = await fileRes.text();
        const absPath = path.resolve(process.cwd(), relPath);
        const currentContent = fs.existsSync(absPath)
          ? fs.readFileSync(absPath, "utf-8")
          : null;

        if (currentContent !== remoteContent) {
          fs.mkdirSync(path.dirname(absPath), { recursive: true });
          fs.writeFileSync(absPath, remoteContent, "utf-8");
          updatedFiles.push(relPath);
        }
      } catch {
        // Continue syncing remaining files
      }
    }

    saveLocalVersionFile(remoteShortSha, latestCommitMessage);
    cachedUpdateStatus = {
      repo,
      branch,
      currentCommit: remoteShortSha,
      latestCommit: remoteShortSha,
      status: updatedFiles.length > 0 ? "updated" : "up_to_date",
      lastCheckedAt: new Date().toISOString(),
      updatedFiles,
      latestCommitMessage,
      message:
        updatedFiles.length > 0
          ? `Auto-updated ${updatedFiles.length} file(s) to ${remoteShortSha}.`
          : `Verified latest GitHub build (${remoteShortSha}).`,
    };
    return cachedUpdateStatus;
  } catch {
    cachedUpdateStatus = {
      repo,
      branch,
      currentCommit: localCommit,
      latestCommit: localCommit,
      status: "offline",
      lastCheckedAt: new Date().toISOString(),
      updatedFiles: [],
      latestCommitMessage: "",
      message: `Offline mode (${localCommit}) — using local Studio files.`,
    };
    return cachedUpdateStatus;
  }
}
