// Demo mode: a deterministic, in-browser stand-in for the API with ~90 days of realistic AiFyn traffic and
// demo requests. Aggregations mirror the SQL in worker/index.js so every screen behaves as it does with live data.
import { bucketKey } from "./range";

const DAY = 86_400_000;
const MIN = 60_000;
const TEAM = ["Raghav Gupta", "Nidhi Bhardwaj Jha"];

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261018);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);
function weighted(items) {
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = rand() * total;
  for (const i of items) if ((r -= i.w) < 0) return i;
  return items[items.length - 1];
}
const W = (obj) => Object.entries(obj).map(([v, w]) => ({ v, w }));

const SOLUTIONS = ["intrusion-perimeter", "theft-loss-prevention", "ppe-safety", "face-recognition-attendance", "vehicle-anpr",
  "footfall-crowd-analytics", "fire-smoke", "hygiene-monitoring", "driver-behaviour", "quality-checks"];
const INDUSTRIES = ["schools-campuses", "pharma", "construction", "manufacturing", "hospitality", "food-beverage", "logistics"];
const PATHS = [
  { v: "/", w: 26 }, { v: "/solutions", w: 12 }, { v: "/industries", w: 9 }, { v: "/about", w: 5 },
  { v: "/contact", w: 9 }, { v: "/privacy", w: 0.6 },
  ...SOLUTIONS.map((s, i) => ({ v: `/solutions/${s}`, w: [3.4, 2, 3.8, 2.6, 2.4, 1.6, 1.8, 1, 1.2, 1.9][i] })),
  ...INDUSTRIES.map((s, i) => ({ v: `/industries/${s}`, w: [2.2, 2, 2.1, 2.6, 1.2, 1.1, 1.5][i] })),
];
const SOURCES = [
  { w: 33 },
  { w: 25, referrer: "google.com", land: ["/", "/solutions/ppe-safety", "/solutions/intrusion-perimeter", "/solutions/vehicle-anpr"] },
  { w: 3, referrer: "bing.com" },
  { w: 1, referrer: "duckduckgo.com" },
  { w: 9, referrer: "linkedin.com", land: ["/", "/about"] },
  { w: 5, referrer: "instagram.com" },
  { w: 3, referrer: "whatsapp.com", land: ["/", "/contact"] },
  { w: 2, referrer: "youtube.com" },
  { w: 7, referrer: "google.com", utm_source: "google", utm_medium: "cpc", utm_campaign: "cctv-ai-search", land: ["/solutions/ppe-safety", "/solutions/intrusion-perimeter", "/contact"] },
  { w: 3, referrer: "linkedin.com", utm_source: "linkedin", utm_medium: "paid", utm_campaign: "ppe-safety-q4", land: ["/solutions/ppe-safety", "/industries/manufacturing"] },
  { w: 3, referrer: "indiamart.com", land: ["/", "/solutions"] },
  { w: 2, referrer: "justdial.com", land: ["/", "/contact"] },
  { w: 1.5, utm_source: "newsletter", utm_medium: "email", utm_campaign: "oct-product-update", land: ["/solutions/face-recognition-attendance"] },
];
const HOURS = [0.4, 0.2, 0.15, 0.1, 0.1, 0.2, 0.5, 1.2, 2.4, 3.6, 4.6, 5, 4.6, 4.2, 4.5, 4.8, 4.6, 4, 3.4, 3.1, 3, 2.6, 1.7, 0.9]
  .map((w, h) => ({ v: h, w }));
const DEVICES = W({ Mobile: 57, Desktop: 39, Tablet: 4 });
const BROWSERS = { Mobile: W({ Chrome: 68, Safari: 20, "Samsung Internet": 8, Firefox: 2, Other: 2 }),
  Desktop: W({ Chrome: 66, Edge: 18, Safari: 9, Firefox: 6, Other: 1 }), Tablet: W({ Safari: 55, Chrome: 45 }) };
