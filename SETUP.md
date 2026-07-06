# J.A.R.V.I.S — Setup Guide

## Prerequisites

Install these once (system-level):

```powershell
# 1. Install uv (fast Python package manager)
pip install uv

# 2. Install Node.js 20 LTS (for MCP servers)
# Download from: https://nodejs.org/en/download/

# 3. Install ffmpeg (for audio processing)
winget install Gyan.FFmpeg

# 4. Install Visual C++ Build Tools (for PyAudio on Windows)
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
# Select: "Desktop development with C++"
```

## Install JARVIS

```powershell
# From the project directory:
cd "d:\Projects\Project J.A.R.V.I.S"

# Install all Python dependencies
uv sync

# Install Playwright Chromium browser
uv run playwright install chromium

# (Optional) Install MCP Node servers
npm install -g @modelcontextprotocol/server-filesystem
npm install -g @modelcontextprotocol/server-github
```

## Run JARVIS

```powershell
# Start the full system (voice + dashboard)
uv run python -m jarvis.main

# Or use the CLI shortcut (after uv sync)
uv run jarvis
```

Open your browser to **http://localhost:7779** for the dashboard.

Say **"Hey JARVIS"** to activate voice.

## Run Tests

```powershell
# Run all tests
uv run pytest tests/ -v

# Run just Phase 1 (backbone) tests
uv run pytest tests/test_phase1_backbone.py -v -s

# Run just Phase 4 (MCP/Obsidian) tests — no internet needed
uv run pytest tests/test_phase4_mcp.py -v -s
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `PyAudio install fails` | Install Visual C++ Build Tools first |
| `ffmpeg not found` | Run `winget install Gyan.FFmpeg`, restart terminal |
| `No module named sounddevice` | Run `uv sync` again |
| `Coqui model download slow` | First run downloads ~500MB, cached after that |
| `OpenRouter 401 error` | Check `OPENROUTER_API_KEY` in `.env` |
| `Obsidian vault not found` | Check `OBSIDIAN_VAULT_PATH` in `.env` |
| `Mic not detected` | Set `MIC_DEVICE_INDEX` to your device number in `.env` |
