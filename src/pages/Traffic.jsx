import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Users, Eye, Layers, Files, LogOut, Timer, Smartphone, Monitor, Tablet, Info } from "lucide-react";
import { useData, useLoad } from "../lib/store";
import { PageHeader } from "../components/Shell";
import { Card, Kpi, BarList, Skeleton, Seg, Empty } from "../components/ui";
import { TrendChart, Heatmap, Legend } from "../components/charts";
import { num, pct, duration, pageTitle, delta, ago } from "../lib/format";
import { COUNTRY_NAMES } from "../lib/constants";
import { timeline, channels, sources, campaigns, entryPages, inRange, notSpam } from "../lib/metrics";

const SERIES = [
  { key: "visitors", label: "Visitors", color: "var(--series-1)" },
  { key: "pageviews", label: "Page views", color: "var(--series-2)" },
];
const DEVICE_ICON = { Mobile: Smartphone, Desktop: Monitor, Tablet };

export default function Traffic() {
  const { range, refreshTick, leads } = useData();
  const { hash } = useLocation();
  const traffic = useLoad((c) => c.traffic(range), [range.from, range.to, refreshTick]);
  const t = traffic.data;
  const [acq, setAcq] = useState("channels");
  const [pagesTab, setPagesTab] = useState("top");
  const [geo, setGeo] = useState("countries");
  const [tech, setTech] = useState("devices");

  useEffect(() => {
    if (hash === "#live") document.getElementById("live")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [hash]);

  const rangeLeads = useMemo(() => notSpam(inRange(leads, range)), [leads, range]);
  const rows = useMemo(() => timeline(range, t, leads), [range, t, leads]);
  const tot = t?.totals;
  const prev = t?.previous;
  const pps = (x) => (x?.sessions ? x.pageviews / x.sessions : 0);
  const bounce = (x) => (x?.sessions ? x.bounces / x.sessions : 0);

  const leadsByPage = useMemo(() => {
    const m = new Map();
    for (const l of rangeLeads) if (l.source_page) m.set(l.source_page, (m.get(l.source_page) || 0) + 1);
    return m;
  }, [rangeLeads]);

  return (
    <>
      <PageHeader title="Traffic" sub="Who visits aifyn.in, from where, and what they read" />
      {traffic.error && <div className="error" style={{ marginBottom: 16 }}>{traffic.error}</div>}

      <div className="grid kpis">
        <Kpi icon={Users} label="Visitors" loading={!t} value={num(tot?.visitors)} change={t && delta(tot.visitors, prev.visitors)} />
        <Kpi icon={Eye} label="Page views" loading={!t} value={num(tot?.pageviews)} change={t && delta(tot.pageviews, prev.pageviews)} />
        <Kpi icon={Layers} label="Sessions" loading={!t} value={num(tot?.sessions)} change={t && delta(tot.sessions, prev.sessions)} />
        <Kpi icon={Files} label="Pages / session" loading={!t} value={pps(tot).toFixed(2)} change={t && delta(pps(tot), pps(prev))} />
        <Kpi icon={LogOut} label="Bounce rate" loading={!t} value={pct(bounce(tot), 0)} change={t && delta(bounce(tot), bounce(prev))} invert />
        <Kpi icon={Timer} label="Avg. visit" loading={!t} value={duration(tot?.avgSessionMs)} change={t && delta(tot.avgSessionMs, prev.avgSessionMs)} />
      </div>

      <div className="grid cols-main mt">
        <Card title="Visitors over time" right={<Legend series={SERIES} />}>
          {t ? <TrendChart data={rows} series={SERIES} height={430} /> : <Skeleton height={430} />}
        </Card>
        <LiveCard />
      </div>

      <div className="grid cols-2 mt">
        <Card
          title="Acquisition"
          right={<Seg label="Acquisition view" value={acq} onChange={setAcq} options={[{ key: "channels", label: "Channels" }, { key: "sources", label: "Sources" }, { key: "campaigns", label: "Campaigns" }]} />}
        >
          {!t ? <Skeleton /> : acq === "campaigns" ? (
            <CampaignTable rows={campaigns(t.entries, rangeLeads)} />
          ) : (
            <BarList head={[acq === "channels" ? "Channel" : "Source", "Sessions"]} items={acq === "channels" ? channels(t.entries) : sources(t.entries)} total={tot.sessions} />
          )}
        </Card>

        <Card
          title="Pages"
          right={<Seg label="Pages view" value={pagesTab} onChange={setPagesTab} options={[{ key: "top", label: "Top pages" }, { key: "entry", label: "Entry pages" }]} />}
        >
          {!t ? <Skeleton /> : pagesTab === "entry" ? (
            <BarList head={["Landing page", "Sessions"]} items={entryPages(t.entries).map((e) => ({ ...e, label: pageTitle(e.key) }))} total={tot.sessions} />
          ) : (
            <PagesTable pages={t.pages} leadsByPage={leadsByPage} />
          )}
        </Card>
      </div>

      <div className="grid cols-2 mt">
        <Card
          title="Locations"
          right={<Seg label="Location view" value={geo} onChange={setGeo} options={[{ key: "countries", label: "Countries" }, { key: "cities", label: "Cities" }]} />}
        >
          {t ? (
            <BarList
              head={[geo === "countries" ? "Country" : "City", "Visitors"]}
              items={t[geo].map((r) => ({ key: r.k, label: geo === "countries" ? COUNTRY_NAMES[r.k] || r.k : r.k, value: r.n }))}
              total={tot.visitors}
            />
          ) : <Skeleton />}
        </Card>
        <Card
          title="Technology"
          right={<Seg label="Technology view" value={tech} onChange={setTech} options={[{ key: "devices", label: "Device" }, { key: "browsers", label: "Browser" }, { key: "os", label: "OS" }]} />}
        >
          {t ? (
            <BarList
              head={[tech === "devices" ? "Device" : tech === "browsers" ? "Browser" : "Operating system", "Visitors"]}
              items={t[tech].map((r) => {
                const Icon = tech === "devices" ? DEVICE_ICON[r.k] : null;
                return { key: r.k, label: r.k, value: r.n, icon: Icon && <Icon size={14} style={{ color: "var(--text-3)" }} /> };
              })}
              total={tot.visitors}
            />
          ) : <Skeleton />}
        </Card>
      </div>

      <Card title="When people visit" hint="Page views by weekday and hour (your local time)" className="mt">
        {t ? <Heatmap cells={t.heatmap} /> : <Skeleton height={220} />}
      </Card>

      <p className="small muted" style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 16 }}>
        <Info size={14} style={{ flex: "none", marginTop: 2 }} />
        Cookie-free, first-party tracking. A visitor is a browser on a given day (the anonymous id rotates daily), so multi-day
        totals count returning people once per day. Bots and the /admin page are excluded.
      </p>
    </>
  );
}

