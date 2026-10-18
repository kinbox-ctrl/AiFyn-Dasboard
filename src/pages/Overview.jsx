import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Users, Inbox, Percent, Timer, AlertTriangle, CalendarClock, ArrowRight, MousePointerClick } from "lucide-react";
import { useData, useLoad } from "../lib/store";
import { PageHeader } from "../components/Shell";
import { Card, Kpi, BarList, Skeleton, StatusBadge, SlaTag, slaState, followUpDue, Empty } from "../components/ui";
import { TrendChart, Funnel, Legend } from "../components/charts";
import { num, pct, duration, ago, pageTitle, delta } from "../lib/format";
import { inRange, notSpam, previousRange, timeline, channels, avgFirstResponse, funnel, openLeads, countBy } from "../lib/metrics";
import { findings } from "../lib/insights";
import { FindingList } from "./Insights";

const TRAFFIC_SERIES = [
  { key: "visitors", label: "Visitors", color: "var(--series-1)" },
  { key: "pageviews", label: "Page views", color: "var(--series-2)" },
];
const LEAD_SERIES = [{ key: "leads", label: "Queries", color: "var(--series-1)" }];

export default function Overview() {
  const { range, refreshTick, leads } = useData();
  const navigate = useNavigate();
  const traffic = useLoad((c) => c.traffic(range), [range.from, range.to, refreshTick]);
  const t = traffic.data;

  const m = useMemo(() => {
    const cur = notSpam(inRange(leads, range));
    const prev = notSpam(inRange(leads, previousRange(range)));
    const open = openLeads(leads);
    return {
      cur, prev, open,
      overdue: open.filter((l) => slaState(l)?.kind === "late"),
      followUps: open.filter((l) => followUpDue(l)),
      response: avgFirstResponse(cur),
      prevResponse: avgFirstResponse(prev),
    };
  }, [leads, range]);

  const rows = useMemo(() => timeline(range, t, leads), [range, t, leads]);
  const conv = t?.totals.visitors ? m.cur.length / t.totals.visitors : 0;
  const prevConv = t?.previous.visitors ? m.prev.length / t.previous.visitors : 0;
  const loading = !t || !leads;
  const attention = [...m.overdue, ...m.followUps.filter((l) => !m.overdue.includes(l))].slice(0, 6);

  return (
    <>
      <PageHeader title="Overview" sub={`Website and enquiries · ${range.label === "Today" ? "today" : `last ${range.label}`}`} />

      {traffic.error && <div className="error" style={{ marginBottom: 16 }}>{traffic.error}</div>}

      <div className="grid kpis">
        <Kpi icon={Users} label="Visitors" loading={!t} value={num(t?.totals.visitors)} change={t && delta(t.totals.visitors, t.previous.visitors)} />
        <Kpi icon={Inbox} label="Queries received" loading={!leads} value={num(m.cur.length)} change={delta(m.cur.length, m.prev.length)} />
        <Kpi icon={Percent} label="Visitor → query" loading={loading} value={pct(conv, 2)} change={delta(conv, prevConv)} />
        <Kpi icon={MousePointerClick} label="Open queries" loading={!leads} value={num(m.open.length)} foot={`${m.open.filter((l) => l.status === "new").length} awaiting reply`} />
        <Kpi icon={AlertTriangle} label="Overdue replies" loading={!leads} value={num(m.overdue.length)} foot="past the 24h promise" />
        <Kpi icon={Timer} label="Avg. first reply" loading={!leads} value={m.response != null ? duration(m.response) : "—"}
          change={m.response != null && m.prevResponse ? delta(m.response, m.prevResponse) : undefined} invert />
      </div>

      <Card title="Key insights" className="mt" right={<Link to="/insights" className="btn btn-sm">All insights <ArrowRight size={13} /></Link>}>
        {loading ? <Skeleton height={120} /> : <FindingList items={findings({ traffic: t, leads, range })} limit={3} />}
      </Card>

      <div className="grid cols-main mt">
        <Card title="Traffic" hint="Visitors and page views" right={<Legend series={TRAFFIC_SERIES} />}>
          {t ? <TrendChart data={rows} series={TRAFFIC_SERIES} /> : <Skeleton height={260} />}
        </Card>
        <Card title="Pipeline" hint="Queries in this period" right={<Link to="/queries" className="btn btn-sm">Open <ArrowRight size={13} /></Link>}>
          {leads ? (m.cur.length ? <Funnel rows={funnel(m.cur)} /> : <Empty>No queries in this period.</Empty>) : <Skeleton height={200} />}
          <p className="small muted" style={{ margin: "12px 0 0" }}>Bars show how many queries reached each stage; % is the step conversion.</p>
        </Card>
      </div>

      <div className="grid cols-main mt">
        <Card title="Queries over time" hint="Demo requests, spam excluded">
          {leads ? <TrendChart data={rows} series={LEAD_SERIES} kind="bar" height={340} /> : <Skeleton height={340} />}
        </Card>
        <Card title="Needs attention" hint={`${m.overdue.length} overdue · ${m.followUps.length} follow-ups due`}>
          {!leads ? <Skeleton height={200} /> : attention.length ? (
            <div className="barlist">
              {attention.map((l) => (
                <button key={l.id} className="barrow btn-ghost" style={{ border: 0, height: "auto", padding: "8px 10px", textAlign: "left", cursor: "pointer", background: "none" }}
                  onClick={() => navigate(`/queries?lead=${l.id}`)}>
                  <div className="label" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                    <span className="cell-main ellipsis" style={{ maxWidth: "100%" }}>{l.name} · <span className="muted" style={{ fontWeight: 400 }}>{l.company}</span></span>
                    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <StatusBadge status={l.status} />
                      {slaState(l)?.kind === "late" ? <SlaTag lead={l} /> : <span className="sla soon"><CalendarClock size={12} /> Follow-up due</span>}
                    </span>
                  </div>
                  <span className="small muted nowrap">{ago(l.created_at)}</span>
                </button>
              ))}
            </div>
          ) : <Empty>All caught up — every query has a reply and no follow-ups are due.</Empty>}
        </Card>
      </div>

      <div className="grid cols-3 mt">
        <Card title="Top pages" right={<Link to="/traffic" className="btn btn-sm">Traffic <ArrowRight size={13} /></Link>}>
          {t ? <BarList head={["Page", "Views"]} items={t.pages.map((p) => ({ key: p.path, label: pageTitle(p.path), value: p.views }))} total={t.totals.pageviews} /> : <Skeleton />}
        </Card>
        <Card title="Channels" hint="Sessions">
          {t ? <BarList head={["Channel", "Sessions"]} items={channels(t.entries)} total={t.totals.sessions} /> : <Skeleton />}
        </Card>
        <Card title="Queries by industry">
          {leads ? <BarList head={["Industry", "Queries"]} items={countBy(m.cur, (l) => l.industry)} empty="No queries in this period." /> : <Skeleton />}
        </Card>
      </div>
    </>
  );
}
