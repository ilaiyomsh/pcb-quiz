import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const LEADS_DIR = join(import.meta.dirname, "..", "leads");

export interface DiscoverySummary {
  contact?: {
    name?: string;
    organization?: string;
    role?: string;
    email?: string;
    phone?: string;
  };
  organization_profile?: string;
  pain_points: Array<{
    title: string;
    details: string;
    impact?: string;
    ai_direction?: string;
  }>;
  tools_in_use?: string[];
  urgency?: "high" | "medium" | "low" | "unknown";
  team_summary: string;
  consent_to_contact: boolean;
}

// The agent's tool input is model output, so check the fields we rely on before saving.
export function parseDiscoverySummary(input: unknown): DiscoverySummary | string {
  if (typeof input !== "object" || input === null) return "input must be an object";
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.pain_points)) return "pain_points must be an array";
  for (const point of value.pain_points) {
    if (typeof point?.title !== "string" || typeof point?.details !== "string") {
      return "each pain point needs title and details";
    }
  }
  if (typeof value.team_summary !== "string" || value.team_summary.trim() === "") {
    return "team_summary must be a non-empty string";
  }
  if (typeof value.consent_to_contact !== "boolean") return "consent_to_contact must be a boolean";
  return value as unknown as DiscoverySummary;
}

export async function saveLead(sessionId: string, summary: DiscoverySummary): Promise<string> {
  await mkdir(LEADS_DIR, { recursive: true });
  const savedAt = new Date().toISOString();
  const file = join(LEADS_DIR, `${savedAt.replace(/[:.]/g, "-")}-${sessionId}.json`);
  await writeFile(file, JSON.stringify({ savedAt, sessionId, ...summary }, null, 2), "utf8");
  return file;
}
