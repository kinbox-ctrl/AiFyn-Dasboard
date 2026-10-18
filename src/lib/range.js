// Date ranges are in the viewer's local time; the API buckets with the same offset.
const DAY = 86_400_000;
const HOUR = 3_600_000;

export const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
];

export function resolveRange(key, now = Date.now()) {
  const r = RANGES.find((x) => x.key === key) || RANGES[1];
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const from = midnight.getTime() - (r.days - 1) * DAY;
  const to = midnight.getTime() + DAY;
  return { ...r, from, to, bucket: r.days <= 2 ? "hour" : "day", tz: -new Date(now).getTimezoneOffset() };
}

// Bucket key exactly as the API formats it ("YYYY-MM-DD" or "YYYY-MM-DDTHH:00", shifted by tz minutes).
export function bucketKey(ms, bucket, tz) {
  const s = new Date(ms + tz * 60_000).toISOString();
  return bucket === "hour" ? `${s.slice(0, 13)}:00` : s.slice(0, 10);
}

export function bucketKeys({ from, to, bucket, tz }) {
  const step = bucket === "hour" ? HOUR : DAY;
  const keys = [];
  for (let t = from; t < to; t += step) keys.push(bucketKey(t, bucket, tz));
  return [...new Set(keys)];
}

export function bucketLabel(key, bucket) {
  if (bucket === "hour") {
    const h = Number(key.slice(11, 13));
    return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  }
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
