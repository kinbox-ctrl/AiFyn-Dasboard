import { useEffect, useState } from "react";
import {
  X, Phone, MessageCircle, Mail, Copy, ChevronRight, StickyNote, ArrowRightLeft, UserRound, Flag, CalendarClock, Inbox,
} from "lucide-react";
import { useData, useLoad } from "../lib/store";
import { STATUSES, STATUS, PRIORITIES, PIPELINE } from "../lib/constants";
import { ago, dateTime, duration, pageTitle, telLink, waLink, dateShort } from "../lib/format";
import { channelOf, sourceOf } from "../lib/channels";
import { Avatar, StatusBadge, PriorityTag, SlaTag } from "./ui";

const toDateInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fromDateInput = (v) => (v ? new Date(`${v}T10:00:00`).toISOString() : null);

export default function LeadDrawer({ leadId, onClose }) {
  const { leads, updateLead, addNote, me, toast } = useData();
  const lead = leads?.find((l) => l.id === leadId);
  const events = useLoad((c) => c.events(leadId), [leadId, lead?.updated_at]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!leads) return null;
  if (!lead) {
    return (
      <>
        <div className="drawer-backdrop" onClick={onClose} />
        <aside className="drawer" role="dialog" aria-label="Query not found">
          <div className="drawer-head"><h2>Query not found</h2><button className="btn btn-icon btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        </aside>
      </>
    );
  }

  const team = [...new Set([...(me.team || []), me.name].filter(Boolean))];
  const nextStage = PIPELINE[PIPELINE.indexOf(lead.status) + 1];
  const set = (patch) => updateLead(lead.id, patch).catch(() => {});
  const responseMs = lead.first_response_at ? Date.parse(lead.first_response_at) - Date.parse(lead.created_at) : null;

  const submitNote = async (e) => {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addNote(lead.id, note.trim());
      setNote("");
    } catch (err) {
      toast(err.message || "Could not add note", "bad");
    }
    setSaving(false);
  };

  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast("Copied"));
  const mail = `mailto:${lead.email}?subject=${encodeURIComponent("Your AiFyn live demo request")}&body=${encodeURIComponent(`Hi ${lead.name.split(" ")[0]},\n\nThanks for your interest in AiFyn for ${lead.company}.\n\n`)}`;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Query from ${lead.name}`}>
        <div className="drawer-head">
          <Avatar name={lead.name} lg />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="ellipsis">{lead.name}</h2>
            <div className="muted ellipsis">{lead.company} · {lead.city}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <StatusBadge status={lead.status} />
              <PriorityTag priority={lead.priority} />
              <SlaTag lead={lead} />
            </div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="drawer-body">
          <div className="quick">
            <a className="btn" href={telLink(lead.phone)}><Phone size={14} /> Call</a>
            <a className="btn" href={waLink(lead.phone)} target="_blank" rel="noreferrer"><MessageCircle size={14} /> WhatsApp</a>
            <a className="btn" href={mail}><Mail size={14} /> Email</a>
            <button className="btn btn-icon" onClick={() => copy(`${lead.name}, ${lead.company}\n${lead.phone}\n${lead.email}`)} aria-label="Copy contact" title="Copy contact">
              <Copy size={14} />
            </button>
          </div>

          <div>
            <div className="section-title">Pipeline</div>
            <div className="fields">
              <div className="field">
                <label htmlFor="f-status">Status</label>
                <select id="f-status" className="select" value={lead.status} onChange={(e) => set({ status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>&nbsp;</label>
                {nextStage ? (
                  <button className="btn btn-warm" style={{ width: "100%", justifyContent: "center" }} onClick={() => set({ status: nextStage })}>
                    Move to {STATUS[nextStage].label} <ChevronRight size={15} />
                  </button>
                ) : (
                  <button className="btn" style={{ width: "100%", justifyContent: "center" }} disabled>{STATUS[lead.status].hint}</button>
                )}
              </div>
              <div className="field">
                <label htmlFor="f-assignee">Assigned to</label>
                <select id="f-assignee" className="select" value={lead.assignee || ""} onChange={(e) => set({ assignee: e.target.value || null })}>
                  <option value="">Unassigned</option>
                  {[...new Set([...team, lead.assignee].filter(Boolean))].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-priority">Priority</label>
                <select id="f-priority" className="select" value={lead.priority || "normal"} onChange={(e) => set({ priority: e.target.value })}>
                  {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="f-follow">Follow-up</label>
                <input id="f-follow" type="date" className="input" value={toDateInput(lead.follow_up_at)} onChange={(e) => set({ follow_up_at: fromDateInput(e.target.value) })} />
              </div>
              <div className="field">
                <label>First reply</label>
                <div className="input" style={{ display: "flex", alignItems: "center", background: "var(--surface-2)" }}>
                  {responseMs != null ? `after ${duration(responseMs)}` : "Not yet"}
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="section-title">Request</div>
            <dl className="facts">
              <dt>Industry</dt><dd>{lead.industry}</dd>
              <dt>Cameras</dt><dd>{lead.cameras}</dd>
              <dt>Phone</dt><dd><a href={telLink(lead.phone)}>{lead.phone}</a></dd>
              <dt>Email</dt><dd><a href={`mailto:${lead.email}`}>{lead.email}</a></dd>
              <dt>City</dt><dd>{lead.city}</dd>
              <dt>Received</dt><dd>{dateTime(lead.created_at)} <span className="muted">({ago(lead.created_at)})</span></dd>
              <dt>Form on</dt><dd>{lead.source_page ? pageTitle(lead.source_page) : "—"}</dd>
              <dt>Came from</dt>
              <dd>
                {lead.landing_page || lead.referrer || lead.utm_source
                  ? <>{channelOf(lead)} · {sourceOf(lead)}{lead.utm_campaign && <span className="muted"> · {lead.utm_campaign}</span>}</>
                  : <span className="muted">Not tracked</span>}
              </dd>
              {lead.landing_page && <><dt>Landing page</dt><dd>{pageTitle(lead.landing_page)}</dd></>}
            </dl>
            {lead.message && <div className="message" style={{ marginTop: 12 }}>{lead.message}</div>}
          </div>

          <div>
            <div className="section-title">Activity</div>
            <form onSubmit={submitNote} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              <textarea
                className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note — call outcome, requirements, next step…"
                onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submitNote(e)}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-sm" disabled={saving || !note.trim()} type="submit"><StickyNote size={13} /> Add note</button>
              </div>
            </form>
            <Timeline events={events.data} lead={lead} />
          </div>
        </div>
      </aside>
    </>
  );
}

const ICONS = { note: StickyNote, status: ArrowRightLeft, assignee: UserRound, priority: Flag, follow_up_at: CalendarClock };

function describe(ev) {
  let v = {};
  try { v = JSON.parse(ev.body); } catch {}
  switch (ev.kind) {
    case "status": return <>Status: {STATUS[v.from]?.label || "—"} → <b>{STATUS[v.to]?.label || v.to}</b></>;
    case "assignee": return v.to ? <>Assigned to <b>{v.to}</b></> : <>Unassigned</>;
    case "priority": return <>Priority set to <b>{v.to}</b></>;
    case "follow_up_at": return v.to ? <>Follow-up set for <b>{dateShort(v.to)}</b></> : <>Follow-up cleared</>;
    default: return ev.kind;
  }
}

function Timeline({ events, lead }) {
  if (!events) return <div className="skeleton" style={{ height: 80 }} />;
  return (
    <div className="timeline">
      {events.map((ev) => {
        const Icon = ICONS[ev.kind] || ArrowRightLeft;
        return (
          <div className="tl-item" key={ev.id}>
            <span className="tl-icon"><Icon size={13} /></span>
            <div>
              <div className="tl-text">{ev.kind === "note" ? <b>Note</b> : describe(ev)}</div>
              <div className="tl-meta">{ev.author || "—"} · <span title={dateTime(ev.ts)}>{ago(ev.ts)}</span></div>
              {ev.kind === "note" && <div className="tl-note">{ev.body}</div>}
            </div>
          </div>
        );
      })}
      <div className="tl-item">
        <span className="tl-icon"><Inbox size={13} /></span>
        <div>
          <div className="tl-text">Demo request submitted on the website</div>
          <div className="tl-meta">{lead.name} · <span title={dateTime(lead.created_at)}>{ago(lead.created_at)}</span></div>
        </div>
      </div>
    </div>
  );
}
