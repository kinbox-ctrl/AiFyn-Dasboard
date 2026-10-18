import { PAGE_TITLES } from "./constants";

const nf = new Intl.NumberFormat("en-IN");
const compact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

export const num = (n) => nf.format(Math.round(n || 0));
export const short = (n) => (Math.abs(n) >= 10000 ? compact.format(n) : num(n));
export const pct = (n, digits = 1) => `${(Number.isFinite(n) ? n * 100 : 0).toFixed(digits)}%`;

export function duration(ms) {
  if (!ms || ms < 1000) return "0s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.round(h / 24)}d`;
}

export function ago(isoOrMs, now = Date.now()) {
  const t = typeof isoOrMs === "number" ? isoOrMs : Date.parse(isoOrMs);
  const d = Math.max(0, now - t);
  if (d < 45_000) return "just now";
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)}h ago`;
  if (d < 30 * 86_400_000) return `${Math.round(d / 86_400_000)}d ago`;
  return dateShort(t);
}

export const dateShort = (t) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const dateTime = (t) =>
  new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
export const timeOnly = (t) => new Date(t).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

const WORDS = { ppe: "PPE", anpr: "ANPR", ai: "AI", beverage: "& beverage" };

// "/solutions/ppe-safety" -> "Solutions · PPE safety"
export function pageTitle(path) {
  if (PAGE_TITLES[path]) return PAGE_TITLES[path];
  const [, section, slug] = path.split("/");
  const base = PAGE_TITLES[`/${section}`];
  if (base && slug) {
    const words = slug.split("-").map((w) => WORDS[w] || w).join(" ");
    return `${base} · ${words.replace(/^[a-z]/, (c) => c.toUpperCase())}`;
  }
  return path;
}

export const initials = (name = "") =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

export const delta = (cur, prev) => (prev ? (cur - prev) / prev : cur ? 1 : 0);

export const waLink = (phone) => `https://wa.me/${String(phone).replace(/\D/g, "")}`;
export const telLink = (phone) => `tel:${String(phone).replace(/[^\d+]/g, "")}`;
