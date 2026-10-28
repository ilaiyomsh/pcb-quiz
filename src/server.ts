import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createChatSession, runTurn, type ChatConfig, type ChatEvent, type TurnState } from "./chat.ts";

const PORT = Number(process.env.PORT ?? 3000);
const MAX_MESSAGE_CHARS = 2000;
const MAX_TURNS_PER_SESSION = 12;
const MAX_SESSIONS_PER_IP_PER_HOUR = 10;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

const agentId = process.env.TWYST_AGENT_ID;
const environmentId = process.env.TWYST_ENVIRONMENT_ID;
if (!agentId || !environmentId) {
  console.error("Set TWYST_AGENT_ID and TWYST_ENVIRONMENT_ID (copy them from claude-lock.json after `ant apply`).");
  process.exit(1);
}

const agentVersion = Number(process.env.TWYST_AGENT_VERSION) || undefined;
const config: ChatConfig = {
  agentId,
  agentVersion,
  environmentId,
  budgetCents: process.env.SESSION_BUDGET_CENTS ?? "100",
  workspace: process.env.ANTHROPIC_WORKSPACE ?? "default",
};
const client = new Anthropic();
const indexHtml = await readFile(join(import.meta.dirname, "..", "public", "index.html"));

// Sessions this server created. A session ID from the browser is accepted only if it is in here.
const sessions = new Map<string, TurnState & { busy: boolean; turns: number; createdAt: number }>();
const sessionStartsByIp = new Map<string, number[]>();

// Behind a reverse proxy every request comes from the proxy, so the client address is read from a header
// the proxy sets. It must be one the proxy overwrites on every request (Fly.io: fly-client-ip), otherwise
// visitors can send their own value and get around the per-IP limit.
const clientIpHeader = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();

function clientIp(req: IncomingMessage): string {
  if (clientIpHeader) {
    const value = req.headers[clientIpHeader];
    const ip = (Array.isArray(value) ? value[0] : value)?.trim();
    if (ip) return ip;
  }
  return req.socket.remoteAddress ?? "unknown";
}

function allowNewSession(ip: string): boolean {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = (sessionStartsByIp.get(ip) ?? []).filter((t) => t > hourAgo);
  if (recent.length >= MAX_SESSIONS_PER_IP_PER_HOUR) return false;
  recent.push(Date.now());
  sessionStartsByIp.set(ip, recent);
  return true;
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, state] of sessions) if (state.createdAt < cutoff && !state.busy) sessions.delete(id);
  for (const [ip, starts] of sessionStartsByIp) if (starts.every((t) => t < Date.now() - 60 * 60 * 1000)) sessionStartsByIp.delete(ip);
}, 10 * 60 * 1000).unref();

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage, limitBytes: number): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw new Error("body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: { sessionId?: unknown; message?: unknown };
  try {
    body = (await readJson(req, 16_000)) as typeof body;
  } catch {
    return sendJson(res, 400, { error: "invalid_body" });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > MAX_MESSAGE_CHARS) return sendJson(res, 400, { error: "invalid_message" });

  let sessionId = typeof body.sessionId === "string" ? body.sessionId : undefined;
  if (sessionId) {
    const state = sessions.get(sessionId);
    if (!state) return sendJson(res, 404, { error: "unknown_session" });
    if (state.busy) return sendJson(res, 409, { error: "turn_in_progress" });
    if (state.turns >= MAX_TURNS_PER_SESSION) return sendJson(res, 429, { error: "turn_limit" });
  } else {
    if (!allowNewSession(clientIp(req))) return sendJson(res, 429, { error: "rate_limited" });
    try {
      sessionId = await createChatSession(client, config);
    } catch (err) {
      console.error("session create failed:", err);
      return sendJson(res, 502, { error: "session_create_failed" });
    }
    sessions.set(sessionId, { busy: false, turns: 0, createdAt: Date.now() });
  }

  const state = sessions.get(sessionId)!;
  state.busy = true;
  state.turns += 1;

  res.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
  // The turn keeps running if the visitor closes the tab, so a pending tool call still gets answered.
  const emit = (event: ChatEvent) => {
    if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  emit({ type: "session", sessionId });
  try {
    await runTurn(client, sessionId, message, state, emit);
  } catch (err) {
    console.error(`turn failed in ${sessionId}:`, err);
    emit({ type: "error", message: "משהו השתבש אצלנו. אפשר לנסות שוב בעוד רגע." });
  } finally {
    state.busy = false;
    emit({ type: "done" });
    res.end();
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(indexHtml);
  } else if (req.method === "POST" && url.pathname === "/api/chat") {
    handleChat(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) sendJson(res, 500, { error: "internal" });
      else res.end();
    });
  } else {
    sendJson(res, 404, { error: "not_found" });
  }
});

server.listen(PORT, () => console.log(`Twyst discovery chat on http://localhost:${PORT}`));
