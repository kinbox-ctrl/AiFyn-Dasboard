import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Lightbulb, ArrowRight, Hourglass } from "lucide-react";
import { useData, useLoad } from "../lib/store";
import { PageHeader } from "../components/Shell";
import { Card, Skeleton, Empty, Avatar, StatusBadge } from "../components/ui";
import { TrendChart } from "../components/charts";
import { num, pct, duration, pageTitle } from "../lib/format";
import { CAMERA_OPTIONS } from "../lib/constants";
import { inRange, notSpam } from "../lib/metrics";
import {
  findings, channelConversion, speedVsWin, winRateBy, teamStats, arrivalByHour, stalled, pageQueryRate,
} from "../lib/insights";

const TONE_ICON = { good: TrendingUp, bad: TrendingDown, info: Lightbulb };

export function FindingList({ items, limit }) {
  if (!items.length) return <Empty>Not enough data yet — insights appear once there are visits and closed queries.</Empty>;
  return (
    <div className="findings">
      {items.slice(0, limit).map((f, i) => {
        const Icon = TONE_ICON[f.tone];
        const body = (
          <>
            <span className={`finding-icon tone-${f.tone}`}><Icon size={15} /></span>
            <span style={{ minWidth: 0 }}>
              <span className="finding-title">{f.title}</span>
              <span className="finding-detail">{f.detail}</span>
            </span>
            {f.to && <ArrowRight size={15} className="finding-go" />}
          </>
        );
        return f.to ? <Link key={i} to={f.to} className="finding">{body}</Link> : <div key={i} className="finding">{body}</div>;
      })}
    </div>
  );
}

// Win-rate rows: label, bar (rate), "won of closed".
function RateList({ rows, empty = "Not enough closed queries yet." }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="barlist">
      <div className="barlist-head"><span /><span>Win rate · won / closed</span></div>
      {rows.map((r) => (
        <div className="rate-row" key={r.key} title={`${r.key}: ${r.won} won of ${r.closed} closed`}>
          <span className="ellipsis">{r.key}</span>
          <div className="funnel-track"><div className="funnel-bar" style={{ width: `${(r.rate || 0) * 100}%`, background: "var(--series-1)" }} /></div>
          <b className="num">{pct(r.rate, 0)}</b>
          <span className="small muted num">{r.won}/{r.closed}</span>
        </div>
      ))}
    </div>
  );
}

