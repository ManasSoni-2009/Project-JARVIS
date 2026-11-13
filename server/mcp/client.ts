import fs from "node:fs/promises";
import path from "node:path";
import { generateLLMText } from "../config.ts";

const WORKSPACE_ROOT = path.resolve(process.cwd());

function safeWorkspacePath(requestedPath: string): string {
  const cleaned = (requestedPath || ".").trim();
  const resolved = path.resolve(WORKSPACE_ROOT, cleaned);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error("Access denied: path escapes workspace root.");
  }
  return resolved;
}

export class MCPClient {
  async handle(task: string): Promise<string> {
    const system = `You are a tool dispatcher. Given a task, decide which tool to call.

Available tools:
- filesystem_read: Read a file from the workspace. params: {"path": "..."}
- filesystem_list: List files in a workspace directory. params: {"path": "..."}
- filesystem_write: Write content to a workspace file (inside data/). params: {"path": "data/...", "content": "..."}
- github_list_repos: List GitHub repositories for the authenticated user (or a specified username). params: {"username": "...optional..."}
- github_get_repo: Get details of a specific repo. params: {"repo": "owner/name"}
- github_list_issues: List issues in a repo. params: {"repo": "owner/name"}
- github_create_issue: Create an issue. params: {"repo": "owner/name", "title": "...", "body": "..."}
- research_web_search: Perform a live web search for a query. params: {"query": "..."}
- research_url_read: Fetch and read text content from a public URL. params: {"url": "..."}
- research_arxiv_search: Search ArXiv for academic papers. params: {"query": "..."}

Respond ONLY as JSON: {"tool": "tool_name", "params": {...}}`;

    try {
      const res = await generateLLMText({
        systemInstruction: system,
        prompt: `Task: ${task}`,
        thinkingLevel: "low",
        responseMimeType: "application/json",
      });

      let raw = res.text;
      if (raw.includes("```")) {
        raw = raw.split("```")[1].replace(/^json\s*/i, "").trim();
      }
      const plan = JSON.parse(raw) as { tool?: string; params?: Record<string, string> };
      const tool = plan.tool || "research_web_search";
      const params = plan.params || {};
      return await this.executeTool(tool, params);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `MCP/Research tool execution failed: ${msg}`;
    }
  }

  private async executeTool(tool: string, params: Record<string, string>): Promise<string> {
    if (tool.startsWith("filesystem_")) {
      return this.filesystemTool(tool, params);
    }
    if (tool.startsWith("github_")) {
      return this.githubTool(tool, params);
    }
    if (tool.startsWith("research_")) {
      return this.researchTool(tool, params);
    }
    return `Unknown tool: ${tool}`;
  }

