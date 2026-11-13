# J.A.R.V.I.S v3.0 (Release V3) — Architecture & Production Notes

## 1. Unified AI Engine
- **OpenJarvis 5-Primitive Core (`https://github.com/open-jarvis/openjarvis`)**:
  1. `Intelligence`: Multi-model cascade (`gemini-4-hydrogen` → `gemini-3.1-flash-lite` → `openjarvis-local-sys2`) + `gemini-3.5-transcribe` STT + `gemini-3.8-flash-lite-tts` Neural TTS (`Kore`, `Fenrir`, `Puck`, `Charon`, `Zephyr`).
  2. `Engine`: Ultra-low-latency LRU memory cache (`<1ms` cache hits) + streaming WebSocket event bus (`/ws`).
  3. `Agentic Logic`: 7-way specialist orchestration (`agent_desktop`, `codex_diff`, `nus_organizer`, `obsidian`, `mcp_tool`, `browser`, `chat`).
  4. `Tools & Memory`: Persistent multi-session memory (`./data/sessions.json`) with guaranteed monotonic turn IDs + Obsidian Second Brain markdown vault (`./data/vault`).
  5. `Learning`: Real-time `OpenJarvisTrace` telemetry tracking System-1 vs System-2 latency and energy efficiency scores.
- **Jev System-1 Fast Reflex Harness (`https://github.com/potlakai/nus-desktop` inspired)**:
  - Deterministic `<3ms` intent triage and multi-`@ref` extraction with zero pre-flight LLM network overhead.
  - Built-in NŪS Companion Milestone & Deadline Organizer.
- **`vercel-labs/agent-desktop` (`https://github.com/vercel-labs/agent-desktop`)**:
  - 17 semantic accessibility tree nodes (`@e1`–`@e17`) across 3 desktop surfaces with `snapshot`, `click`, `type`, `press`, and `focus` commands plus Local CLI Bridge mode (`ws://127.0.0.1:44820`).

## 2. Visual System (Apple × OpenAI Codex PC × Hedwig Studio)
- **Hedwig Memory Sidebar**: Collapsible thread manager with animated search filter, turn counts, and persistent session switching.
- **Concentric Spatial Studio Stage**: Unified segmented Inspector switcher (`Diffs`, `@ref`, `Vault`, `Traces`, `Term`), custom spring-animated `StudioDropdown` menus, and review-before-apply unified diff outbox.
- **Minimal Pure-Avatar Visor Pet Pill (`JevPetPill.tsx`)**: Hardware-grade bottom-right capsule containing 100% the character's geometric visor face with 60fps GSAP cursor tracking, poppy enlarge-and-return physics, rubber-band drag resistance, and voice harmonic equalizer.