export default function Insights() {
  const { range, refreshTick, leads } = useData();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const traffic = useLoad((c) => c.traffic(range), [range.from, range.to, refreshTick]);
  const t = traffic.data;

  useEffect(() => {
    if (hash && leads && t) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash, leads, t]);

  const a = useMemo(() => {
    if (!leads) return null;
    const real = notSpam(leads);
    const cur = notSpam(inRange(leads, range));
    return {
      found: findings({ traffic: t, leads, range }),
      channels: t ? channelConversion(t.entries, cur) : [],
      speed: speedVsWin(real),
      industry: winRateBy(real, (l) => l.industry),
      size: winRateBy(real, (l) => l.cameras, CAMERA_OPTIONS),
      team: teamStats(leads),
      hours: arrivalByHour(real),
      stalled: stalled(leads),
      pages: t ? pageQueryRate(t.pages, cur).filter((p) => p.queries).slice(0, 8) : [],
      siteRate: t?.totals.sessions ? cur.length / t.totals.sessions : 0,
    };
  }, [leads, t, range]);

  const loading = !a || !t;

  return (
    <>
      <PageHeader title="Insights" sub="What the numbers mean, and what to do next" />
      {traffic.error && <div className="error" style={{ marginBottom: 16 }}>{traffic.error}</div>}

      <Card title="Key findings" hint={`Traffic for ${range.label === "Today" ? "today" : `the last ${range.label}`}; win rates use all closed queries`}>
        {loading ? <Skeleton height={220} /> : <FindingList items={a.found} />}
      </Card>

      <div className="grid cols-2 mt">
        <Card title="Which channels bring queries" hint="Sessions → queries, this period">
          {loading ? <Skeleton /> : !a.channels.length ? <Empty>No visits in this period.</Empty> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Channel</th><th className="th-num">Sessions</th><th className="th-num">Queries</th><th>Conversion</th></tr></thead>
                <tbody>
                  {a.channels.map((c) => {
                    const max = Math.max(...a.channels.map((x) => x.rate || 0), 0.0001);
                    return (
                      <tr key={c.key}>
                        <td className="cell-main">{c.key}</td>
                        <td className="num">{num(c.sessions)}</td>
                        <td className="num">{num(c.queries)}</td>
                        <td style={{ minWidth: 150 }}>
                          <div className="inline-bar">
                            <div className="funnel-track"><div className="funnel-bar" style={{ width: `${((c.rate || 0) / max) * 100}%`, background: (c.rate || 0) >= a.siteRate ? "var(--series-1)" : "var(--series-3)" }} /></div>
                            <span className="num small" style={{ width: 44 }}>{c.rate == null ? "—" : pct(c.rate, 1)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="small muted" style={{ margin: "10px 0 0" }}>Site average {pct(a.siteRate, 1)}. Teal = at or above average, blue = below.</p>
            </div>
          )}
        </Card>

        <Card title="Does replying fast win more deals?" hint="Win rate by time to first reply, all closed queries">
          {!a ? <Skeleton /> : a.speed.length < 2 ? <Empty>Not enough closed queries yet.</Empty> : (
            <>
              <TrendChart
                kind="bar" height={220} yMax={100} yFormat={(v) => `${v}%`}
                data={a.speed.map((s) => ({ label: s.key, title: `Replied ${s.key.toLowerCase()} · ${s.won}/${s.closed} won`, win: Math.round((s.rate || 0) * 100) }))}
                series={[{ key: "win", label: "Win rate", color: "var(--series-1)", format: (v) => `${v}%` }]}
              />
              <div className="speed-n">{a.speed.map((s) => <span key={s.key}>{s.closed} closed</span>)}</div>
            </>
          )}
        </Card>
      </div>

      <div className="grid cols-2 mt">
        <Card title="Win rate by industry" hint="All closed queries">
          {!a ? <Skeleton /> : <RateList rows={a.industry} />}
        </Card>
        <Card title="Win rate by site size" hint="Number of cameras">
          {!a ? <Skeleton /> : <RateList rows={a.size} />}
        </Card>
      </div>

      <div className="grid cols-main mt">
        <Card title="Team" hint="All queries (spam excluded)">
          {!a ? <Skeleton /> : !a.team.length ? <Empty>No queries yet.</Empty> : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Owner</th><th className="th-num">Open</th><th className="th-num">Overdue</th><th className="th-num">Won</th>
                    <th className="th-num">Win rate</th><th className="th-num">Avg. first reply</th><th className="th-num hide-sm">Replied &lt;1h</th>
                  </tr>
                </thead>
                <tbody>
                  {a.team.map((r) => (
                    <tr key={r.key}>
                      <td><span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>{r.key !== "Unassigned" && <Avatar name={r.key} />}<span className={r.key === "Unassigned" ? "muted" : "cell-main"}>{r.key}</span></span></td>
                      <td className="num">{num(r.open)}</td>
                      <td className="num">{r.overdue ? <span className="sla late">{r.overdue}</span> : <span className="muted">0</span>}</td>
                      <td className="num">{num(r.won)}</td>
                      <td className="num">{r.rate == null ? "—" : pct(r.rate, 0)}</td>
                      <td className="num">{r.avgReplyMs == null ? "—" : duration(r.avgReplyMs)}</td>
                      <td className="num hide-sm">{r.within1h == null ? "—" : pct(r.within1h, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="When queries arrive" hint="By hour of day, all queries">
          {!a ? <Skeleton /> : <TrendChart kind="bar" height={240} data={a.hours} series={[{ key: "leads", label: "Queries", color: "var(--series-1)" }]} />}
        </Card>
      </div>

      <div className="grid cols-2 mt">
        <div id="stalled">
          <Card title="Stalled queries" hint="Open, no activity for 7+ days">
            {!a ? <Skeleton /> : !a.stalled.length ? <Empty>Nothing stalled — every open query has moved in the last week.</Empty> : (
              <div className="barlist">
                {a.stalled.slice(0, 8).map((l) => (
                  <button key={l.id} className="stall-row" onClick={() => navigate(`/queries?lead=${l.id}`)}>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="cell-main ellipsis" style={{ display: "block" }}>{l.name} · <span className="muted" style={{ fontWeight: 400 }}>{l.company}</span></span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
                        <StatusBadge status={l.status} />
                        <span className="small muted">{l.assignee || "Unassigned"}</span>
                      </span>
                    </span>
                    <span className="sla soon nowrap"><Hourglass size={12} /> {l.idleDays}d idle</span>
                  </button>
                ))}
                {a.stalled.length > 8 && <div className="small muted" style={{ padding: "6px 10px" }}>+{a.stalled.length - 8} more</div>}
              </div>
            )}
          </Card>
        </div>
        <Card title="Pages that turn visitors into queries" hint="Form submissions ÷ page visitors, this period">
          {loading ? <Skeleton /> : !a.pages.length ? <Empty>No form submissions in this period yet.</Empty> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Page</th><th className="th-num">Visitors</th><th className="th-num">Queries</th><th className="th-num">Rate</th></tr></thead>
                <tbody>
                  {a.pages.map((p) => (
                    <tr key={p.path}>
                      <td style={{ maxWidth: 240 }}><div className="cell-main ellipsis">{pageTitle(p.path)}</div></td>
                      <td className="num">{num(p.visitors)}</td>
                      <td className="num">{num(p.queries)}</td>
                      <td className="num">{pct(p.rate, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
