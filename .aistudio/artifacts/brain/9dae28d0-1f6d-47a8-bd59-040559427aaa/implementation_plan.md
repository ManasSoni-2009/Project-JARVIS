# Project J.A.R.V.I.S — Apple × Codex × Hedwig Studio UI & GSAP Pure-Avatar Pet Pill Redesign

A complete aesthetic and structural reimagining of J.A.R.V.I.S combining **Hedwig AI’s (`hedwig-ai.com`) calm Spatial Studio Canvas**, **Apple macOS & OpenAI Codex PC’s ultra-minimal rounded geometry**, and a **Pure All-Avatar GSAP Expressive Pet Pill** where the entire capsule *is* the character’s face—with zero split sections, zero text clutter inside the pill, and zero cheap neon glows.

---

## User Review & Confirmed Design Decisions

> [!IMPORTANT]
> Every design choice below incorporates your exact feedback and confirmed preferences. Review **Plan 1 (Engine & Spatial Frame Orchestration)** and **Plan 2 (Apple × Codex × Hedwig Visual Redesign & Pure-Avatar GSAP Pill)** and click **Proceed** to build.

- **Confirmed Decision 1 — The Pure Face Pill (Zero Text, Zero Split Sections, GSAP Morphing)**:
  - The bottom-right pill (`fixed bottom-6 right-6 z-50`) is **100% the character’s face**. There are no text labels, no divided left/right sections, and no cheap neon drop-shadows.
  - Powered by **GSAP (`gsap.timeline`, elastic squash-and-stretch, and SVG geometry morphing)**, the pill capsule itself breathes, tilts, squishes, widens, and morphs its expressive eyes, brows, and subtle voice waveform to communicate every system state (`idle`, `listening`, `reflex_zap`, `deep_thinking`, `acting_ref`, `speaking`, `celebrating`, `alert`).
- **Confirmed Decision 2 — Hedwig-Style Spatial Studio Canvas with Modular Floating Frames**:
  - Replaces the cramped multi-pane IDE clutter with a serene **Hedwig Studio Board** featuring a subtle architectural dot-grid backdrop, a centered **Codex Agent Conversation & Command Stage**, and clean, movable/toggleable **Apple-Rounded Studio Frames** (`rounded-[24px]`) for **Codex Diffs**, **Agent-Desktop `@ref` Control**, **NŪS Milestones & AI Outbox**, and **OpenJarvis Telemetry**—opened on-demand via a minimal bottom **Studio Dock** or `⌘K` Spotlight bar.
- **Confirmed Decision 3 — Seamless Apple Daylight & Pro Graphite Dark Mode Toggle**:
  - Full dual-theme architecture (`@custom-variant dark (&:where(.dark, .dark *));`) transitioning cleanly between **Apple Daylight Alabaster** (`#F5F5F7` studio canvas, `rgba(255,255,255,0.86)` frosted frames, `#1D1D1F` ink typography) and **Apple Pro Matte Graphite** (`#0A0A0C` studio canvas, `rgba(22,22,25,0.88)` frames, `#F5F5F7` typography).

---

## 1. Overview & Core Concept

- **What It Does**: Provides a calm, distraction-free Apple × Codex × Hedwig workspace for controlling the **OpenJarvis + Jev System-1 Reflex + `vercel-labs/agent-desktop` `@ref`** engine. Users interact through a refined floating composer and modular Studio Frames while an expressive, pure-avatar GSAP companion pill in the bottom-right corner conveys live agent cognition and voice state entirely through natural facial expressions and physical motion.
- **Target Audience / Persona**: Designers, engineers, and founders who demand Apple-grade craft, tactile GSAP animation, and Hedwig AI’s uncluttered spatial organization without sacrificing raw multi-agent speed.
- **Key Value**: Eradicates dashboard visual noise by elevating only the active task frame, enforces a human-in-the-loop **Hedwig AI Outbox** for code patches and desktop `@ref` actions, and transforms the overlay pill into an iconic, minimal hardware-grade companion character.

---

# PLAN 1 — THE AI ENGINE & HEDWIG STUDIO ORCHESTRATION
*(OpenJarvis 5-Primitive Core + `vercel-labs/agent-desktop` `@ref` + `Jev` Fast Reflexes + Hedwig AI Outbox)*

