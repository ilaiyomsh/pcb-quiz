import Anthropic from "@anthropic-ai/sdk";
import type { BetaManagedAgentsAgentCustomToolUseEvent } from "@anthropic-ai/sdk/resources/beta/sessions/events";
import { parseDiscoverySummary, saveLead } from "./leads.ts";

// Events the server forwards to the browser over SSE.
export type ChatEvent =
  | { type: "session"; sessionId: string }
  | { type: "delta"; id: string; text: string }
  | { type: "message"; id: string; text: string }
  | { type: "lead_saved" }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ChatConfig {
  agentId: string;
  environmentId: string;
  budgetCents: string;
  workspace: string;
}

export async function createChatSession(client: Anthropic, config: ChatConfig): Promise<string> {
  const session = await client.beta.sessions.create({
    agent: config.agentId,
    environment_id: config.environmentId,
    title: `Twyst discovery chat ${new Date().toISOString()}`,
    // Hard spend cap per visitor conversation; amount is in cents.
    budget: { type: "limit", max_list_cost: { amount: config.budgetCents, currency: "USD" } },
  });
  console.log(`session ${session.id}: https://platform.claude.com/workspaces/${config.workspace}/sessions/${session.id}`);
  return session.id;
}

// Sends one visitor message and streams the agent's reply until the turn ends.
export async function runTurn(
  client: Anthropic,
  sessionId: string,
  text: string,
  emit: (event: ChatEvent) => void,
): Promise<void> {
  // Stream first, then send, so no early event is missed.
  const stream = await client.beta.sessions.events.stream(sessionId, { event_deltas: ["agent.message"] });
  try {
    await client.beta.sessions.events.send(sessionId, {
      events: [{ type: "user.message", content: [{ type: "text", text }] }],
    });

    for await (const event of stream) {
      switch (event.type) {
        case "event_delta":
          emit({ type: "delta", id: event.event_id, text: event.delta.content.text });
          break;
        case "agent.message": {
          const message = event.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
          emit({ type: "message", id: event.id, text: message });
          break;
        }
        case "agent.custom_tool_use":
          await answerCustomTool(client, sessionId, event, emit);
          break;
        case "session.error":
          console.error(`session ${sessionId} error:`, event.error.type, event.error.message);
          break;
        case "session.status_idle":
          // requires_action means the session waits on our tool result; keep reading.
          if (event.stop_reason.type === "requires_action") break;
          if (event.stop_reason.type === "budget_reached") {
            emit({ type: "error", message: "השיחה הגיעה לאורך המרבי. נשמח להמשיך בטלפון או במייל." });
          } else if (event.stop_reason.type !== "end_turn") {
            console.error(`session ${sessionId} stopped:`, event.stop_reason.type);
            emit({ type: "error", message: "משהו השתבש אצלנו. אפשר לנסות שוב בעוד רגע." });
          }
          return;
        case "session.status_terminated":
          emit({ type: "error", message: "השיחה הסתיימה. אפשר לפתוח שיחה חדשה." });
          return;
      }
    }
  } finally {
    stream.controller.abort();
  }
}

async function answerCustomTool(
  client: Anthropic,
  sessionId: string,
  event: BetaManagedAgentsAgentCustomToolUseEvent,
  emit: (event: ChatEvent) => void,
): Promise<void> {
  let result: string;
  let isError = false;

  if (event.name !== "save_discovery_summary") {
    result = `Unknown tool: ${event.name}`;
    isError = true;
  } else {
    const summary = parseDiscoverySummary(event.input);
    if (typeof summary === "string") {
      result = `Invalid input: ${summary}. Fix the input and call the tool again.`;
      isError = true;
    } else {
      const file = await saveLead(sessionId, summary);
      console.log(`lead saved: ${file}`);
      emit({ type: "lead_saved" });
      result = "הסיכום נשמר והועבר לצוות Twyst.";
    }
  }

  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.custom_tool_result",
        custom_tool_use_id: event.id,
        content: [{ type: "text", text: result }],
        is_error: isError,
      },
    ],
  });
}
