import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Inbox, MailQuestion, AlertTriangle, CalendarClock, Timer, Trophy, Download, Search, Table2, Columns3, StickyNote, X,
} from "lucide-react";
import { useData } from "../lib/store";
import { PageHeader } from "../components/Shell";
import { Kpi, StatusBadge, PriorityTag, SlaTag, Avatar, Empty, Seg, Skeleton, slaState, followUpDue } from "../components/ui";
import LeadDrawer from "../components/LeadDrawer";
import { STATUSES, STATUS, OPEN_STATUSES, INDUSTRY_OPTIONS, PRIORITIES } from "../lib/constants";
import { ago, dateShort, dateTime, duration, num, pct } from "../lib/format";
import { channelOf } from "../lib/channels";
import { avgFirstResponse, inRange, notSpam, openLeads } from "../lib/metrics";

const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };
const SORTS = {
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  oldest: (a, b) => a.created_at.localeCompare(b.created_at),
  priority: (a, b) => PRIORITY_RANK[a.priority || "normal"] - PRIORITY_RANK[b.priority || "normal"] || b.created_at.localeCompare(a.created_at),
  followup: (a, b) => (a.follow_up_at || "9999").localeCompare(b.follow_up_at || "9999"),
};
const BOARD_LANES = ["new", "contacted", "demo_scheduled", "proposal", "won", "lost"];
const PAGE = 60;

