import b3IndexProxy from "../platform/backend/api/b3-index-proxy.ts";
import b3OfficialIndex from "../platform/backend/api/b3-official-index.ts";
import fedBrief from "../platform/backend/api/fed-brief.ts";
import radarNews from "../platform/backend/api/radar-news.ts";
import radarSec from "../platform/backend/api/radar-sec.ts";
import techTrends from "../platform/backend/api/tech-trends.ts";
import yahooFinance from "../platform/backend/api/yf-proxy.ts";
import nvAgentChat from "../api/nv-agent-chat.ts";
import nvAgentUnderstand from "../api/nv-agent-understand.ts";
import nvAgentLocalize from "../api/nv-agent-localize.ts";

type QueryValue = string | string[];
type LegacyRequest = {
  method?: string;
  url?: string;
  query: Record<string, QueryValue>;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type LegacyResponse = {
  statusCode: number;
  status(code: number): LegacyResponse;
  setHeader(name: string, value: string | number | readonly string[]): void;
  json(body: unknown): void;
  send(body: unknown): void;
  end(body?: unknown): void;
};
type LegacyHandler = (req: LegacyRequest, res: LegacyResponse) => void | Promise<void>;

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SEC_USER_AGENT?: string;
}

const postHandlers: Record<string, LegacyHandler> = {
  "/api/nv-agent-chat": nvAgentChat as unknown as LegacyHandler,
  "/api/nv-agent-understand": nvAgentUnderstand as unknown as LegacyHandler,
  "/api/nv-agent-localize": nvAgentLocalize as unknown as LegacyHandler,
};

const handlers: Record<string, LegacyHandler> = {
  "/api/b3-index-proxy": b3IndexProxy as unknown as LegacyHandler,
  "/api/b3-official-index": b3OfficialIndex as unknown as LegacyHandler,
  "/api/fed-brief": fedBrief as unknown as LegacyHandler,
  "/api/radar-news": radarNews as unknown as LegacyHandler,
  "/api/radar-sec": radarSec as unknown as LegacyHandler,
  "/api/tech-trends": techTrends as unknown as LegacyHandler,
  "/api/yf-proxy": yahooFinance as unknown as LegacyHandler,
};

function toQuery(searchParams: URLSearchParams): Record<string, QueryValue> {
  const query: Record<string, QueryValue> = {};
  for (const [key, value] of searchParams) {
    const previous = query[key];
    query[key] = previous === undefined
      ? value
      : Array.isArray(previous) ? [...previous, value] : [previous, value];
  }
  return query;
}

function rewriteLegacyPaths(url: URL): URL {
  const rewritten = new URL(url);
  const yahooPath = url.pathname.match(/^\/yf-proxy(\/.*)$/);
  const officialB3 = url.pathname.match(/^\/b3-official-index\/([^/]+)\/?$/);
  const dailyB3 = url.pathname.match(/^\/b3-index-proxy\/indices\/([^/]+)\/precos\/?$/);

  if (yahooPath) {
    rewritten.pathname = "/api/yf-proxy";
    rewritten.searchParams.set("path", yahooPath[1]);
  } else if (officialB3) {
    rewritten.pathname = "/api/b3-official-index";
    rewritten.searchParams.set("symbol", decodeURIComponent(officialB3[1]));
  } else if (dailyB3) {
    rewritten.pathname = "/api/b3-index-proxy";
    rewritten.searchParams.set("symbol", decodeURIComponent(dailyB3[1]));
  }
  return rewritten;
}

async function runLegacyHandler(
  request: Request,
  url: URL,
  handler: LegacyHandler,
  allowedMethod: "GET" | "POST" = "GET",
): Promise<Response> {
  if (request.method !== allowedMethod) {
    return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { Allow: allowedMethod } });
  }

  let requestBody: unknown;
  if (allowedMethod === "POST") {
    try {
      requestBody = await request.json();
    } catch {
      return Response.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  const req: LegacyRequest = {
    method: request.method,
    url: url.pathname + url.search,
    query: toQuery(url.searchParams),
    body: requestBody,
    headers: Object.fromEntries(request.headers.entries()),
  };
  const headers = new Headers();
  let statusCode = 200;
  let body: BodyInit | null = null;

  const res: LegacyResponse = {
    statusCode,
    status(code) {
      statusCode = code;
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
    },
    json(value) {
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json; charset=utf-8");
      body = JSON.stringify(value);
    },
    send(value) {
      body = value as BodyInit;
    },
    end(value) {
      body = value === undefined ? null : value as BodyInit;
    },
  };

  await handler(req, res);
  return new Response(body, { status: statusCode, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const originalUrl = new URL(request.url);
    const apiUrl = rewriteLegacyPaths(originalUrl);
    const postHandler = postHandlers[apiUrl.pathname];
    if (postHandler) {
      return runLegacyHandler(request, apiUrl, postHandler, "POST");
    }

    const handler = handlers[apiUrl.pathname];
    if (handler) {
      return runLegacyHandler(request, apiUrl, handler);
    }

    if (apiUrl.pathname.startsWith("/api/")) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
};
