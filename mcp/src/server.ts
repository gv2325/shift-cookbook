/**
 * SHIFT MCP server: stateless Streamable HTTP at POST /mcp, JSON responses, no sign-in.
 * See docs/architecture/system-design.md §4.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServer } from './tools';
import { CITIES, RETRIEVED, SITE_URL } from './data';

const PORT = Number(process.env.PORT ?? 10000);
const MAX_BODY = 64 * 1024;
const RATE = { perMinute: 60, burst: 20 };
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? `${SITE_URL},https://claude.ai,https://chatgpt.com,https://chat.openai.com`)
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
);
const SALT = process.env.IP_HASH_SALT ?? randomBytes(16).toString('hex');
const STARTED = Date.now();

// ---- per-IP token bucket (one instance, so in-memory is enough) ----
const buckets = new Map<string, { tokens: number; at: number }>();
function allow(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: RATE.burst, at: now };
  b.tokens = Math.min(RATE.burst, b.tokens + ((now - b.at) / 60_000) * RATE.perMinute);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(ip, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(ip, b);
  return true;
}
setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [ip, b] of buckets) if (b.at < cutoff) buckets.delete(ip);
}, 60_000).unref();

const clientIp = (req: IncomingMessage) =>
  String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
const ipHash = (ip: string) => createHash('sha256').update(SALT + ip).digest('hex').slice(0, 12);

function log(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...entry }));
}

function cors(req: IncomingMessage, res: ServerResponse) {
  const origin = String(req.headers.origin ?? '').replace(/\/$/, '');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}

function json(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
}

const rpcError = (code: number, message: string) => ({ jsonrpc: '2.0', error: { code, message }, id: null });

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** Name of the tool being called, for logs only (never logs arguments). */
function describe(body: unknown): string {
  const msgs = Array.isArray(body) ? body : [body];
  return msgs
    .map((m) => (m && typeof m === 'object' ? ((m as any).method === 'tools/call' ? `tools/call:${(m as any).params?.name}` : (m as any).method) : '?'))
    .join(',');
}

async function handleMcp(req: IncomingMessage, res: ServerResponse) {
  const t0 = Date.now();
  const ip = clientIp(req);
  const origin = String(req.headers.origin ?? '').replace(/\/$/, '');
  // DNS-rebinding guard from the MCP spec: browsers send Origin; server-to-server clients don't.
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(res, 403, rpcError(-32000, 'Origin not allowed'));
  if (!allow(ip)) return json(res, 429, rpcError(-32000, 'Rate limit: 60 requests per minute. Try again shortly.'), { 'Retry-After': '10' });

  let body: unknown;
  try {
    const raw = await readBody(req);
    body = JSON.parse(raw);
  } catch (e) {
    const status = (e as { status?: number }).status ?? 400;
    return json(res, status, rpcError(status === 413 ? -32000 : -32700, status === 413 ? 'Request too large' : 'Parse error'));
  }

  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    transport.close();
    server.close();
    log({ ip: ipHash(ip), call: describe(body), status: res.statusCode, ms: Date.now() - t0 });
  });
  const timer = setTimeout(() => {
    if (!res.headersSent) json(res, 503, rpcError(-32000, 'Request timed out'));
  }, 10_000);
  res.on('finish', () => clearTimeout(timer));
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}

const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    cors(req, res);
    if (url.pathname === '/healthz') {
      return json(res, 200, { status: 'ok', cities: CITIES.length, dataRetrieved: RETRIEVED, uptimeS: Math.round((Date.now() - STARTED) / 1000) });
    }
    if (url.pathname === '/mcp') {
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        return res.end();
      }
      if (req.method === 'POST') return await handleMcp(req, res);
      return json(res, 405, rpcError(-32000, 'Method not allowed: this server is stateless and only accepts POST /mcp.'), { Allow: 'POST, OPTIONS' });
    }
    if (url.pathname === '/' && req.method === 'GET') {
      res.writeHead(302, { Location: `${SITE_URL}/connect` });
      return res.end();
    }
    return json(res, 404, { error: 'Not found. The MCP endpoint is POST /mcp.' });
  } catch (e) {
    log({ error: (e as Error).message });
    if (!res.headersSent) json(res, 500, rpcError(-32603, 'Internal error'));
  }
});

http.listen(PORT, () => log({ msg: `SHIFT MCP listening on :${PORT}`, site: SITE_URL, origins: [...ALLOWED_ORIGINS] }));
for (const sig of ['SIGTERM', 'SIGINT'] as const) process.on(sig, () => http.close(() => process.exit(0)));