### 1.1 Jev System-1 Reflexes Driving GSAP Avatar Choreography
- Every user prompt or voice stream passes through the **Jev System-1 Fast Reflex Harness (`<20ms` deterministic + `ThinkingLevel.LOW` triage)** before or in parallel with **OpenJarvis System-2 (`ThinkingLevel.HIGH`)**.
- Instead of dumping noisy raw logs onto the main screen, Jev emits structured **Choreography & Frame Events** over WebSocket (`/ws`):
  1. **`avatarExpression`**: Drives the GSAP timeline on the Pure-Avatar Pill (`curious_tilt`, `reflex_squint`, `listening_widen`, `thinking_look_up`, `laser_ref_scan`, `speaking_pulse`, `happy_arc`, `alert_blink`).
  2. **`autoFocusFrame`**: Smoothly reveals only the relevant Hedwig Studio Frame (`diff_frame`, `desktop_ref_frame`, `nus_outbox_frame`, or `telemetry_frame`) when an action produces a diff, targets an `@e1..@e17` ref, or schedules a milestone.
  3. **`outboxProposal` (Hedwig "Looks, Never Touches" Safety Pattern)**: Code patches and sensitive actions appear as clean cards in the **AI Outbox / Review Strip** for 1-click human approval (**Approve & Apply** or **Dismiss**).

### 1.2 Preserved & Hardened Multi-Agent Capabilities
- **OpenJarvis 5 Primitives**: `Intelligence` (`ModelRegistry`), `Engine` (`InferenceEngine` with System-1/System-2 latency tracking), `Agentic Logic` (7 specialist agents), `Tools & Memory` (MCP GitHub/ArXiv + Obsidian Vault), and `Learning` (`OpenJarvisTrace` feedback loop).
- **`vercel-labs/agent-desktop` Accessibility-Tree Engine**: Full semantic `@e1`–`@e17` ref indexing (`snapshot`, `click`, `type`, `focus`, `press`) with both the built-in Interactive Web Sandbox and the Local CLI Bridge (`/api/agent-desktop/bridge`).
- **`potlakai/nus-desktop` Companion**: Fast deadline, syllabus, and milestone capture integrated directly into the Studio Outbox & Tasks frame.

---

# PLAN 2 — THE COMPLETE VISUAL REDEMPTION
*(Apple × Codex PC × Hedwig Studio UI + GSAP Pure-Avatar Pet Pill)*

### 2.1 User Experience & Visual Design

- **Key User Flows**:
  1. **Calm Zero-Clutter Studio Canvas**: On launch, the user sees a clean, airy Hedwig Studio Canvas with a single centered **Codex Agent Card** (`max-w-[680px]`, `rounded-[28px]`), a minimal top navigation header, a bottom **macOS/Hedwig Studio Dock** for toggling modular frames (**Diffs**, **Desktop `@refs`**, **NŪS & Vault**, **Telemetry**, **Terminal Sheet**), and the **Pure-Avatar Pet Pill** resting in the bottom-right corner.
  2. **Modular Floating Studio Frames (Hedwig Board Style)**: When the user clicks a dock item or when Jev triggers a specialist tool (e.g., generating a code diff or clicking `@e4`), a crisp, rounded **Studio Frame** smoothly animates onto the canvas beside the conversation card with Apple spring physics (`cubic-bezier(0.22, 1, 0.36, 1)`). Users can close, minimize, or switch frames at any time so the screen never feels crowded.
  3. **Focus-Away / Pure Pill Overlay Flow**: When the user clicks **"Minimize to Companion"** or switches focus away from the main window, the Studio frames gracefully recede and the **Pure-Avatar GSAP Pill** becomes the sole focal companion—communicating listening, thinking, `@ref` scanning, and speaking states purely through its animated face.
