import http from "node:http";
import { mkdirSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

const HOST = process.env.WEBHOOK_HOST || "127.0.0.1";
const PORT = Number(process.env.WEBHOOK_PORT || 8787);

const logDir = path.join(process.cwd(), ".webhook-connector");
const logFile = path.join(logDir, "jobs.jsonl");

mkdirSync(logDir, { recursive: true });

function json(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload, null, 2));
}

function readJson(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => {
      body += String(c);
      if (body.length > 2_000_000) body = body.slice(-2_000_000);
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => resolve(null));
  });
}

function nowIso() {
  return new Date().toISOString();
}

function receiptId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function tailJsonl(limit = 50) {
  try {
    const raw = readFileSync(logFile, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    const last = lines.slice(-Math.max(1, Math.min(200, limit)));
    return last
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || HOST}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  if (req.method === "GET" && url.pathname === "/") {
    const list = tailJsonl(60);
    const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Webhook Connector</title>
<style>
  body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial; margin:24px; background:#0b0f18; color:#e5e7eb;}
  .card{border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); border-radius:16px; padding:16px; margin:12px 0;}
  a{color:#93c5fd}
  pre{white-space:pre-wrap; font-size:12px; line-height:1.4; background:rgba(0,0,0,.35); border:1px solid rgba(255,255,255,.08); padding:12px; border-radius:12px; overflow:auto; max-height:48vh;}
  .row{display:flex; gap:12px; flex-wrap:wrap; align-items:center;}
  .pill{font-size:12px; padding:4px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.14); background:rgba(255,255,255,.06);}
  .muted{color:rgba(229,231,235,.7); font-size:12px}
  code{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;}
</style>
<body>
  <h1 style="margin:0 0 8px 0;">Webhook Connector</h1>
  <div class="muted">Example server for OpenClaw OS auto-publish (BYO connector).</div>
  <div class="card">
    <div class="row">
      <span class="pill">POST <code>/webhook/publish</code></span>
      <span class="pill">GET <code>/health</code></span>
      <span class="pill">GET <code>/jobs</code></span>
      <span class="pill">GET <code>/jobs/:id</code></span>
    </div>
    <div class="muted" style="margin-top:10px;">Logs: <code>${logFile}</code></div>
  </div>

  <div class="card">
    <div class="row" style="justify-content:space-between;">
      <div style="font-weight:700;">Recent jobs (${list.length})</div>
      <div class="muted">Updated: ${nowIso()}</div>
    </div>
    <pre>${JSON.stringify(list.slice().reverse(), null, 2)}</pre>
  </div>
</body></html>`;
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    });
    return res.end(html);
  }

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, name: "agentcore-os-webhook-connector", time: nowIso() });
  }

  if (req.method === "GET" && url.pathname === "/jobs") {
    const limit = Number(url.searchParams.get("limit") || 50);
    const list = tailJsonl(Number.isFinite(limit) ? limit : 50);
    return json(res, 200, { ok: true, jobs: list.slice().reverse() });
  }

  if (req.method === "GET" && url.pathname.startsWith("/jobs/")) {
    const id = url.pathname.slice("/jobs/".length).trim();
    const list = tailJsonl(200);
    const found = list.find((j) => j && String(j.id) === id) || null;
    if (!found) return json(res, 404, { ok: false, error: "Job not found" });
    return json(res, 200, { ok: true, job: found });
  }

  if (req.method === "POST" && url.pathname === "/webhook/publish") {
    const payload = await readJson(req);
    if (!payload || typeof payload !== "object") {
      return json(res, 400, { ok: false, error: "Invalid JSON body" });
    }

    const platform = String(payload.platform || "").trim();
    const title = String(payload.title || "").trim();
    const body = String(payload.body || "").trim();
    const hashtags = Array.isArray(payload.hashtags) ? payload.hashtags.map(String) : [];
    const dryRun = payload.dryRun !== false ? true : false;
    const token = String(payload.token || "").trim();

    if (!platform || !title || !body) {
      return json(res, 400, { ok: false, error: "Missing platform/title/body" });
    }

    const id = receiptId();
    const record = {
      id,
      receivedAt: nowIso(),
      platform,
      dryRun,
      tokenPresent: Boolean(token),
      title,
      body,
      hashtags,
      userAgent: req.headers["user-agent"] || "",
      ip: req.socket.remoteAddress || "",
    };

    try {
      appendFileSync(logFile, `${JSON.stringify(record)}\n`, "utf8");
    } catch {
      // ignore logging errors
    }

    // This is an example connector. Replace this section with real publisher logic
    // (official APIs / approved partners / your own internal workflow).
    return json(res, 200, {
      ok: true,
      id,
      platform,
      dryRun,
      message: dryRun ? "Dry-run accepted" : "Queued (example connector)",
      logFile,
    });
  }

  return json(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[webhook-connector] listening on http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[webhook-connector] log -> ${logFile}`);
});