  private async filesystemTool(tool: string, params: Record<string, string>): Promise<string> {
    try {
      if (tool === "filesystem_read") {
        const target = safeWorkspacePath(params.path || "README.md");
        const content = await fs.readFile(target, "utf-8");
        return content.slice(0, 2500);
      }
      if (tool === "filesystem_list") {
        const target = safeWorkspacePath(params.path || ".");
        const entries = await fs.readdir(target, { withFileTypes: true });
        return entries
          .filter((e) => e.name !== "node_modules" && e.name !== ".git")
          .slice(0, 50)
          .map((e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`)
          .join("\n");
      }
      if (tool === "filesystem_write") {
        const rel = params.path || "data/output.txt";
        const safeRel = rel.startsWith("data/") ? rel : path.join("data", path.basename(rel));
        const target = safeWorkspacePath(safeRel);
        await fs.mkdir(path.dirname(target), { recursive: true });
        const content = params.content || "";
        await fs.writeFile(target, content, "utf-8");
        return `Written ${content.length} chars to ${safeRel}.`;
      }
      return `Unknown filesystem tool: ${tool}`;
    } catch (err) {
      return `Filesystem error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  private async githubTool(tool: string, params: Record<string, string>): Promise<string> {
    const token = process.env.GITHUB_TOKEN;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Project-JARVIS",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      if (tool === "github_list_repos") {
        const username = params.username?.trim();
        if (!token && !username) {
          return "GitHub token is not configured in Settings > Secrets. Ask about a public username or repository (e.g. 'ManasSoni-2009/Project-JARVIS') or add GITHUB_TOKEN.";
        }
        const endpoint = username
          ? `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=15&sort=updated`
          : "https://api.github.com/user/repos?per_page=15&sort=updated";
        const r = await fetch(endpoint, { headers });
        const data = (await r.json()) as Array<{ full_name: string; description?: string }> | { message?: string };
        if (!Array.isArray(data)) {
          return `GitHub API error: ${data.message || JSON.stringify(data)}`;
        }
        if (data.length === 0) return "No repositories found.";
        return data
          .slice(0, 15)
          .map((repo) => `- ${repo.full_name} -- ${repo.description || "No description"}`)
          .join("\n");
      }

      if (tool === "github_get_repo") {
        const repo = params.repo || "ManasSoni-2009/Project-JARVIS";
        const r = await fetch(`https://api.github.com/repos/${repo}`, { headers });
        const data = (await r.json()) as {
          full_name?: string;
          description?: string;
          stargazers_count?: number;
          language?: string;
          message?: string;
        };
        if (!data.full_name) {
          return `GitHub API error: ${data.message || "Repository not found"}`;
        }
        return `${data.full_name}: ${data.description || "No description"}. Stars: ${data.stargazers_count ?? 0}. Language: ${data.language || "N/A"}`;
      }

      if (tool === "github_list_issues") {
        const repo = params.repo || "";
        const r = await fetch(`https://api.github.com/repos/${repo}/issues?per_page=10`, { headers });
        const data = (await r.json()) as Array<{ number: number; title: string }> | { message?: string };
        if (!Array.isArray(data)) {
          return `GitHub API error: ${data.message || "Failed to list issues"}`;
        }
        if (data.length === 0) return `No open issues in ${repo}.`;
        return data.slice(0, 10).map((i) => `#${i.number}: ${i.title}`).join("\n");
      }

      if (tool === "github_create_issue") {
        if (!token) {
          return "Cannot create a GitHub issue without GITHUB_TOKEN configured in Settings > Secrets.";
        }
        const repo = params.repo || "";
        const r = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            title: params.title || "New Issue",
            body: params.body || "",
          }),
        });
        const issue = (await r.json()) as { number?: number; html_url?: string; message?: string };
        if (!issue.number) {
          return `GitHub API error: ${issue.message || "Failed to create issue"}`;
        }
        return `Created issue #${issue.number}: ${issue.html_url}`;
      }

      return `Unknown GitHub tool: ${tool}`;
    } catch (err) {
      return `GitHub request error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  private async researchTool(tool: string, params: Record<string, string>): Promise<string> {
    try {
      if (tool === "research_web_search") {
        const query = params.query || "";
        const res = await generateLLMText({
          prompt: `Search the web and summarize key findings for: ${query}`,
          useGoogleSearch: true,
          thinkingLevel: "high",
        });
        return res.text || `No search results found for '${query}'.`;
      }

      if (tool === "research_url_read") {
        const url = params.url || "";
        const r = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Project-JARVIS/2.0)" },
        });
        const html = await r.text();
        const text = html
          .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return `Content from ${url}:\n\n${text.slice(0, 4000)}`;
      }

      if (tool === "research_arxiv_search") {
        const query = params.query || "";
        const apiUrl = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5`;
        const r = await fetch(apiUrl);
        const xml = await r.text();
        const titles = [...xml.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => m[1].trim()).slice(1);
        const summaries = [...xml.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => m[1].trim());
        const results: string[] = [];
        const count = Math.min(titles.length, summaries.length);
        for (let i = 0; i < count; i++) {
          const t = titles[i].replace(/\s+/g, " ");
          const a = summaries[i].replace(/\s+/g, " ").slice(0, 280);
          results.push(`[${i + 1}] ${t}\nAbstract: ${a}...`);
        }
        return results.length > 0
          ? `ArXiv results for '${query}':\n\n${results.join("\n\n")}`
          : `No ArXiv results found for '${query}'.`;
      }

      return `Unknown research tool: ${tool}`;
    } catch (err) {
      return `Research tool error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }
}