const OSES = { Mobile: W({ Android: 74, iOS: 26 }), Desktop: W({ Windows: 72, macOS: 24, Linux: 4 }), Tablet: W({ iOS: 60, Android: 40 }) };
const COUNTRIES = W({ IN: 89, US: 3, AE: 3, GB: 1.5, SG: 1.2, SA: 1, AU: 0.6, NP: 0.4, CA: 0.3 });
const IN_CITIES = W({ Delhi: 18, Gurugram: 14, Noida: 12, Mumbai: 9, Bengaluru: 8, Pune: 5, Chandigarh: 4, Hyderabad: 4,
  Jaipur: 3, Yamunanagar: 3, Ahmedabad: 3, Lucknow: 2.5, Panaji: 2, Kolkata: 2, Chennai: 2, Ludhiana: 2, Dehradun: 1.5 });
const FOREIGN_CITIES = { US: ["New York", "San Jose", "Houston"], AE: ["Dubai", "Abu Dhabi"], GB: ["London"], SG: ["Singapore"],
  SA: ["Riyadh"], AU: ["Sydney"], NP: ["Kathmandu"], CA: ["Toronto"] };

// ---------- traffic ----------
function generateTraffic(now) {
  const rows = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  let seq = 0;
  for (let d = 89; d >= 0; d--) {
    const dayStart = today.getTime() - d * DAY;
    const dow = new Date(dayStart).getDay();
    let base = (52 + (89 - d) * 0.95) * (dow === 0 ? 0.55 : dow === 6 ? 0.68 : 1) * between(0.82, 1.18);
    if (d === 23 || d === 22) base *= 1.9; // LinkedIn post went viral
    const visitors = Math.round(base);
    for (let v = 0; v < visitors; v++) {
      const visitor = `v${d}-${v}`;
      const device = weighted(DEVICES).v;
      const browser = weighted(BROWSERS[device]).v;
      const os = weighted(OSES[device]).v;
      const country = weighted(COUNTRIES).v;
      const city = country === "IN" ? weighted(IN_CITIES).v : pick(FOREIGN_CITIES[country]);
      const nSessions = rand() < 0.86 ? 1 : 2;
      for (let s = 0; s < nSessions; s++) {
        const src = weighted(SOURCES);
        let ts = dayStart + weighted(HOURS).v * 3_600_000 + Math.floor(rand() * 60) * MIN + Math.floor(rand() * 60) * 1000;
        if (ts > now) continue;
        const session = `s${d}-${v}-${s}`;
        const bounce = rand() < (src.utm_medium === "cpc" ? 0.55 : 0.41);
        let n = bounce ? 1 : 2;
        while (!bounce && n < 8 && rand() < 0.48) n++;
        let path = src.land && rand() < 0.75 ? pick(src.land) : weighted(PATHS).v;
        for (let p = 0; p < n; p++) {
          const dur = Math.round((bounce ? between(4, 55) : between(12, 170)) * 1000);
          rows.push({ id: `pv${seq++}`, ts, path, referrer: src.referrer || null, utm_source: src.utm_source || null,
            utm_medium: src.utm_medium || null, utm_campaign: src.utm_campaign || null, country, city, device, browser, os,
            visitor, session, duration_ms: ts + dur > now ? null : dur });
          ts += dur + Math.round(between(1, 4) * 1000);
          if (ts > now) break;
          path = p === n - 2 && rand() < 0.35 ? "/contact" : weighted(PATHS).v;
        }
      }
    }
  }
  return rows.sort((a, b) => a.ts - b.ts);
}

// ---------- queries (leads) ----------
const FIRST = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Rohan", "Karan", "Arjun", "Siddharth", "Manish", "Rajesh", "Sanjay", "Amit",
  "Priya", "Ananya", "Neha", "Kavya", "Pooja", "Ritu", "Meera", "Sneha", "Deepak", "Vikram", "Harpreet", "Gurpreet", "Farhan",
  "Imran", "Sunita", "Anil", "Nikhil", "Tanvi", "Rahul", "Shreya", "Varun", "Divya", "Suresh", "Ayesha", "Mohit", "Kunal"];
const LAST = ["Sharma", "Verma", "Gupta", "Agarwal", "Mehta", "Singh", "Kapoor", "Malhotra", "Jain", "Bansal", "Chopra", "Reddy",
  "Iyer", "Nair", "Khanna", "Bhatia", "Saxena", "Arora", "Sethi", "Kulkarni", "Desai", "Patel", "Khan", "Joshi", "Mishra", "Garg"];