export default function Queries() {
  const { leads, leadsError, range, me, client, toast, updateLead, demo } = useData();
  const [params, setParams] = useSearchParams();
  const leadId = params.get("lead");
  const [statusFilter, setStatusFilter] = useState("open");
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState(() => (params.get("view") === "board" ? "board" : "table"));
  const [selected, setSelected] = useState(() => new Set());
  const [limit, setLimit] = useState(PAGE);

  const all = leads || [];
  const team = [...new Set([...(me.team || []), me.name, ...all.map((l) => l.assignee)].filter(Boolean))];

  // Filters other than status (the status chips show counts within these).
  const base = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((l) => {
      if (industry && l.industry !== industry) return false;
      if (priority && (l.priority || "normal") !== priority) return false;
      if (assignee === "__none" ? l.assignee : assignee && l.assignee !== assignee) return false;
      if (needle && ![l.name, l.company, l.email, l.phone, l.city, l.message].some((v) => v && v.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [all, q, industry, priority, assignee]);

  const counts = useMemo(() => {
    const c = { all: base.length, open: 0, overdue: 0, followup: 0 };
    for (const l of base) {
      c[l.status] = (c[l.status] || 0) + 1;
      if (OPEN_STATUSES.includes(l.status)) c.open++;
      if (slaState(l)?.kind === "late") c.overdue++;
      if (followUpDue(l)) c.followup++;
    }
    return c;
  }, [base]);

  const filtered = useMemo(() => {
    const f = base.filter((l) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "open") return OPEN_STATUSES.includes(l.status);
      if (statusFilter === "overdue") return slaState(l)?.kind === "late";
      if (statusFilter === "followup") return followUpDue(l);
      return l.status === statusFilter;
    });
    return f.sort(SORTS[sort]);
  }, [base, statusFilter, sort]);

  const stats = useMemo(() => {
    const cur = notSpam(inRange(all, range));
    const closed = cur.filter((l) => l.status === "won" || l.status === "lost");
    const open = openLeads(all);
    return {
      open: open.length,
      waiting: open.filter((l) => l.status === "new").length,
      overdue: open.filter((l) => slaState(l)?.kind === "late").length,
      followups: open.filter((l) => followUpDue(l)).length,
      response: avgFirstResponse(cur),
      won: cur.filter((l) => l.status === "won").length,
      winRate: closed.length ? cur.filter((l) => l.status === "won").length / closed.length : null,
    };
  }, [all, range]);

  const openLead = (id) => setParams((p) => { p.set("lead", id); return p; });
  const closeLead = () => setParams((p) => { p.delete("lead"); return p; });

  const toggle = (id) => setSelected((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const shown = filtered.slice(0, limit);
  const allShownSelected = shown.length > 0 && shown.every((l) => selected.has(l.id));

  const bulk = async (patch) => {
    const ids = [...selected];
    await Promise.allSettled(ids.map((id) => updateLead(id, patch)));
    toast(`Updated ${ids.length} ${ids.length === 1 ? "query" : "queries"}`);
    setSelected(new Set());
  };

  const exportCsv = () => client.exportCsv(filtered).catch((e) => toast(e.message, "bad"));

  const chip = (key, label, count) => (
    <button key={key} className="chip" aria-pressed={statusFilter === key} onClick={() => { setStatusFilter(key); setLimit(PAGE); }}>
      {label} <b>{num(count || 0)}</b>
    </button>
  );

  return (
    <>
      <PageHeader
        title="Queries"
        sub="Demo requests from the website form"
        actions={<button className="btn" onClick={exportCsv} title={demo ? "Exports the filtered list" : "Exports every query"}><Download size={15} /> Export CSV</button>}
      />
      {leadsError && <div className="error" style={{ marginBottom: 16 }}>{leadsError}</div>}

      <div className="grid kpis">
        <Kpi icon={Inbox} label="Open queries" loading={!leads} value={num(stats.open)} />
        <Kpi icon={MailQuestion} label="Awaiting first reply" loading={!leads} value={num(stats.waiting)} />
        <Kpi icon={AlertTriangle} label="Overdue (>24h)" loading={!leads} value={num(stats.overdue)} foot={stats.overdue ? "reply today" : "on track"} />
        <Kpi icon={CalendarClock} label="Follow-ups due" loading={!leads} value={num(stats.followups)} />
        <Kpi icon={Timer} label="Avg. first reply" loading={!leads} value={stats.response != null ? duration(stats.response) : "—"} foot={range.label} />
        <Kpi icon={Trophy} label="Won · win rate" loading={!leads} value={num(stats.won)} foot={stats.winRate != null ? `${pct(stats.winRate, 0)} of closed · ${range.label}` : range.label} />
      </div>

      <section className="card mt">
        <div className="chips">
          {chip("open", "Open", counts.open)}
          {chip("overdue", "Overdue", counts.overdue)}
          {chip("followup", "Follow-up due", counts.followup)}
          {STATUSES.map((s) => chip(s.key, s.label, counts[s.key]))}
          {chip("all", "All", counts.all)}
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={15} />
            <input className="input" placeholder="Search name, company, phone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search queries" />
          </label>
          <select className="select" value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Industry">
            <option value="">All industries</option>
            {INDUSTRY_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
          <select className="select" value={assignee} onChange={(e) => setAssignee(e.target.value)} aria-label="Assigned to">
            <option value="">Anyone</option>
            <option value="__none">Unassigned</option>
            {team.map((n) => <option key={n}>{n}</option>)}
          </select>
          <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="priority">Priority</option>
            <option value="followup">Follow-up date</option>
          </select>
          <div style={{ marginLeft: "auto" }}>
            <Seg label="View" value={view} onChange={setView} options={[{ key: "table", label: "Table", icon: Table2 }, { key: "board", label: "Board", icon: Columns3 }]} />
          </div>
        </div>

        {selected.size > 0 && view === "table" && (
          <div className="bulkbar">
            <b>{selected.size} selected</b>
            <select className="select" value="" onChange={(e) => e.target.value && bulk({ status: e.target.value })} aria-label="Set status">
              <option value="">Set status…</option>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <select className="select" value="" onChange={(e) => e.target.value && bulk({ assignee: e.target.value === "__none" ? null : e.target.value })} aria-label="Assign">
              <option value="">Assign to…</option>
              <option value="__none">Unassigned</option>
              {team.map((n) => <option key={n}>{n}</option>)}
            </select>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}><X size={13} /> Clear</button>
          </div>
        )}

        {!leads ? (
          <div style={{ padding: 16 }}><Skeleton height={300} /></div>
        ) : view === "board" ? (
          <Board leads={base} onOpen={openLead} />
        ) : filtered.length === 0 ? (
          <Empty>{all.length ? "No queries match these filters." : "No queries yet — they appear here the moment someone submits the demo form on the website."}</Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox" aria-label="Select all shown" checked={allShownSelected}
                        onChange={() => setSelected(allShownSelected ? new Set() : new Set(shown.map((l) => l.id)))} />
                    </th>
                    <th>Received</th>
                    <th>Contact</th>
                    <th className="hide-sm">Need</th>
                    <th>Status</th>
                    <th className="hide-sm">Owner</th>
                    <th className="hide-sm">Follow-up</th>
                    <th className="hide-sm">Came from</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((l) => (
                    <tr key={l.id} className={`click ${selected.has(l.id) ? "selected" : ""}`} onClick={() => openLead(l.id)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Select ${l.name}`} checked={selected.has(l.id)} onChange={() => toggle(l.id)} />
                      </td>
                      <td className="nowrap">
                        <div title={dateTime(l.created_at)}>{ago(l.created_at)}</div>
                        <SlaTag lead={l} />
                      </td>
                      <td>
                        <div className="cell-main">{l.name}</div>
                        <div className="cell-sub">{l.company} · {l.city}</div>
                      </td>
                      <td className="hide-sm">
                        <div>{l.industry}</div>
                        <div className="cell-sub">{l.cameras} cameras{l.notes ? <> · <StickyNote size={11} style={{ verticalAlign: -1 }} /> {l.notes}</> : null}</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <StatusBadge status={l.status} />
                          <PriorityTag priority={l.priority} />
                        </div>
                      </td>
                      <td className="hide-sm">
                        {l.assignee ? <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Avatar name={l.assignee} />{l.assignee.split(" ")[0]}</span> : <span className="muted">—</span>}
                      </td>
                      <td className="hide-sm nowrap">
                        {l.follow_up_at && OPEN_STATUSES.includes(l.status)
                          ? <span className={followUpDue(l) ? "sla late" : ""}>{dateShort(l.follow_up_at)}</span>
                          : <span className="muted">—</span>}
                      </td>
                      <td className="hide-sm">
                        <div>{l.landing_page || l.referrer || l.utm_source ? channelOf(l) : <span className="muted">—</span>}</div>
                        {l.utm_campaign && <div className="cell-sub">{l.utm_campaign}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length > limit && (
              <div style={{ padding: 14, textAlign: "center" }}>
                <button className="btn" onClick={() => setLimit((n) => n + PAGE)}>Show more ({num(filtered.length - limit)} left)</button>
              </div>
            )}
          </>
        )}
      </section>

      {leadId && <LeadDrawer leadId={leadId} onClose={closeLead} />}
    </>
  );
}

// Kanban: drag a card between lanes to change its status.
function Board({ leads, onOpen }) {
  const { updateLead } = useData();
  const [over, setOver] = useState(null);
  const [dragging, setDragging] = useState(null);
  const recentClosed = Date.now() - 30 * 86_400_000;

  return (
    <div className="board">
      {BOARD_LANES.map((lane) => {
        let items = leads.filter((l) => l.status === lane);
        // Keep the closed lanes readable: only the last 30 days.
        if (lane === "won" || lane === "lost") items = items.filter((l) => Date.parse(l.updated_at || l.created_at) >= recentClosed);
        items.sort(SORTS.priority);
        return (
          <div
            key={lane}
            className={`lane ${over === lane ? "over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(lane); }}
            onDragLeave={() => setOver((o) => (o === lane ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain");
              const lead = leads.find((l) => l.id === id);
              if (lead && lead.status !== lane) updateLead(id, { status: lane }).catch(() => {});
            }}
          >
            <div className="lane-head">
              <StatusBadge status={lane} />
              <span className="n">{items.length}</span>
              {(lane === "won" || lane === "lost") && <span className="small muted" style={{ marginLeft: "auto", fontWeight: 400 }}>30 days</span>}
            </div>
            {items.slice(0, 40).map((l) => (
              <div
                key={l.id}
                className={`lead-card ${dragging === l.id ? "dragging" : ""}`}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData("text/plain", l.id); setDragging(l.id); }}
                onDragEnd={() => setDragging(null)}
                onClick={() => onOpen(l.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpen(l.id)}
                aria-label={`${l.name}, ${l.company}, ${STATUS[l.status].label}`}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="cell-main ellipsis" style={{ flex: 1 }}>{l.name}</span>
                  <PriorityTag priority={l.priority} />
                </div>
                <div className="small muted ellipsis">{l.company}</div>
                <div className="row">
                  <span>{l.industry}</span>·<span>{l.cameras}</span>
                  <span style={{ marginLeft: "auto" }}>{ago(l.created_at)}</span>
                </div>
                <div className="row">
                  {l.assignee ? <><Avatar name={l.assignee} /><span>{l.assignee.split(" ")[0]}</span></> : <span>Unassigned</span>}
                  <span style={{ marginLeft: "auto" }}><SlaTag lead={l} /></span>
                </div>
              </div>
            ))}
            {items.length > 40 && <div className="small muted" style={{ textAlign: "center" }}>+{items.length - 40} more — use the table</div>}
            {!items.length && <div className="small muted" style={{ textAlign: "center", padding: 12 }}>Drop here</div>}
          </div>
        );
      })}
    </div>
  );
}
