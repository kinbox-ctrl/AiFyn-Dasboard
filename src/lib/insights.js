// Analyses behind the Insights page and the "Key insights" card.
// Outcome analyses (win rates, reply speed) use every closed query, since a single week rarely has enough to compare.
import { channelOf, CHANNELS } from "./channels";
import { OPEN_STATUSES, SLA_HOURS } from "./constants";
import { duration, pct, pageTitle, num } from "./format";
import { slaState } from "../components/ui";
import { notSpam, inRange, channels as channelSessions } from "./metrics";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MIN_CLOSED = 5; // don't quote a win rate from fewer closed queries
const MIN_SESSIONS = 20;

export const leadChannel = (l) => (l.landing_page || l.referrer || l.utm_source ? channelOf(l) : null);
const isClosed = (l) => l.status === "won" || l.status === "lost";
const replyHours = (l) => (l.first_response_at ? (Date.parse(l.first_response_at) - Date.parse(l.created_at)) / HOUR : null);

function rate(won, closed) {
  return closed ? won / closed : null;
}

// Sessions (traffic) vs. queries (leads) per acquisition channel.
export function channelConversion(entries = [], leads = []) {
  const sessions = new Map(channelSessions(entries).map((c) => [c.key, c.value]));
  const queries = new Map();
  for (const l of notSpam(leads)) {
    const ch = leadChannel(l);
    if (ch) queries.set(ch, (queries.get(ch) || 0) + 1);
  }
  return CHANNELS.map((key) => {
    const s = sessions.get(key) || 0;
    const q = queries.get(key) || 0;
    return { key, sessions: s, queries: q, rate: s ? q / s : null };
  })
    .filter((r) => r.sessions || r.queries)
    .sort((a, b) => b.sessions - a.sessions);
}

export function winRateBy(leads, keyFn, order) {
  const m = new Map();
  for (const l of leads.filter(isClosed)) {
    const k = keyFn(l);
    if (k == null) continue;
    const r = m.get(k) || { key: k, won: 0, closed: 0 };
    r.closed++;
    if (l.status === "won") r.won++;
    m.set(k, r);
  }
  const rows = [...m.values()].map((r) => ({ ...r, rate: rate(r.won, r.closed) }));
  return order ? order.map((k) => rows.find((r) => r.key === k)).filter(Boolean) : rows.sort((a, b) => b.rate - a.rate || b.closed - a.closed);
}

export const SPEED_BUCKETS = [
  { key: "Under 1h", max: 1 },
  { key: "1–4h", max: 4 },
  { key: "4–24h", max: SLA_HOURS },
  { key: "Over 24h", max: Infinity },
];
export const speedBucket = (h) => (h == null ? null : SPEED_BUCKETS.find((b) => h < b.max).key);

export const speedVsWin = (leads) =>
  winRateBy(leads, (l) => speedBucket(replyHours(l)), SPEED_BUCKETS.map((b) => b.key));

export function teamStats(leads) {
  const m = new Map();
  for (const l of notSpam(leads)) {
    const k = l.assignee || "Unassigned";
    const r = m.get(k) || { key: k, open: 0, overdue: 0, won: 0, lost: 0, replies: [] };
    if (OPEN_STATUSES.includes(l.status)) r.open++;
    if (slaState(l)?.kind === "late") r.overdue++;
    if (l.status === "won") r.won++;
    if (l.status === "lost") r.lost++;
    const h = replyHours(l);
    if (h != null && h >= 0) r.replies.push(h);
    m.set(k, r);
  }
  return [...m.values()]
    .map((r) => ({
      ...r,
      rate: rate(r.won, r.won + r.lost),
      avgReplyMs: r.replies.length ? (r.replies.reduce((a, b) => a + b, 0) / r.replies.length) * HOUR : null,
      within1h: r.replies.length ? r.replies.filter((h) => h < 1).length / r.replies.length : null,
    }))
    .sort((a, b) => (a.key === "Unassigned") - (b.key === "Unassigned") || b.won + b.open - (a.won + a.open));
}