- **Visual Identity & Theme (Seamless Light & Dark Mode)**:
  - *Light Mode (Apple Daylight Studio — Default)*:
    - **Studio Canvas**: `#F5F5F7` with subtle radial dot matrix (`#D2D2D7` at `0.8px`).
    - **Floating Frames & Cards**: `rgba(255, 255, 255, 0.88)` with `backdrop-filter: blur(24px)`, hairline border `1px solid rgba(0, 0, 0, 0.07)`, and soft elevation shadow `0 12px 36px -8px rgba(0, 0, 0, 0.06)`.
    - **Typography**: Primary `#1D1D1F`, Secondary `#515154`, Muted `#86868B`.
    - **Accents**: Apple System Ink `#1D1D1F` for primary buttons, Codex Blue `#0071E3` for active focus, Emerald `#10B981` for diff additions, Rose `#F43F5E` for diff deletions.
  - *Dark Mode (Apple Pro / Codex Graphite)*:
    - **Studio Canvas**: `#0A0A0C` with subtle dot matrix (`#27272A` at `0.8px`).
    - **Floating Frames & Cards**: `rgba(22, 22, 26, 0.88)` with `backdrop-filter: blur(24px)`, hairline border `1px solid rgba(255, 255, 255, 0.08)`, and shadow `0 16px 40px -8px rgba(0, 0, 0, 0.5)`.
    - **Typography**: Primary `#F5F5F7`, Secondary `#A1A1AA`, Muted `#71717A`.
  - *Typography & Hierarchy*:
    - **Display & UI Prose**: `Plus Jakarta Sans` with tight Apple-style tracking (`-0.015em` on headings) and generous whitespace.
    - **Code, Diffs & `@ref` Tokens**: `JetBrains Mono` with `tabular-nums`.

### 2.2 The Pure-Avatar GSAP Pet Pill (`PureFacePill.tsx`)
Designed from scratch to fix every flaw of the previous pill:

- **100% Character Face — Zero Text, Zero Split Sections, Zero Cheap Glows**:
  - The pill is a sleek, tactile, self-contained capsule (`width: 96px`, `height: 52px` in idle; morphing fluidly between `84px` and `118px` via GSAP depending on expression) with a smooth ceramic/matte finish (`#18181B` obsidian visor face in Light Mode for crisp contrast; warm pearl `#F4F4F5` or deep onyx with high-contrast eyes in Dark Mode) and a crisp `1.5px` physical rim—no neon blur shadows or text labels inside the pill.
- **GSAP Timeline & Physics Expression Engine**:
  - **Real-Time Saccadic Gaze & Parallax**: Eyes and subtle brow ridges track the cursor with damped GSAP `quickTo` interpolation (`gsap.quickTo`), creating depth as the face shifts slightly inside the capsule.
  - **8 High-Craft GSAP Expressions (Communicating State Without Text)**:
    1. **`idle` (Calm Companion)**: Soft pill proportions (`96×52px`), gentle breathing scale (`1 -> 1.02`), natural organic blink every 3–5s, and occasional curious head-tilt (`rotation: ±2.5deg`).
    2. **`listening` (Voice Active)**: Pill widens slightly (`108×54px`), eyes open wide and attentive with raised brow arcs, while 3 minimal acoustic micro-bars gently undulate between the eyes where a mouth sits.
    3. **`reflex_zap` (Jev System-1 `<20ms` Hit)**: Quick elastic horizontal squash-and-stretch (`scaleX: 1.14, scaleY: 0.88 -> elastic.out(1, 0.3)`), sharp focused chevron eyes `> <` or crisp star-pupils.
    4. **`deep_thinking` (OpenJarvis System-2)**: Pill compresses slightly taller (`92×56px`), eyes glance upward-right in contemplation while one brow raises inquisitively and three tiny orbital dots float smoothly across the upper visor.
    5. **`acting_ref` (`agent-desktop` `@ref` Targeting)**: Precision visor squint—eyelids narrow into a sleek horizontal scan posture while pupils lock onto the active `@ref` coordinate.
    6. **`speaking` (Neural TTS Playback)**: Happy expressive eyes paired with a fluid, organic GSAP sine-wave mouth path that dances in rhythm with the spoken response.
    7. **`celebrating` (Task / Patch Applied)**: Joyful upward-curved arc eyes (`^ ^`) with a playful vertical hop (`y: -8 -> bounce.out`).
    8. **`alert` (Error / Attention)**: Quick surprised double-blink with widened pupils and a subtle horizontal shake.
- **Whisper-Clean Hover/Click Radial Bar (Outside the Pill)**:
  - The pill itself never contains buttons or text. When the user hovers or clicks the pet pill, a tiny, ultra-minimal Apple frosted micro-bar (`rounded-full`, 3 icon buttons: **Mic Talk**, **Focus Canvas Toggle**, **Status Tooltip**) floats `10px` *above* the pill and fades away cleanly when the cursor leaves.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Hedwig Modular Frames vs. Fixed 4-Pane Split Screen**:
  - *Chosen Approach*: Keep the primary **Codex Agent Stage** centered and breathable, and open **at most one** secondary **Studio Frame** side-by-side when inspecting diffs, `@ref` trees, NŪS tasks, or telemetry.
  - *Why*: Eliminates the cramped, overwhelming dashboard clutter while keeping every single tool (`Codex Diffs`, `Agent-Desktop @ref`, `OpenJarvis Traces`, `NŪS & Obsidian Vault`, and `Terminal Sheet`) 1 click away in the bottom Studio Dock.
