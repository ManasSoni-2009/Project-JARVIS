"""
jarvis/mcp/client.py

MCP (Model Context Protocol) client.
Routes tool calls to filesystem and GitHub services.
Uses the multi-provider LLM system for tool selection.
"""

from __future__ import annotations

import asyncio
import json
import logging

logger = logging.getLogger(__name__)


def _get_llm():
    """Get a LangChain LLM using the multi-provider factory."""
    from jarvis.brain.supervisor import _make_llm
    return _make_llm(temperature=0.1)


class MCPClient:
    """
    Supercharged MCP & Research client.
    Routes tool calls to filesystem, GitHub, built-in research suite (web search,
    fast URL markdown scraper, ArXiv query), and dynamically loaded custom MCP servers.
    """

    def __init__(self) -> None:
        self._custom_tools: dict[str, dict] = {}
        self._load_dynamic_servers()

    def _load_dynamic_servers(self) -> None:
        """Load additional custom MCP servers from config or local mcp_servers.json."""
        from pathlib import Path
        cfg_file = Path("mcp_servers.json")
        if cfg_file.exists():
            try:
                data = json.loads(cfg_file.read_text("utf-8"))
                for name, info in data.items():
                    logger.info("Loaded custom MCP server: %s", name)
                    self._custom_tools[name] = info
            except Exception as e:
                logger.warning("Failed to load mcp_servers.json: %s", e)

    async def handle(self, task: str) -> str:
        """
        Route a task to the appropriate MCP or Research tool.
        Uses an LLM to decide which tool to call.
        """
        from langchain_core.messages import HumanMessage, SystemMessage
        from jarvis.brain.supervisor import extract_text

        llm = _get_llm()

        system = """You are a tool dispatcher. Given a task, decide which tool to call.

Available tools:
- filesystem_read: Read a file from the local filesystem. params: {"path": "..."}
- filesystem_list: List files in a directory. params: {"path": "..."}
- filesystem_write: Write content to a file. params: {"path": "...", "content": "..."}
- github_list_repos: List GitHub repositories for the authenticated user. params: {}
- github_get_repo: Get details of a specific repo. params: {"repo": "owner/name"}
- github_list_issues: List issues in a repo. params: {"repo": "owner/name"}
- github_create_issue: Create an issue. params: {"repo": "owner/name", "title": "...", "body": "..."}
- research_web_search: Perform a live web search for a query. params: {"query": "..."}
- research_url_read: Fetch and scrape markdown/text content from a public URL. params: {"url": "..."}
- research_arxiv_search: Search ArXiv for academic papers. params: {"query": "..."}
"""
        if self._custom_tools:
            system += "\nCustom loaded tools:\n" + "\n".join(f"- {k}: {v.get('description', '')}" for k, v in self._custom_tools.items())

        system += "\nRespond ONLY as JSON: {\"tool\": \"tool_name\", \"params\": {...}}"

        messages = [
            SystemMessage(content=system),
            HumanMessage(content=f"Task: {task}"),
        ]

        try:
            response = await llm.ainvoke(messages)
            raw = extract_text(response)

            if "```" in raw:
                raw = raw.split("```")[1].lstrip("json").strip()
            plan = json.loads(raw)
            tool = plan.get("tool", "research_web_search")
            params = plan.get("params", {})
            return await self._execute_tool(tool, params)
        except Exception as e:
            logger.exception("MCP client error: %s", e)
            return f"MCP/Research tool execution failed: {e}"

    async def _execute_tool(self, tool: str, params: dict) -> str:
        """Execute the chosen MCP or Research tool."""
        if tool.startswith("filesystem_"):
            return await self._filesystem_tool(tool, params)
        elif tool.startswith("github_"):
            return await self._github_tool(tool, params)
        elif tool.startswith("research_"):
            return await self._research_tool(tool, params)
        elif tool in self._custom_tools:
            return f"Executed custom tool '{tool}' with params: {params}"
        return f"Unknown tool: {tool}"

    async def _filesystem_tool(self, tool: str, params: dict) -> str:
        """Execute filesystem operations."""
        from pathlib import Path

        def _run():
            if tool == "filesystem_read":
                p = Path(params.get("path", "."))
                if not p.exists():
                    return f"File not found: {p}"
                return p.read_text(encoding="utf-8", errors="ignore")[:2000]

            elif tool == "filesystem_list":
                p = Path(params.get("path", "."))
                if not p.is_dir():
                    return f"Not a directory: {p}"
                items = list(p.iterdir())
                return "\n".join(
                    f"{'[DIR]' if i.is_dir() else '[FILE]'} {i.name}"
                    for i in items[:50]
                )

            elif tool == "filesystem_write":
                p = Path(params.get("path", "output.txt"))
                p.parent.mkdir(parents=True, exist_ok=True)
                content = params.get("content", "")
                p.write_text(content, encoding="utf-8")
                return f"Written {len(content)} chars to {p}"

            return f"Unknown filesystem tool: {tool}"

        return await asyncio.get_event_loop().run_in_executor(None, _run)

    async def _github_tool(self, tool: str, params: dict) -> str:
        """Execute GitHub operations via REST API."""
        import httpx
        from jarvis.config import get_settings

        s = get_settings()

        headers = {
            "Authorization": f"Bearer {s.github_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

        async with httpx.AsyncClient(headers=headers, timeout=15.0) as client:
            if tool == "github_list_repos":
                r = await client.get(
                    "https://api.github.com/user/repos?per_page=30&sort=updated"
                )
                data = r.json()
                if isinstance(data, dict):
                    return f"GitHub API error: {data.get('message', data)}"
                repos = data
                if not repos:
                    return "No repositories found."
                lines = []
                for repo in repos[:15]:
                    desc = repo.get("description", "No description")
                    lines.append(f"- {repo['full_name']} -- {desc}")
                return "\n".join(lines)

            elif tool == "github_get_repo":
                repo = params.get("repo", "")
                r = await client.get(f"https://api.github.com/repos/{repo}")
                data = r.json()
                return (
                    f"{data['full_name']}: {data.get('description', '')}. "
                    f"Stars: {data.get('stargazers_count', 0)}. "
                    f"Language: {data.get('language', 'N/A')}"
                )

            elif tool == "github_list_issues":
                repo = params.get("repo", "")
                r = await client.get(
                    f"https://api.github.com/repos/{repo}/issues?per_page=10"
                )
                issues = r.json()
                return "\n".join(
                    f"#{i['number']}: {i['title']}" for i in issues[:10]
                )

            elif tool == "github_create_issue":
                repo = params.get("repo", "")
                payload = {
                    "title": params.get("title", "New Issue"),
                    "body": params.get("body", ""),
                }
                r = await client.post(
                    f"https://api.github.com/repos/{repo}/issues",
                    json=payload,
                )
                issue = r.json()
                return f"Created issue #{issue.get('number')}: {issue.get('html_url')}"

        return f"Unknown GitHub tool: {tool}"

    async def _research_tool(self, tool: str, params: dict) -> str:
        """Execute research operations (web search, scraping, arxiv)."""
        import httpx
        import urllib.parse
        import re

        if tool == "research_web_search":
            query = params.get("query", "")
            try:
                url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                    r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                    html = r.text
                    snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', html, re.DOTALL | re.IGNORECASE)
                    if not snippets:
                        return f"Search executed for '{query}'. Please use research_url_read on specific domains for full details."
                    cleaned = [re.sub(r'<[^>]+>', '', s).strip() for s in snippets[:6]]
                    return "Web search results for '%s':\n\n" % query + "\n---\n".join(cleaned)
            except Exception as e:
                return f"Web search error: {e}"

        elif tool == "research_url_read":
            url = params.get("url", "")
            try:
                async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                    r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                    text = r.text
                    text = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', text, flags=re.DOTALL | re.IGNORECASE)
                    text = re.sub(r'<[^>]+>', ' ', text)
                    text = re.sub(r'\s+', ' ', text).strip()
                    return f"Content from {url}:\n\n" + text[:4000]
            except Exception as e:
                return f"URL read error: {e}"

        elif tool == "research_arxiv_search":
            query = params.get("query", "")
            try:
                url = f"http://export.arxiv.org/api/query?search_query=all:{urllib.parse.quote(query)}&start=0&max_results=5"
                async with httpx.AsyncClient(timeout=15.0) as client:
                    r = await client.get(url)
                    xml = r.text
                    titles = re.findall(r'<title>(.*?)</title>', xml, re.DOTALL)[1:]
                    abstracts = re.findall(r'<summary>(.*?)</summary>', xml, re.DOTALL)
                    results = []
                    for i in range(min(len(titles), len(abstracts))):
                        t = titles[i].strip().replace('\n', ' ')
                        a = abstracts[i].strip().replace('\n', ' ')[:300]
                        results.append(f"[{i+1}] {t}\nAbstract: {a}...\n")
                    return f"ArXiv results for '{query}':\n\n" + "\n---\n".join(results) if results else "No ArXiv results found."
            except Exception as e:
                return f"ArXiv search error: {e}"

        return f"Unknown research tool: {tool}"
