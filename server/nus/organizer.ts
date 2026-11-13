import { generateLLMText } from "../config.ts";
import { NusMilestone } from "../brain/state.ts";

class NusDesktopOrganizer {
  private milestones: NusMilestone[] = [
    {
      id: "nus-1",
      title: "Benchmark Jev System-1 Reflex Latency (<200ms)",
      courseOrProject: "OpenJarvis Core",
      dueDate: "2026-11-15",
      priority: "high",
      status: "done",
      notes: "Verified deterministic + low-thinking reflex triage pipeline.",
    },
    {
      id: "nus-2",
      title: "Wire vercel-labs/agent-desktop @ref Tree Snapshot",
      courseOrProject: "Desktop Automation",
      dueDate: "2026-11-16",
      priority: "high",
      status: "in_progress",
      notes: "Expose @e1..@e17 semantic nodes with click/type/focus JSON envelopes.",
    },
    {
      id: "nus-3",
      title: "Complete CS3216 / AI Systems Architecture Review",
      courseOrProject: "NŪS Semester Companion",
      dueDate: "2026-11-19",
      priority: "medium",
      status: "todo",
      notes: "Synthesize lecture notes in Obsidian vault with trace telemetry.",
    },
    {
      id: "nus-4",
      title: "Ship Expressive Digital-Pet Pill Overlay Physics",
      courseOrProject: "Codex Visual Revamp",
      dueDate: "2026-11-17",
      priority: "high",
      status: "in_progress",
      notes: "8 mood states with cursor gaze tracking in bottom-right corner.",
    },
  ];

  public listMilestones(): NusMilestone[] {
    return [...this.milestones];
  }

  public addMilestone(item: Omit<NusMilestone, "id">): NusMilestone {
    const created: NusMilestone = {
      ...item,
      id: `nus-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    };
    this.milestones.unshift(created);
    return created;
  }

  public updateMilestoneStatus(
    id: string,
    status: NusMilestone["status"]
  ): NusMilestone | null {
    const target = this.milestones.find((m) => m.id === id);
    if (!target) return null;
    target.status = status;
    return { ...target };
  }

  public deleteMilestone(id: string): boolean {
    const before = this.milestones.length;
    this.milestones = this.milestones.filter((m) => m.id !== id);
    return this.milestones.length < before;
  }

  public async handleNaturalCommand(userText: string): Promise<{
    summary: string;
    milestones: NusMilestone[];
  }> {
    const lower = userText.toLowerCase();

    // Fast deterministic add
    const addMatch = userText.match(
      /(?:add|create|schedule|remind me to|new)\s+(?:task|milestone|deadline|assignment)?\s*[:\-]?\s*["']?(.+?)["']?(?:\s+(?:by|on|due)\s+(\d{4}-\d{2}-\d{2}|\w+\s+\d{1,2}))?$/i
    );
    if (
      addMatch &&
      (lower.includes("add") ||
        lower.includes("create") ||
        lower.includes("schedule") ||
        lower.includes("deadline") ||
        lower.includes("milestone") ||
        lower.includes("task"))
    ) {
      const rawTitle = addMatch[1].trim();
      if (rawTitle.length > 3 && rawTitle.length < 140) {
        const due = addMatch[2] || new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
        const created = this.addMilestone({
          title: rawTitle,
          courseOrProject: "Jev Quick Capture",
          dueDate: due,
          priority: lower.includes("urgent") || lower.includes("high") ? "high" : "medium",
          status: "todo",
        });
        return {
          summary: `Added NŪS milestone "${created.title}" (Due: ${created.dueDate}, Priority: ${created.priority}).`,
          milestones: this.listMilestones(),
        };
      }
    }

    // Complete / mark done
    if (lower.includes("complete") || lower.includes("mark") || lower.includes("done")) {
      const todo = this.milestones.find((m) => m.status !== "done");
      if (todo) {
        todo.status = "done";
        return {
          summary: `Marked milestone "${todo.title}" as completed.`,
          milestones: this.listMilestones(),
        };
      }
    }

    // Parse syllabus / multi-deadline text via LLM if longer text
    if (userText.split(/\s+/).length > 15 || lower.includes("parse") || lower.includes("syllabus")) {
      try {
        const res = await generateLLMText({
          systemInstruction: `You are the NŪS Desktop Companion organizer. Extract 1 to 3 actionable milestones/deadlines from the user's request.
Respond ONLY as a JSON array of objects:
[{"title": "...", "courseOrProject": "...", "dueDate": "YYYY-MM-DD", "priority": "high|medium|low"}]`,
          prompt: userText,
          thinkingLevel: "low",
          responseMimeType: "application/json",
        });
        const parsed = JSON.parse(res.text) as Array<{
          title?: string;
          courseOrProject?: string;
          dueDate?: string;
          priority?: "high" | "medium" | "low";
        }>;
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed.slice(0, 3)) {
            if (item.title) {
              this.addMilestone({
                title: item.title,
                courseOrProject: item.courseOrProject || "NŪS Syllabus Extract",
                dueDate: item.dueDate || "2026-11-22",
                priority: item.priority || "medium",
                status: "todo",
              });
            }
          }
          return {
            summary: `Extracted and scheduled ${parsed.length} milestone(s) into NŪS Organizer.`,
            milestones: this.listMilestones(),
          };
        }
      } catch {
        // Fall through to summary
      }
    }

    const pending = this.milestones.filter((m) => m.status !== "done");
    const lines = pending.map(
      (m) => `• [${m.priority.toUpperCase()}] ${m.title} (${m.courseOrProject}) — Due ${m.dueDate} [${m.status}]`
    );
    return {
      summary:
        pending.length > 0
          ? `You have ${pending.length} active NŪS milestone(s):\n${lines.join("\n")}`
          : "All NŪS milestones are currently complete!",
      milestones: this.listMilestones(),
    };
  }
}

export const nusOrganizer = new NusDesktopOrganizer();