- **Decision 2 — GSAP (`gsap.quickTo` + `gsap.timeline`) for the Pure-Avatar Pill**:
  - *Chosen Approach*: Use GSAP for 60fps imperative SVG attribute interpolation (`attr: { d }`, `scaleX`, `scaleY`, `x`, `y`, `rotation`) combined with React state hooks for WebSocket pipeline events.
  - *Why*: CSS keyframes alone feel robotic and repetitive. GSAP’s `elastic.out` and `power3.out` easing plus `quickTo` cursor tracking give the pill genuine digital-pet weight, anticipation, and life.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### 4.1 Visual & Component Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                 HEDWIG × APPLE × CODEX SPATIAL STUDIO CANVAS (Light / Dark)              │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Minimal Top Studio Bar:  [J.A.R.V.I.S]    [Studio · Diffs · Desktop · Vault]  [☼/☾]│  │
│  └────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
│      ┌──────────────────────────────────────────┐   ┌──────────────────────────────┐     │
│      │   PRIMARY CODEX AGENT STAGE              │   │  MODULAR STUDIO FRAME        │     │
│      │   (Rounded-3xl Frosted Apple Surface)    │   │  (Opens on-demand beside     │     │
│      │                                          │   │   stage, or closes for       │     │
│      │   • Clean Message Stream                 │   │   zero-clutter focus)        │     │
│      │   • Compact "Thought & @ref" Pill Toggle │   │                              │     │
│      │   • Hedwig AI Outbox Approval Card       │   │  • Frame A: Unified Diffs    │     │
│      │   • Minimal Rounded Composer             │   │  • Frame B: @ref Sandbox     │     │
│      │     (@context, Thinking Mode, Mic, Send) │   │  • Frame C: NŪS & Vault      │     │
│      └──────────────────────────────────────────┘   │  • Frame D: OpenJarvis Trace │     │
│                                                     └──────────────────────────────┘     │
│                                                                                          │
│                    ┌──────────────────────────────────────────────┐                      │
│                    │  Floating Apple/Hedwig Studio Dock           │                      │
│                    │  [Agent] [Diffs] [@ref] [NŪS/Vault] [Term]   │                      │
│                    └──────────────────────────────────────────────┘                      │
│                                                                                          │
│                                                                    ┌──────────────────┐  │
│                                                                    │   ( ◕      ◕ )   │  │
│                                                                    │        ‿         │  │
│                                                                    └──────────────────┘  │
│                                                                 Pure-Avatar GSAP Pet Pill│
│                                                                 (100% Face, Zero Text)   │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Interactive Component & State Mapping

- **`PureAvatarPill` (Bottom-Right GSAP Pet Companion)**:
  - Subscribes to `pillMood`, `pipelineState`, and `isRecording`.
  - Uses `gsap.quickTo` on the left/right eye groups and brow paths for smooth 60fps cursor tracking.
  - Runs dedicated GSAP timelines on state transitions (`reflex_zap` squash-and-stretch, `deep_thinking` orbital dots + upward gaze, `acting_ref` visor narrow, `speaking` waveform mouth modulation, `celebrating` happy bounce).
  - Clicking the pill triggers a tactile pet bounce and toggles a detached, ultra-clean floating micro-action bar above the pill (Mic, Minimize/Restore Studio, Expression Preview).
- **`HedwigStudioCanvas` & Modular Frames**:
  - Manages `activeFrame: "none" | "diff" | "desktop" | "nus_vault" | "telemetry"` and `terminalSheetOpen: boolean`.
  - When `activeFrame === "none"`, the **Codex Agent Stage** centers gracefully with maximum breathing room. When a frame is selected from the bottom Studio Dock (or auto-triggered by a Jev reflex), the stage and frame arrange into a balanced, airy 2-column Apple Studio layout with `24px` gap and matching `rounded-[24px]` radii.
- **Seamless Theme Controller**:
  - Persists `"light" | "dark"` in state and toggles `.dark` on `document.documentElement`, backed by `@custom-variant dark (&:where(.dark, .dark *));` in `src/index.css`.
