// Derived numbers shared by the Overview, Traffic and Queries screens.
import { bucketKey, bucketKeys, bucketLabel } from "./range";
import { channelOf, sourceOf, CHANNELS } from "./channels";
import { PIPELINE, STATUS, OPEN_STATUSES } from "./constants";

export const inRange = (leads, { from, to }) =>
  (leads || []).filter((l) => {
    const t = Date.parse(l.created_at);
    return t >= from && t < to;
  });

export const notSpam = (leads) => leads.filter((l) => l.status !== "spam");

export function previousRange(range) {
  const span = range.to - range.from;
  return { ...range, from: range.from - span, to: range.from };
}

// One row per bucket with visitors / pageviews from the API and leads counted locally.
export function timeline(range, traffic, leads) {
  const keys = bucketKeys(range);
  const byKey = new Map((traffic?.series || []).map((s) => [s.b, s]));
  const leadCounts = new Map();
  for (const l of notSpam(inRange(leads, range))) {
    const k = bucketKey(Date.parse(l.created_at), range.bucket, range.tz);
    leadCounts.set(k, (leadCounts.get(k) || 0) + 1);
  }
  return keys.map((k) => ({
    key: k,
    label: bucketLabel(k, range.bucket),
    title: range.bucket === "hour"
      ? `${bucketLabel(k, "hour")}, ${new Date(`${k.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
      : new Date(`${k}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
    visitors: byKey.get(k)?.visitors || 0,
    pageviews: byKey.get(k)?.pageviews || 0,
    leads: leadCounts.get(k) || 0,
  }));
}

function sumBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    m.set(k, (m.get(k) || 0) + (r.n ?? 1));
  }
  return [...m].map(([k, v]) => ({ key: k, label: k, value: v })).sort((a, b) => b.value - a.value);
}

export const channels = (entries = []) => {
  const rows = sumBy(entries, channelOf);
  return rows.sort((a, b) => b.value - a.value || CHANNELS.indexOf(a.key) - CHANNELS.indexOf(b.key));
};
export const sources = (entries = []) => sumBy(entries, sourceOf);
export const entryPages = (entries = []) => sumBy(entries, (e) => e.path);

export function campaigns(entries = [], leads = []) {
  const m = new Map();
  for (const e of entries) {
    if (!e.utm_campaign) continue;
    const k = e.utm_campaign;
    const row = m.get(k) || { campaign: k, source: e.utm_source || "—", medium: e.utm_medium || "—", sessions: 0, leads: 0 };
    row.sessions += e.n;
    m.set(k, row);
  }
  for (const l of leads) if (l.utm_campaign && m.has(l.utm_campaign)) m.get(l.utm_campaign).leads++;
  return [...m.values()].sort((a, b) => b.sessions - a.sessions);
}

// Mean time from submission to first status change, over leads that have been answered.
export function avgFirstResponse(leads) {
  const xs = leads.filter((l) => l.first_response_at).map((l) => Date.parse(l.first_response_at) - Date.parse(l.created_at)).filter((x) => x >= 0);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

// How far each (non-spam) lead got. Lost leads count up to "Contacted" when they were answered.
export function funnel(leads) {
  const reach = (l) => {
    if (l.status === "lost") return l.first_response_at ? 1 : 0;
    return Math.max(0, PIPELINE.indexOf(l.status));
  };
  const real = notSpam(leads);
  return PIPELINE.map((s, i) => ({ label: STATUS[s].label, value: real.filter((l) => reach(l) >= i).length }));
}

export const openLeads = (leads) => (leads || []).filter((l) => OPEN_STATUSES.includes(l.status));

export function countBy(items, keyFn) {
  return sumBy(items.map((x) => ({ ...x, n: 1 })), keyFn);
}