const COMPANY = {
  "Schools & Campuses": ["Greenwood International School", "St. Anselm Academy", "Delhi Heritage Public School", "Sunrise Group of Institutions", "Lotus Valley Campus"],
  Pharma: ["Medivance Pharma", "Zentiva Labs India", "Kairos Lifesciences", "Novacure Formulations", "Aster Biotech"],
  Construction: ["Skyline Infra Projects", "Trident Buildcon", "Shivalik Constructions", "Apex Realty Developers", "Pinnacle Infratech"],
  Manufacturing: ["Bharat Auto Components", "Precision Polymers", "Kohinoor Steel Works", "Vardhman Packaging", "Orbit Electricals"],
  Hospitality: ["The Grand Orchid Hotel", "Saffron Stays", "Cove Resorts Goa", "Regalia Banquets", "Lakeview Residency"],
  "Food & Beverage": ["Annapurna Snacks Co.", "Fresh Bake Foods", "Amrit Dairy", "Spice Route Kitchens", "Masala Junction QSR"],
  Logistics: ["Swift Cargo Movers", "NorthLine Logistics", "Express Freight Solutions", "Gati-Path Warehousing", "RouteMax Transport"],
  Other: ["City Mall Management", "Harmony Housing Society", "Metro Fuel Station", "Galaxy Multiplex", "Shree Jewellers"],
};
const MESSAGES = {
  "Schools & Campuses": ["Need gate monitoring and attendance for 2 campuses.", "Looking for perimeter alerts after school hours.", "Can you track visitor vehicles at the main gate?"],
  Pharma: ["PPE compliance in clean rooms — 3 production blocks.", "Need gowning checks before entering Grade B area.", "Interested in quality checks on the packaging line."],
  Construction: ["Material theft at night on our Noida site.", "Helmet & harness detection for ~400 workers.", "After-hours intrusion alerts for 3 sites."],
  Manufacturing: ["Want PPE + fire/smoke on the shop floor.", "Line-stop detection, we already have Hikvision cameras.", "Product defects on conveyor — can AI catch them?"],
  Hospitality: ["Crowd analytics for the lobby and banquet halls.", "Need discreet monitoring for parking and pool area."],
  "Food & Beverage": ["Hygiene monitoring in central kitchen (caps, gloves).", "FSSAI audit coming up, need hygiene compliance reports."],
  Logistics: ["ANPR at warehouse gates, 6 docks.", "Driver behaviour on our fleet — drowsiness, phone use."],
  Other: ["Footfall counting for a mall, 120 cameras.", "Number plate recognition for society gate.", "Want to see a demo first."],
};
const SPAM = [
  { name: "John Smith", company: "Rank Booster SEO", message: "We can get your website to page 1 of Google in 30 days. Reply for pricing." },
  { name: "Web Solutions", company: "Digital Growth Agency", message: "Do you need a new website design? Affordable packages." },
  { name: "test", company: "test", message: "test" },
];
const NOTES = [
  "Called, wants pricing for 50 cameras first.", "Shared brochure and case study on WhatsApp.", "Site survey booked — need to send engineer.",
  "Uses Hikvision NVRs, compatible. Good fit.", "Decision maker is the plant head, follow up next week.",
  "Asked for a pilot on 5 cameras before PO.", "Budget approval pending from finance.", "Sent quote v2 with annual support.",
  "Not reachable, left voicemail.", "Requested references from pharma clients.",
];
const INDUSTRY_BY_PATH = { pharma: "Pharma", construction: "Construction", manufacturing: "Manufacturing", hospitality: "Hospitality",
  "food-beverage": "Food & Beverage", logistics: "Logistics", "schools-campuses": "Schools & Campuses" };

