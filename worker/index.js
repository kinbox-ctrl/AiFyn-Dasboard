// AiFyn dashboard API on Cloudflare Workers.
// Reads the website's D1 database: `pageviews` (traffic beacon) and `leads` + `lead_events` (query management).
// Only /api/* reaches this code; the React app is served from static assets.

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const STATUSES = ["new", "contacted", "demo_scheduled", "proposal", "won", "lost", "spam"];
const PRIORITIES = ["low", "normal", "high"];
const CSV_COLUMNS = ["created_at", "status", "priority", "assignee", "name", "company", "industry", "cameras", "phone", "email", "city", "message", "source_page", "landing_page", "referrer", "utm_source", "utm_campaign"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const enc = new TextEncoder();
const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlText = (s) => b64url(enc.encode(s));
const fromB64urlText = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

async function sha256Hex(s) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

// Length-independent constant-time comparison (compares digests).
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

// Token: "<expiry>.<base64url name>.<hmac>". The name is who appears as author on notes and changes.
async function issueToken(env, name) {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  const n = b64urlText(name);
  return `${exp}.${n}.${await hmac(env.DASHBOARD_PASSWORD, `dash:${exp}:${n}`)}`;
}

async function verifyToken(env, token) {
  if (!token || !env.DASHBOARD_PASSWORD) return null;
  const [exp, n, sig] = token.split(".");
  if (!exp || !n || !sig || Number(exp) < Date.now()) return null;
  if (!(await safeEqual(sig, await hmac(env.DASHBOARD_PASSWORD, `dash:${exp}:${n}`)))) return null;
  try {
    return fromB64urlText(n);
  } catch {
    return null;
  }
}

const clean = (v, max) => String(v ?? "").trim().slice(0, max);
const team = (env) => String(env.TEAM || "").split(",").map((s) => s.trim()).filter(Boolean);

function parseRange(url) {
  const to = Date.parse(url.searchParams.get("to")) || Date.now();
  const from = Date.parse(url.searchParams.get("from")) || to - 7 * DAY_MS;
  const tz = Math.max(-840, Math.min(840, Number(url.searchParams.get("tz")) || 0));
  return { from, to, tz, span: Math.max(to - from, 60_000) };
}

const iso = (ms) => new Date(ms).toISOString();

async function traffic(env, url) {
  const { from, to, tz, span } = parseRange(url);
  const hourly = span <= 2 * DAY_MS;
  const fmt = hourly ? "%Y-%m-%dT%H:00" : "%Y-%m-%d";
  const mod = `${tz >= 0 ? "+" : ""}${tz} minutes`;
  const cur = [iso(from), iso(to)];
  const prev = [iso(from - span), iso(from)];
  const W = "FROM pageviews WHERE ts >= ? AND ts < ?";
  const db = env.DB;
  const q = (sql, ...args) => db.prepare(sql).bind(...args);

  const totals = (r) => q(`SELECT COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors, COUNT(DISTINCT session) AS sessions ${W}`, ...r);
  const sessions = (r) =>
    q(`WITH s AS (SELECT session, COUNT(*) AS n, SUM(COALESCE(duration_ms, 0)) AS d ${W} GROUP BY session)
       SELECT COALESCE(SUM(n = 1), 0) AS bounces, COALESCE(AVG(d), 0) AS avg_ms FROM s`, ...r);
  const top = (col, limit = 20) =>
    q(`SELECT COALESCE(${col}, 'Unknown') AS k, COUNT(DISTINCT visitor) AS n ${W} GROUP BY k ORDER BY n DESC LIMIT ${limit}`, ...cur);

  const res = await db.batch([
    totals(cur),
    sessions(cur),
    totals(prev),
    sessions(prev),
    q(`SELECT strftime('${fmt}', ts, ?) AS b, COUNT(*) AS pageviews, COUNT(DISTINCT visitor) AS visitors ${W} GROUP BY b ORDER BY b`, mod, ...cur),
    q(`SELECT path, COUNT(*) AS views, COUNT(DISTINCT visitor) AS visitors, AVG(duration_ms) AS avg_ms ${W} GROUP BY path ORDER BY views DESC LIMIT 50`, ...cur),
    // First page view of every session (SQLite returns the bare columns of the MIN(ts) row).
    q(`WITH f AS (SELECT session, path, referrer, utm_source, utm_medium, utm_campaign, MIN(ts) AS first_ts ${W} GROUP BY session)
       SELECT path, referrer, utm_source, utm_medium, utm_campaign, COUNT(*) AS n FROM f
       GROUP BY path, referrer, utm_source, utm_medium, utm_campaign ORDER BY n DESC LIMIT 2000`, ...cur),
    top("country"),
    top("city"),
    top("device", 5),
    top("browser", 10),
    top("os", 10),
    q(`SELECT CAST(strftime('%w', ts, ?) AS INTEGER) AS dow, CAST(strftime('%H', ts, ?) AS INTEGER) AS h, COUNT(*) AS n ${W} GROUP BY dow, h`, mod, mod, ...cur),
  ]);
  const [t, s, pt, ps, series, pages, entries, countries, cities, devices, browsers, os, heat] = res.map((r) => r.results);
  const summary = (a, b) => ({ ...a[0], bounces: b[0].bounces, avgSessionMs: Math.round(b[0].avg_ms) });

  return json({
    bucket: hourly ? "hour" : "day",
    totals: summary(t, s),
    previous: summary(pt, ps),
    series,
    pages,
    entries,
    countries,
    cities,
    devices,
    browsers,
    os,
    heatmap: heat,
  });
}

async function live(env) {
  const since = iso(Date.now() - 5 * 60 * 1000);
  const [count, pages, feed] = (
    await env.DB.batch([
      env.DB.prepare("SELECT COUNT(DISTINCT session) AS n FROM pageviews WHERE ts >= ?").bind(since),
      env.DB.prepare("SELECT path, COUNT(DISTINCT session) AS n FROM pageviews WHERE ts >= ? GROUP BY path ORDER BY n DESC LIMIT 8").bind(since),
      env.DB.prepare("SELECT ts, path, referrer, country, city, device FROM pageviews ORDER BY ts DESC LIMIT 15"),
    ])
  ).map((r) => r.results);
  return json({ active: count[0].n, pages, feed });
}

const LEAD_SELECT = `
  SELECT l.id, l.name, l.company, l.industry, l.cameras, l.phone, l.email, l.city, l.message, l.source_page,
         l.created_at, l.status, l.priority, l.assignee, l.follow_up_at, l.first_response_at, l.updated_at,
         f.path AS landing_page, f.referrer, f.utm_source, f.utm_medium, f.utm_campaign,
         (SELECT COUNT(*) FROM lead_events e WHERE e.lead_id = l.id AND e.kind = 'note') AS notes
  FROM leads l
  LEFT JOIN (
    SELECT session, path, referrer, utm_source, utm_medium, utm_campaign, MIN(ts) AS first_ts
    FROM pageviews WHERE session IN (SELECT session FROM leads WHERE session IS NOT NULL) GROUP BY session
  ) f ON f.session = l.session`;

async function listLeads(env) {
  const { results } = await env.DB.prepare(`${LEAD_SELECT} ORDER BY l.created_at DESC LIMIT 5000`).all();
  return results;
}

async function getLead(env, id) {
  return env.DB.prepare(`${LEAD_SELECT} WHERE l.id = ?`).bind(id).first();
}

async function listEvents(env, id) {
  const { results } = await env.DB.prepare("SELECT id, ts, kind, body, author FROM lead_events WHERE lead_id = ? ORDER BY ts DESC").bind(id).all();
  return results;
}

// PATCH body may hold any of: status, priority, assignee, follow_up_at. Every change is written to the timeline.
async function updateLead(request, env, id, author) {
  const body = await request.json().catch(() => ({}));
  const lead = await env.DB.prepare("SELECT status, priority, assignee, follow_up_at, first_response_at FROM leads WHERE id = ?").bind(id).first();
  if (!lead) return json({ detail: "Not Found" }, 404);

  const next = {};
  if ("status" in body) {
    if (!STATUSES.includes(body.status)) return json({ detail: "Invalid status" }, 422);
    next.status = body.status;
  }
  if ("priority" in body) {
    if (!PRIORITIES.includes(body.priority)) return json({ detail: "Invalid priority" }, 422);
    next.priority = body.priority;
  }
  if ("assignee" in body) next.assignee = clean(body.assignee, 80) || null;
  if ("follow_up_at" in body) {
    const v = body.follow_up_at ? Date.parse(body.follow_up_at) : null;
    if (body.follow_up_at && !v) return json({ detail: "Invalid follow-up date" }, 422);
    next.follow_up_at = v ? iso(v) : null;
  }

  const changed = Object.keys(next).filter((k) => next[k] !== lead[k]);
  if (!changed.length) return json(await getLead(env, id));

  const now = iso(Date.now());
  const sets = changed.map((k) => `${k} = ?`);
  const vals = changed.map((k) => next[k]);
  if (next.status && next.status !== "new" && !lead.first_response_at) {
    sets.push("first_response_at = ?");
    vals.push(now);
  }
  sets.push("updated_at = ?");
  vals.push(now);

  await env.DB.batch([
    env.DB.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id),
    ...changed.map((k) =>
      env.DB.prepare("INSERT INTO lead_events (id, lead_id, ts, kind, body, author) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), id, now, k, JSON.stringify({ from: lead[k], to: next[k] }), author),
    ),
  ]);
  return json(await getLead(env, id));
}

async function addNote(request, env, id, author) {
  const { body = "" } = await request.json().catch(() => ({}));
  const text = clean(body, 2000);
  if (!text) return json({ detail: "Note is empty" }, 422);
  const exists = await env.DB.prepare("SELECT 1 FROM leads WHERE id = ?").bind(id).first();
  if (!exists) return json({ detail: "Not Found" }, 404);
  const ev = { id: crypto.randomUUID(), ts: iso(Date.now()), kind: "note", body: text, author };
  await env.DB.batch([
    env.DB.prepare("INSERT INTO lead_events (id, lead_id, ts, kind, body, author) VALUES (?, ?, ?, ?, ?, ?)").bind(ev.id, id, ev.ts, ev.kind, ev.body, ev.author),
    env.DB.prepare("UPDATE leads SET updated_at = ? WHERE id = ?").bind(ev.ts, id),
  ]);
  return json(ev, 201);
}

const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=@\t\r]/.test(s) || /^[+\-](?![\d\s()\-]*$)/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function handleApi(request, env, path) {
  const method = request.method;

  if (path === "/api/login" && method === "POST") {
    if (!env.DASHBOARD_PASSWORD) return json({ detail: "Dashboard password not configured" }, 503);
    const { name = "", password = "" } = await request.json().catch(() => ({}));
    const who = clean(name, 80);
    if (!who) return json({ detail: "Username is required" }, 422);
    // Single shared sign-in: username from DASHBOARD_USER (default "aifyn"), password from the secret.
    const expected = env.DASHBOARD_USER || "aifyn";
    const [userOk, passOk] = await Promise.all([safeEqual(who.toLowerCase(), expected.toLowerCase()), safeEqual(String(password), env.DASHBOARD_PASSWORD)]);
    if (!userOk || !passOk) return json({ detail: "Invalid username or password" }, 401);
    return json({ token: await issueToken(env, expected), name: expected });
  }

  const user = await verifyToken(env, request.headers.get("x-dashboard-token"));
  if (!user) return json({ detail: "Unauthorized" }, 401);
  const url = new URL(request.url);

  if (path === "/api/me" && method === "GET") return json({ name: user, team: team(env) });
  if (path === "/api/traffic" && method === "GET") return traffic(env, url);
  if (path === "/api/live" && method === "GET") return live(env);
  if (path === "/api/leads" && method === "GET") return json(await listLeads(env));

  if (path === "/api/leads/export" && method === "GET") {
    const rows = await listLeads(env);
    const csv = [CSV_COLUMNS.join(","), ...rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(","))].join("\r\n");
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="aifyn-queries.csv"',
        "cache-control": "no-store",
      },
    });
  }

  const m = path.match(/^\/api\/leads\/([\w-]{1,64})(\/events|\/notes)?$/);
  if (m) {
    const [, id, sub] = m;
    if (!sub && method === "PATCH") return updateLead(request, env, id, user);
    if (sub === "/events" && method === "GET") return json(await listEvents(env, id));
    if (sub === "/notes" && method === "POST") return addNote(request, env, id, user);
  }

  return json({ detail: "Not Found" }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url.pathname);
      } catch (err) {
        console.error(err);
        return json({ detail: "Internal error" }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