function PagesTable({ pages, leadsByPage }) {
  if (!pages.length) return <Empty>No page views in this period.</Empty>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Page</th><th className="th-num">Views</th><th className="th-num">Visitors</th><th className="th-num hide-sm" title="Average time on page">Time</th><th className="th-num">Queries</th></tr>
        </thead>
        <tbody>
          {pages.slice(0, 10).map((p) => (
            <tr key={p.path}>
              <td style={{ maxWidth: 230 }}>
                <div className="cell-main ellipsis">{pageTitle(p.path)}</div>
                <div className="cell-sub mono ellipsis">{p.path}</div>
              </td>
              <td className="num">{num(p.views)}</td>
              <td className="num">{num(p.visitors)}</td>
              <td className="num hide-sm">{duration(p.avg_ms)}</td>
              <td className="num">{leadsByPage.get(p.path) || <span className="muted">0</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignTable({ rows }) {
  if (!rows.length) {
    return <Empty>No UTM-tagged visits yet. Add <span className="mono">?utm_source=…&utm_campaign=…</span> to links you share in ads, posts and emails.</Empty>;
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Campaign</th><th>Source / medium</th><th className="th-num">Sessions</th><th className="th-num">Queries</th><th className="th-num">Conv.</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.campaign}>
              <td className="cell-main">{r.campaign}</td>
              <td className="muted">{r.source} / {r.medium}</td>
              <td className="num">{num(r.sessions)}</td>
              <td className="num">{num(r.leads)}</td>
              <td className="num">{pct(r.sessions ? r.leads / r.sessions : 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveCard() {
  const { data } = useLoad((c) => c.live(), [], 15_000);
  return (
    <div id="live">
      <Card title="Right now" hint="Last 5 minutes" right={<span className="live-pill" style={{ height: 26 }}><span className="pulse" /> Live</span>}>
        {!data ? <Skeleton height={240} /> : (
          <>
            <div className="kpi-value" style={{ fontSize: 34 }}>{num(data.active)}</div>
            <div className="small muted" style={{ marginBottom: 12 }}>active {data.active === 1 ? "visitor" : "visitors"}</div>
            {data.pages.length > 0 && (
              <BarList head={["Viewing now", "Visitors"]} items={data.pages.map((p) => ({ key: p.path, label: pageTitle(p.path), value: p.n }))} limit={4} />
            )}
            <div className="section-title" style={{ marginTop: 14 }}>Latest views</div>
            <div className="barlist">
              {data.feed.slice(0, 6).map((f, i) => (
                <div className="barrow" key={i} style={{ height: 30 }}>
                  <div className="label"><span className="ellipsis">{pageTitle(f.path)}</span></div>
                  <span className="small muted nowrap">{[f.city, f.device].filter(Boolean).join(" · ")}</span>
                  <span className="small muted nowrap" style={{ width: 62, textAlign: "right" }}>{ago(f.ts)}</span>
                </div>
              ))}
              {!data.feed.length && <Empty>No visits recorded yet.</Empty>}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