// `odds` > 1 tilts closed queries towards "won" (fast replies, strong industries, bigger sites).
function statusForAge(hours, odds = 1) {
  if (hours < 24) return weighted(W({ new: 78, contacted: 22 })).v;
  if (hours < 72) return weighted(W({ new: 14, contacted: 46, demo_scheduled: 32, spam: 8 })).v;
  if (hours < 24 * 14) return weighted(W({ new: 4, contacted: 24, demo_scheduled: 30, proposal: 26, lost: 9 / odds, spam: 7 })).v;
  return weighted(W({ new: 1, contacted: 9, demo_scheduled: 8, proposal: 16, won: 24 * odds, lost: 34 / odds, spam: 8 })).v;
}
const INDUSTRY_ODDS = { Pharma: 1.5, Manufacturing: 1.3, Logistics: 1.15, "Schools & Campuses": 0.9, Construction: 0.85, Hospitality: 0.7, "Food & Beverage": 0.8, Other: 0.6 };
const CAMERA_ODDS = { "1–10": 0.6, "11–50": 1, "51–200": 1.3, "200+": 1.2 };
const STAGE_ORDER = ["new", "contacted", "demo_scheduled", "proposal", "won"];

function generateLeads(rows, now) {
  const bySession = new Map();
  for (const r of rows) {
    if (!bySession.has(r.session)) bySession.set(r.session, []);
    bySession.get(r.session).push(r);
  }
  const leads = [];
  const events = new Map();
  let seq = 0;
  for (const views of bySession.values()) {
    const contact = views.find((v) => v.path === "/contact");
    const detail = views.find((v) => v.path.startsWith("/industries/"));
    const p = contact ? (views[0].utm_medium === "cpc" ? 0.12 : 0.085) : detail ? 0.012 : 0.002;
    if (rand() > p) continue;
    const at = (contact || detail || views[views.length - 1]);
    const created = at.ts + Math.round(between(40, 160) * 1000);
    if (created > now) continue;
    const ageH = (now - created) / 3_600_000;
    const slug = detail?.path.split("/")[2];
    const industry = slug && rand() < 0.7 ? INDUSTRY_BY_PATH[slug]
      : weighted(W({ Manufacturing: 22, Construction: 16, Pharma: 14, "Schools & Campuses": 14, Logistics: 11, Hospitality: 7, "Food & Beverage": 7, Other: 9 })).v;
    const cameras = weighted(W({ "1–10": 22, "11–50": 41, "51–200": 26, "200+": 11 })).v;
    const assigned = rand() < 0.88 ? pick(TEAM) : null;
    // Reply speed in hours: one teammate tends to answer faster.
    const respH = rand() < (assigned === TEAM[0] ? 0.55 : 0.35) ? between(0.2, 1)
      : rand() < 0.7 ? between(1, 10) : between(12, 40);
    const speedOdds = respH < 1 ? 1.7 : respH < 4 ? 1.25 : respH < 24 ? 0.9 : 0.5;
    const status = statusForAge(ageH, speedOdds * INDUSTRY_ODDS[industry] * CAMERA_ODDS[cameras]);
    const isSpam = status === "spam" && rand() < 0.8;
    const first = pick(FIRST);
    const last = pick(LAST);
    const company = pick(COMPANY[industry]);
    const spam = isSpam ? pick(SPAM) : null;
    const domain = company.toLowerCase().replace(/[^a-z]+/g, "").slice(0, 14);
    const id = `demo-${(seq++).toString(36).padStart(4, "0")}`;
    const assignee = status === "new" ? (rand() < 0.2 ? pick(TEAM) : null) : assigned;
    const firstResponse = status === "new" ? null : created + Math.round(respH * 3_600_000);
    const lead = {
      id,
      name: spam ? spam.name : `${first} ${last}`,
      company: spam ? spam.company : company,
      industry,
      cameras,
      phone: `+91 ${pick(["98", "99", "97", "88", "93", "70", "81"])}${String(Math.floor(rand() * 1e3)).padStart(3, "0")} ${String(Math.floor(rand() * 1e5)).padStart(5, "0")}`,
      email: spam ? "contact@growth-mail.biz" : `${first.toLowerCase()}.${last.toLowerCase()}@${domain}.in`,
      city: at.country === "IN" ? at.city : pick(["Delhi", "Gurugram", "Mumbai"]),
      message: spam ? spam.message : rand() < 0.65 ? pick(MESSAGES[industry]) : null,
      source_page: contact ? "/contact" : at.path,
      created_at: new Date(created).toISOString(),
      status,
      priority: cameras === "200+" || (cameras === "51–200" && rand() < 0.4) ? "high" : rand() < 0.15 ? "low" : "normal",
      assignee,
      follow_up_at: ["contacted", "demo_scheduled", "proposal"].includes(status)
        ? new Date(now + Math.round(between(rand() < 0.2 ? -3 : 0.2, 6) * DAY)).toISOString() : null,
      first_response_at: firstResponse && firstResponse < now ? new Date(firstResponse).toISOString() : null,
      updated_at: null,
      landing_page: views[0].path,
      referrer: views[0].referrer,
      utm_source: views[0].utm_source,
      utm_medium: views[0].utm_medium,
      utm_campaign: views[0].utm_campaign,
      notes: 0,
    };

    // Timeline: walk the pipeline up to the current status, then sprinkle notes.
    const ev = [];
    const author = assignee || pick(TEAM);
    const steps = ["won", "lost"].includes(status) || STAGE_ORDER.includes(status)
      ? STAGE_ORDER.slice(1, Math.max(1, STAGE_ORDER.indexOf(status === "lost" ? pick(["contacted", "demo_scheduled", "proposal"]) : status) + 1))
      : [];
    if (status === "lost") steps.push("lost");
    if (status === "spam") steps.push("spam");
    let t = firstResponse || created;
    let prev = "new";
    for (const st of steps) {
      if (t > now) break;
      ev.push({ id: `${id}-e${ev.length}`, ts: new Date(t).toISOString(), kind: "status", body: JSON.stringify({ from: prev, to: st }), author });
      prev = st;
      t += Math.round(between(0.5, Math.max(1, ageH / 24 / (steps.length + 1))) * DAY);
    }
    if (assignee && status !== "new") {
      ev.push({ id: `${id}-a`, ts: new Date((firstResponse || created) - 10 * MIN).toISOString(), kind: "assignee", body: JSON.stringify({ from: null, to: assignee }), author });
    }
    const nNotes = status === "spam" || status === "new" ? 0 : Math.floor(between(0, 3));
    for (let i = 0; i < nNotes; i++) {
      const nt = Math.min(now - MIN, created + Math.round(between(0.1, 1) * (now - created)));
      ev.push({ id: `${id}-n${i}`, ts: new Date(nt).toISOString(), kind: "note", body: pick(NOTES), author });
    }
    ev.sort((a, b) => b.ts.localeCompare(a.ts));
    lead.notes = nNotes;
    lead.updated_at = ev[0]?.ts || null;
    if (status !== "new" && !lead.first_response_at) lead.first_response_at = ev[ev.length - 1]?.ts || lead.created_at;
    events.set(id, ev);
    leads.push(lead);
  }
  leads.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { leads, events };
}

