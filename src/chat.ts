import Anthropic from "@anthropic-ai/sdk";
import type { BetaManagedAgentsAgentCustomToolUseEvent } from "@anthropic-ai/sdk/resources/beta/sessions/events";
import { parseDiscoverySummary, saveLead } from "./leads.ts";
import { parseVisitorQuestions, type VisitorQuestion } from "./questions.ts";

// Events the server forwards to the browser over SSE.
export type ChatEvent =
  | { type: "session"; sessionId: string }
  | { type: "delta"; id: string; text: string }
  | { type: "message"; id: string; text: string }
  | { type: "question"; questions: VisitorQuestion[] }
  | { type: "lead_saved" }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ChatConfig {
  agentId: string;
  // Unset means the agent's latest version, so `ant apply` changes live conversations right away.
  agentVersion?: number;
  environmentId: string;
  budgetCents: string;
  workspace: string;
}

// Per-session state that outlives a turn. While the agent waits on an ask_visitor call, the session
// accepts only that call's result, so the visitor's next message is sent as the result.
export interface TurnState {
  pendingQuestionId?: string;
}

export async function createChatSession(client: Anthropic, config: ChatConfig): Promise<string> {
  const session = await client.beta.sessions.create({
    agent: config.agentVersion ? { type: "agent", id: config.agentId, version: config.agentVersion } : config.agentId,
    environment_id: config.environmentId,
    title: `Twyst discovery chat ${new Date().toISOString()}`,
    // Hard spend cap per visitor conversation; amount is in cents.
    budget: { type: "limit", max_list_cost: { amount: config.budgetCents, currency: "USD" } },
  });
  console.log(`session ${session.id}: https://platform.claude.com/workspaces/${config.workspace}/sessions/${session.id}`);
  return session.id;
}

// Sends one visitor message and streams the agent's reply until the turn ends, or until the agent
// asks the visitor a question with buttons (then the turn ends with state.pendingQuestionId set).
export async function runTurn(
  client: Anthropic,
  sessionId: string,
  text: string,
  state: TurnState,
  emit: (event: ChatEvent) => void,
): Promise<void> {
  // Stream first, then send, so no early event is missed.
  const stream = await client.beta.sessions.events.stream(sessionId, { event_deltas: ["agent.message"] });
  try {
    if (state.pendingQuestionId) {
      // A button choice or free text, either way it is the visitor's answer.
      await sendToolResult(client, sessionId, state.pendingQuestionId, text, false);
      state.pendingQuestionId = undefined;
    } else {
      await client.beta.sessions.events.send(sessionId, {
        events: [{ type: "user.message", content: [{ type: "text", text }] }],
      });
    }

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
          if (event.name === "ask_visitor") {
            const questions = parseVisitorQuestions(event.input);
            if (typeof questions === "string") {
              await sendToolResult(client, sessionId, event.id, `Invalid input: ${questions}. Fix the input and call the tool again.`, true);
            } else {
              // Answered on the visitor's next request, not here.
              state.pendingQuestionId = event.id;
              emit({ type: "question", questions });
            }
          } else {
            await answerCustomTool(client, sessionId, event, emit);
          }
          break;
        case "session.error":
          console.error(`session ${sessionId} error:`, event.error.type, event.error.message);
          break;
        case "session.status_idle":
          if (event.stop_reason.type === "requires_action") {
            // Waiting on the visitor ends the turn. Any other call it waits on was already answered; keep reading.
            if (state.pendingQuestionId && event.stop_reason.event_ids.includes(state.pendingQuestionId)) return;
            break;
          }
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
  if (event.name !== "save_discovery_summary") {
    return sendToolResult(client, sessionId, event.id, `Unknown tool: ${event.name}`, true);
  }
  const summary = parseDiscoverySummary(event.input);
  if (typeof summary === "string") {
    return sendToolResult(client, sessionId, event.id, `Invalid input: ${summary}. Fix the input and call the tool again.`, true);
  }
  const file = await saveLead(sessionId, summary);
  console.log(`lead saved: ${file}`);
  emit({ type: "lead_saved" });
  await sendToolResult(client, sessionId, event.id, "הסיכום נשמר והועבר לצוות Twyst.", false);
}

async function sendToolResult(client: Anthropic, sessionId: string, toolUseId: string, text: string, isError: boolean): Promise<void> {
  await client.beta.sessions.events.send(sessionId, {
    events: [
      {
        type: "user.custom_tool_result",
        custom_tool_use_id: toolUseId,
        content: [{ type: "text", text }],
        is_error: isError,
      },
    ],
  });
}
