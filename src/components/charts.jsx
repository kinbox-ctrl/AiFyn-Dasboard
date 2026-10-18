import { useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { num, short } from "../lib/format";

function ChartTooltip({ active, payload, label, series }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tooltip">
      <div className="tooltip-title">{payload[0]?.payload?.title || label}</div>
      {series.map((s) => {
        const p = payload.find((x) => x.dataKey === s.key);
        return (
          <div className="tooltip-row" key={s.key}>
            <i style={{ background: s.color }} />
            {s.label}
            <b>{(s.format || num)(p?.value ?? 0)}</b>
          </div>
        );
      })}
    </div>
  );
}

export function Legend({ series }) {
  if (series.length < 2) return null;
  return (
    <div className="chart-legend">
      {series.map((s) => (
        <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>
      ))}
    </div>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  minTickGap: 18,
};

// data: [{ label, title, ...values }]; series: [{ key, label, color }]
export function TrendChart({ data, series, height = 260, kind = "area", yFormat = short, yMax }) {
  const common = { data, margin: { top: 8, right: 8, left: 0, bottom: 0 } };
  const grid = <CartesianGrid vertical={false} stroke="var(--grid)" />;
  const x = <XAxis dataKey="label" {...axisProps} />;
  const y = <YAxis {...axisProps} width={yMax ? 46 : 38} allowDecimals={false} tickFormatter={yFormat} domain={[0, yMax ?? "auto"]} />;
  const tip = <Tooltip content={<ChartTooltip series={series} />} cursor={kind === "bar" ? { fill: "var(--surface-2)" } : { stroke: "var(--border-strong)" }} />;

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        {kind === "bar" ? (
          <BarChart {...common} barCategoryGap="22%">
            {grid}{x}{y}{tip}
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            ))}
          </BarChart>
        ) : (
          <AreaChart {...common}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="1" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {grid}{x}{y}{tip}
            {series.map((s) => (
              <Area
                key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2}
                fill={`url(#fill-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--surface)" }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];
const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;

// Weekday × hour-of-day page views, sequential teal (6 steps).
export function Heatmap({ cells }) {
  const [tip, setTip] = useState(null);
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const c of cells || []) grid[c.dow][c.h] = c.n;
  const max = Math.max(1, ...grid.flat());
  const step = (n) => (n === 0 ? 0 : Math.min(5, 1 + Math.floor((n / max) * 4.999)));
  return (
    <div>
      <div className="heatmap" onMouseLeave={() => setTip(null)}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="collabel">{h % 3 === 0 ? hourLabel(h) : ""}</span>
        ))}
        {ORDER.map((d) => (
          <Row key={d} d={d} values={grid[d]} step={step} onTip={setTip} />
        ))}
      </div>
      <div className="heat-scale">
        Fewer
        {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ background: `var(--seq-${i})` }} />)}
        More
      </div>
      {tip && (
        <div className="floating-tip tooltip" style={{ left: tip.x, top: tip.y }}>
          <div className="tooltip-title">{DAYS[tip.d]} · {hourLabel(tip.h)}–{hourLabel((tip.h + 1) % 24)}</div>
          <div className="tooltip-row">Page views <b>{num(tip.n)}</b></div>
        </div>
      )}
    </div>
  );
}

function Row({ d, values, step, onTip }) {
  return (
    <>
      <span className="rowlabel">{DAYS[d]}</span>
      {values.map((n, h) => (
        <span
          key={h}
          className="cell"
          style={{ background: `var(--seq-${step(n)})` }}
          onMouseEnter={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            onTip({ x: r.left + r.width / 2, y: r.top, d, h, n });
          }}
          aria-label={`${DAYS[d]} ${hourLabel(h)}: ${n} page views`}
        />
      ))}
    </>
  );
}

export function Sparkline({ values, color = "var(--series-1)", width = 90, height = 26 }) {
  if (!values?.length) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - 2 - (v / max) * (height - 4)}`);
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: "block" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// Pipeline funnel: each stage's share of the first stage, plus step conversion.
export function Funnel({ rows }) {
  const top = Math.max(rows[0]?.value || 0, 1);
  return (
    <div className="funnel">
      {rows.map((r, i) => {
        const prev = rows[i - 1]?.value;
        return (
          <div className="funnel-row" key={r.label} title={`${r.label}: ${num(r.value)}`}>
            <span className="ellipsis">{r.label}</span>
            <div className="funnel-track">
              <div className="funnel-bar" style={{ width: `${(r.value / top) * 100}%`, background: r.color || "var(--series-1)" }} />
            </div>
            <span className="num" style={{ fontWeight: 600 }}>{num(r.value)}</span>
            <span className="funnel-rate">{i === 0 ? "100%" : prev ? `${Math.round((r.value / prev) * 100)}%` : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}