// ---------- aggregation (mirrors worker/index.js) ----------
const distinct = (arr, f) => new Set(arr.map(f)).size;

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

function summary(rows) {
  const sessions = groupBy(rows, (r) => r.session);
  let bounces = 0;
  let total = 0;
  for (const s of sessions.values()) {
    if (s.length === 1) bounces++;
    total += s.reduce((a, r) => a + (r.duration_ms || 0), 0);
  }
  return {
    pageviews: rows.length,
    visitors: distinct(rows, (r) => r.visitor),
    sessions: sessions.size,
    bounces,
    avgSessionMs: sessions.size ? Math.round(total / sessions.size) : 0,
  };
}

function topBy(rows, field, limit = 20) {
  return [...groupBy(rows, (r) => r[field] || "Unknown")]
    .map(([k, rs]) => ({ k, n: distinct(rs, (r) => r.visitor) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
}

function aggregate(all, { from, to, tz }) {
  const span = Math.max(to - from, MIN);
  const hourly = span <= 2 * DAY;
  const rows = all.filter((r) => r.ts >= from && r.ts < to);
  const prevRows = all.filter((r) => r.ts >= from - span && r.ts < from);
  const bucket = hourly ? "hour" : "day";

  const series = [...groupBy(rows, (r) => bucketKey(r.ts, bucket, tz))]
    .map(([b, rs]) => ({ b, pageviews: rs.length, visitors: distinct(rs, (r) => r.visitor) }))
    .sort((a, b) => a.b.localeCompare(b.b));

  const pages = [...groupBy(rows, (r) => r.path)]
    .map(([path, rs]) => {
      const timed = rs.filter((r) => r.duration_ms != null);
      return { path, views: rs.length, visitors: distinct(rs, (r) => r.visitor),
        avg_ms: timed.length ? timed.reduce((a, r) => a + r.duration_ms, 0) / timed.length : null };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 50);

  const firsts = [...groupBy(rows, (r) => r.session).values()].map((s) => s[0]);
  const entries = [...groupBy(firsts, (r) => [r.path, r.referrer, r.utm_source, r.utm_medium, r.utm_campaign].join("|"))]
    .map(([, rs]) => ({ path: rs[0].path, referrer: rs[0].referrer, utm_source: rs[0].utm_source, utm_medium: rs[0].utm_medium,
      utm_campaign: rs[0].utm_campaign, n: rs.length }))
    .sort((a, b) => b.n - a.n);

  const heat = groupBy(rows, (r) => {
    const d = new Date(r.ts + tz * MIN);
    return `${d.getUTCDay()}|${d.getUTCHours()}`;
  });

  return {
    bucket,
    totals: summary(rows),
    previous: summary(prevRows),
    series,
    pages,
    entries,
    countries: topBy(rows, "country"),
    cities: topBy(rows, "city"),
    devices: topBy(rows, "device", 5),
    browsers: topBy(rows, "browser", 10),
    os: topBy(rows, "os", 10),
    heatmap: [...heat].map(([k, rs]) => {
      const [dow, h] = k.split("|").map(Number);
      return { dow, h, n: rs.length };
    }),
  };
}

// ---------- API surface ----------
let store = null;
function db() {
  if (!store) {
    const now = Date.now();
    const rows = generateTraffic(now);
    store = { rows, ...generateLeads(rows, now) };
  }
  return store;
}

const wait = (v, ms = 180) => new Promise((r) => setTimeout(() => r(structuredClone(v)), ms));
const clone = (x) => structuredClone(x);

export const demoApi = {
  me: () => wait({ name: "Demo user", team: TEAM }, 50),

  traffic: (range) => wait(aggregate(db().rows, range), 250),

  live: () => {
    const { rows } = db();
    const now = Date.now();
    const phase = Math.sin(now / 90_000);
    const active = Math.max(1, Math.round(6 + phase * 3 + rand() * 2));
    const recent = rows.slice(-400);
    const feed = Array.from({ length: 15 }, (_, i) => {
      const r = recent[Math.floor(rand() * recent.length)];
      return { ts: new Date(now - i * between(20, 70) * 1000 - 5000).toISOString(), path: r.path, referrer: r.referrer,
        country: r.country, city: r.city, device: r.device };
    });
    const pages = [...groupBy(feed.slice(0, active), (f) => f.path)].map(([path, fs]) => ({ path, n: fs.length })).sort((a, b) => b.n - a.n);
    return wait({ active, pages, feed }, 80);
  },

  leads: () => wait(db().leads),

  events: (id) => wait(db().events.get(id) || [], 120),

  updateLead: (id, patch, author) => {
    const { leads, events } = db();
    const lead = leads.find((l) => l.id === id);
    if (!lead) return Promise.reject(new Error("Not found"));
    const now = new Date().toISOString();
    const ev = events.get(id) || [];
    for (const k of ["status", "priority", "assignee", "follow_up_at"]) {
      if (!(k in patch)) continue;
      const to = patch[k] || null;
      if (to === lead[k]) continue;
      ev.unshift({ id: `${id}-${Date.now()}-${k}`, ts: now, kind: k, body: JSON.stringify({ from: lead[k], to }), author });
      if (k === "status" && to !== "new" && !lead.first_response_at) lead.first_response_at = now;
      lead[k] = to;
      lead.updated_at = now;
    }
    events.set(id, ev);
    return wait(lead, 120);
  },

  addNote: (id, body, author) => {
    const { leads, events } = db();
    const lead = leads.find((l) => l.id === id);
    const ev = { id: `${id}-${Date.now()}`, ts: new Date().toISOString(), kind: "note", body, author };
    events.set(id, [ev, ...(events.get(id) || [])]);
    lead.notes += 1;
    lead.updated_at = ev.ts;
    return wait(clone(ev), 120);
  },
};