const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

export function arrivalByHour(leads) {
  const counts = Array(24).fill(0);
  for (const l of notSpam(leads)) counts[new Date(l.created_at).getHours()]++;
  return counts.map((n, h) => ({ key: h, label: hourLabel(h), title: `${hourLabel(h)}–${hourLabel((h + 1) % 24)}`, leads: n }));
}

const lastActivity = (l) => Date.parse(l.updated_at || l.first_response_at || l.created_at);

// Open queries past first reply with no change or note for `days`.
export function stalled(leads, days = 7, now = Date.now()) {
  return (leads || [])
    .filter((l) => OPEN_STATUSES.includes(l.status) && l.status !== "new" && now - lastActivity(l) > days * DAY)
    .map((l) => ({ ...l, idleDays: Math.floor((now - lastActivity(l)) / DAY) }))
    .sort((a, b) => b.idleDays - a.idleDays);
}

// Which pages' visitors go on to submit the form (query attributed to the page the form was on).
export function pageQueryRate(pages = [], leads = []) {
  const q = new Map();
  for (const l of notSpam(leads)) if (l.source_page) q.set(l.source_page, (q.get(l.source_page) || 0) + 1);
  return pages
    .filter((p) => p.visitors >= MIN_SESSIONS || q.get(p.path))
    .map((p) => ({ path: p.path, visitors: p.visitors, queries: q.get(p.path) || 0, rate: p.visitors ? (q.get(p.path) || 0) / p.visitors : 0 }))
    .sort((a, b) => b.rate - a.rate || b.visitors - a.visitors);
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Plain-language findings, most actionable first. Each: { tone: good|bad|info, title, detail, to? }
export function findings({ traffic, leads, range }) {
  if (!traffic || !leads) return [];
  const out = [];
  const real = notSpam(leads);
  const cur = notSpam(inRange(leads, range));

  // 1. SLA breaches — the website promises a reply within 24h.
  const overdue = (leads || []).filter((l) => slaState(l)?.kind === "late");
  if (overdue.length) {
    const oldest = Math.max(...overdue.map((l) => slaState(l).hours));
    out.push({ tone: "bad", title: `${overdue.length} ${overdue.length === 1 ? "query has" : "queries have"} waited more than 24h for a reply`,
      detail: `The oldest has been waiting ${duration(oldest * HOUR)}. The website promises a reply within 24 hours.`, to: "/queries" });
  }

  // 2. Reply speed vs outcome.
  const speed = speedVsWin(real).filter((r) => r.closed >= MIN_CLOSED);
  if (speed.length >= 2) {
    const fast = speed[0];
    const slow = speed[speed.length - 1];
    if (fast.rate - slow.rate >= 0.08) {
      out.push({ tone: "good", title: `Fast replies win more: ${pct(fast.rate, 0)} vs ${pct(slow.rate, 0)}`,
        detail: `Queries answered ${fast.key.toLowerCase()} are won ${pct(fast.rate, 0)} of the time; answered ${slow.key.toLowerCase()}, only ${pct(slow.rate, 0)} (${num(fast.closed + slow.closed)} closed queries).` });
    }
  }

  // 3. Best and worst converting channels.
  const conv = channelConversion(traffic.entries, cur).filter((c) => c.sessions >= MIN_SESSIONS && c.rate != null);
  const siteRate = traffic.totals.sessions ? cur.length / traffic.totals.sessions : 0;
  if (conv.length >= 2 && siteRate) {
    const best = [...conv].sort((a, b) => b.rate - a.rate)[0];
    if (best.rate > siteRate * 1.3) {
      out.push({ tone: "good", title: `${best.key} visitors convert ${(best.rate / siteRate).toFixed(1)}× better than average`,
        detail: `${pct(best.rate, 1)} of ${best.key.toLowerCase()} sessions become a query, vs ${pct(siteRate, 1)} across the site. Worth more budget or effort.`, to: "/traffic" });
    }
    const biggest = conv[0];
    if (biggest.rate < siteRate * 0.7 && biggest !== best) {
      out.push({ tone: "info", title: `${biggest.key} brings the most visits but converts below average`,
        detail: `${num(biggest.sessions)} sessions, ${pct(biggest.rate, 1)} conversion. Check the landing pages these visitors arrive on.` });
    }
  }

  // 4. Industry with the best win rate.
  const ind = winRateBy(real, (l) => l.industry).filter((r) => r.closed >= MIN_CLOSED);
  const overall = rate(real.filter((l) => l.status === "won").length, real.filter(isClosed).length);
  if (ind.length >= 2 && overall) {
    const top = ind[0];
    if (top.rate > overall * 1.2) {
      out.push({ tone: "good", title: `${top.key} is your strongest industry: ${pct(top.rate, 0)} win rate`,
        detail: `Against ${pct(overall, 0)} overall (${top.won} of ${top.closed} closed). Consider targeting it in campaigns and case studies.` });
    }
    const low = ind[ind.length - 1];
    if (low.rate < overall * 0.6) {
      out.push({ tone: "info", title: `${low.key} rarely closes: ${pct(low.rate, 0)} win rate`,
        detail: `${low.won} of ${low.closed} closed queries won. Qualify these earlier to save demo time.` });
    }
  }

  // 5. Stalled pipeline.
  const st = stalled(leads);
  if (st.length) {
    out.push({ tone: "bad", title: `${st.length} open ${st.length === 1 ? "query has" : "queries have"} gone quiet for over a week`,
      detail: `No status change or note in 7+ days — the longest is ${st[0].idleDays} days (${st[0].name}, ${st[0].company}).`, to: "/insights#stalled" });
  }

  // 6. Traffic trend.
  const v = traffic.totals.visitors;
  const pv = traffic.previous.visitors;
  if (pv >= 20 && Math.abs(v - pv) / pv >= 0.1) {
    out.push({ tone: v > pv ? "good" : "bad", title: `Visitors ${v > pv ? "up" : "down"} ${pct(Math.abs(v - pv) / pv, 0)} on the previous period`,
      detail: `${num(v)} visitors vs ${num(pv)}. Queries: ${num(cur.length)} vs ${num(notSpam(inRange(leads, { from: range.from - (range.to - range.from), to: range.from })).length)}.`, to: "/traffic" });
  }

  // 7. Best page for converting visitors.
  const pages = pageQueryRate(traffic.pages, cur).filter((p) => p.visitors >= MIN_SESSIONS && p.queries >= 2 && p.path !== "/contact");
  if (pages.length) {
    const p = pages[0];
    out.push({ tone: "info", title: `“${pageTitle(p.path)}” turns ${pct(p.rate, 1)} of its visitors into queries`,
      detail: `Link to it from ads and posts, and add its demo form or call-to-action to similar pages.` });
  }

  // 8. When to staff the inbox / post.
  const hours = arrivalByHour(real);
  const total = hours.reduce((a, b) => a + b.leads, 0);
  if (total >= 15) {
    let best = 0;
    for (let h = 0; h < 24; h++) if (hours[h].leads + hours[(h + 1) % 24].leads > hours[best].leads + hours[(best + 1) % 24].leads) best = h;
    const share = (hours[best].leads + hours[(best + 1) % 24].leads) / total;
    out.push({ tone: "info", title: `Most queries arrive ${hourLabel(best)}–${hourLabel((best + 2) % 24)}`,
      detail: `${pct(share, 0)} of all queries come in this two-hour window. Keep someone on the inbox then to reply within the hour.` });
  }
  const heat = traffic.heatmap || [];
  if (heat.length) {
    const peak = heat.reduce((a, b) => (b.n > a.n ? b : a));
    out.push({ tone: "info", title: `Traffic peaks on ${DAYS[peak.dow]}s around ${hourLabel(peak.h)}`,
      detail: "A good slot for LinkedIn posts, newsletters and campaign launches." });
  }

  return out;
}
