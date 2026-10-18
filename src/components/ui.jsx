import { ArrowDownRight, ArrowUpRight, Clock, AlertTriangle, Minus, Flag } from "lucide-react";
import { STATUS, SLA_HOURS, OPEN_STATUSES } from "../lib/constants";
import { initials, num, pct } from "../lib/format";

export function Mark({ size = 34 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="mk-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FE7A59" />
          <stop offset="1" stopColor="#FE9937" />
        </linearGradient>
        <linearGradient id="mk-ar" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FEC437" />
          <stop offset="1" stopColor="#FFD447" />
        </linearGradient>
        <clipPath id="mk-clip">
          <rect width="64" height="64" rx="14" />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#mk-bg)" />
      <g clipPath="url(#mk-clip)" fill="none" stroke="url(#mk-ar)" strokeWidth="9.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M46.5 17.5 L-4 68" />
        <path d="M23 17.5 H46.5 V41" />
      </g>
    </svg>
  );
}

export function Card({ title, hint, right, children, className = "", bodyClass = "card-body" }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {hint && <span className="hint">{hint}</span>}
          {right && <div className="right">{right}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

// `invert`: a rise is bad (e.g. bounce rate, response time).
export function Delta({ value, invert = false }) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) {
    return <span className="delta flat"><Minus size={12} /> 0%</span>;
  }
  const up = value > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`delta ${good ? "up" : "down"}`} title="vs. previous period">
      <Icon size={13} />
      {pct(Math.abs(value), Math.abs(value) >= 0.1 ? 0 : 1)}
    </span>
  );
}

export function Kpi({ icon: Icon, label, value, change, invert, foot, loading }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{Icon && <Icon size={14} />}{label}</div>
      {loading ? <div className="skeleton" style={{ height: 30, width: "60%" }} /> : <div className="kpi-value">{value}</div>}
      <div className="kpi-foot">
        {change !== undefined && !loading && <Delta value={change} invert={invert} />}
        {foot && <span>{foot}</span>}
      </div>
    </div>
  );
}

export function Seg({ options, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.key} type="button" aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.icon && <o.icon size={14} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.new;
  return (
    <span className={`badge tone-${s.tone}`}>
      <span className="dot" />
      {s.label}
    </span>
  );
}

export function PriorityTag({ priority }) {
  if (priority === "normal" || !priority) return null;
  return (
    <span className={`badge ${priority === "high" ? "tone-warn" : "tone-muted"}`} title={`${priority} priority`}>
      <Flag size={11} />
      {priority === "high" ? "High" : "Low"}
    </span>
  );
}

export function Avatar({ name, lg }) {
  return <span className={`avatar ${lg ? "lg" : ""}`} title={name}>{initials(name)}</span>;
}

// First-reply SLA from the website promise ("We reply within 24 hours").
export function slaState(lead, now = Date.now()) {
  if (lead.status !== "new") return null;
  const hours = (now - Date.parse(lead.created_at)) / 3_600_000;
  if (hours >= SLA_HOURS) return { kind: "late", hours };
  if (hours >= SLA_HOURS - 6) return { kind: "soon", hours };
  return { kind: "ok", hours };
}

export function SlaTag({ lead }) {
  const s = slaState(lead);
  if (!s || s.kind === "ok") return null;
  return s.kind === "late" ? (
    <span className="sla late"><AlertTriangle size={12} /> Overdue {Math.floor(s.hours)}h</span>
  ) : (
    <span className="sla soon"><Clock size={12} /> Due in {Math.max(1, Math.ceil(SLA_HOURS - s.hours))}h</span>
  );
}

export const followUpDue = (lead, now = Date.now()) =>
  OPEN_STATUSES.includes(lead.status) && lead.follow_up_at && Date.parse(lead.follow_up_at) <= now;

export function Empty({ children = "Nothing here yet." }) {
  return <div className="empty">{children}</div>;
}

export function Skeleton({ height = 200 }) {
  return <div className="skeleton" style={{ height }} />;
}

// Horizontal bar list: label + bar sized to max + value + share of total.
export function BarList({ items, total, head = ["", "Visitors"], format = num, empty = "No data for this period.", limit = 8 }) {
  if (!items?.length) return <Empty>{empty}</Empty>;
  const shown = items.slice(0, limit);
  const max = Math.max(...shown.map((i) => i.value), 1);
  const sum = total ?? items.reduce((s, i) => s + i.value, 0);
  return (
    <div className="barlist">
      <div className="barlist-head"><span>{head[0]}</span><span>{head[1]}</span></div>
      {shown.map((i) => (
        <div className="barrow" key={i.key} title={`${i.label}: ${format(i.value)}`}>
          <div className="fill" style={{ width: `${(i.value / max) * 100}%` }} />
          <div className="label">
            {i.icon}
            <span className="ellipsis">{i.label}</span>
          </div>
          <span className="value">{format(i.value)}</span>
          <span className="share">{sum ? pct(i.value / sum, 0) : "—"}</span>
        </div>
      ))}
    </div>
  );
}
