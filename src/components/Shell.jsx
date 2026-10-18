import { NavLink, Link } from "react-router-dom";
import { LayoutDashboard, LineChart, Inbox, Lightbulb, Sun, Moon, LogOut, RefreshCw, FlaskConical, ExternalLink } from "lucide-react";
import { useData, useLoad } from "../lib/store";
import { useTheme } from "../lib/theme";
import { RANGES } from "../lib/range";
import { Mark, Seg, Avatar } from "./ui";

export default function Shell({ children, onSignOut }) {
  const { me, leads, demo } = useData();
  const [theme, setTheme] = useTheme();
  const newCount = leads?.filter((l) => l.status === "new").length || 0;

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="AiFyn dashboard home">
          <Mark size={34} />
          <span>
            <div className="brand-name">AiFyn</div>
            <div className="brand-sub">Control Room</div>
          </span>
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end><LayoutDashboard size={17} /> Overview</NavLink>
          <NavLink to="/traffic"><LineChart size={17} /> Traffic</NavLink>
          <NavLink to="/queries">
            <Inbox size={17} /> Queries
            {newCount > 0 && <span className="count" aria-label={`${newCount} new`}>{newCount}</span>}
          </NavLink>
          <NavLink to="/insights"><Lightbulb size={17} /> Insights</NavLink>
        </nav>
        <div className="sidebar-foot">
          <div className="me">
            <Avatar name={me.name} />
            <div style={{ minWidth: 0 }}>
              <div className="me-name">{me.name}</div>
              <div className="me-sub">{demo ? "Demo data" : "Signed in"}</div>
            </div>
          </div>
          <div className="foot-actions">
            <button className="btn btn-sm btn-icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle theme" title="Toggle theme">
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <a className="btn btn-sm btn-icon" href="https://www.aifyn.in" target="_blank" rel="noreferrer" aria-label="Open website" title="Open website">
              <ExternalLink size={14} />
            </a>
            <button className="btn btn-sm" onClick={() => onSignOut()} title="Sign out">
              <LogOut size={14} /> <span className="hide-sm">Sign out</span>
            </button>
          </div>
        </div>
      </aside>
      <main className="main">
        {demo && (
          <div className="demo-banner" role="status">
            <FlaskConical size={16} />
            <span><b>Demo mode.</b> Sample traffic and queries generated in your browser — changes are not saved.</span>
          </div>
        )}
        {children}
      </main>
      <Toasts />
    </div>
  );
}

export function PageHeader({ title, sub, actions, range = true }) {
  const { rangeKey, setRangeKey, refresh } = useData();
  return (
    <div className="topbar">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <div className="topbar-right">
        <LivePill />
        {range && <Seg label="Date range" options={RANGES} value={rangeKey} onChange={setRangeKey} />}
        <button className="btn btn-icon" onClick={refresh} aria-label="Refresh" title="Refresh">
          <RefreshCw size={15} />
        </button>
        {actions}
      </div>
    </div>
  );
}

function LivePill() {
  const { data } = useLoad((c) => c.live(), [], 20_000);
  return (
    <Link to="/traffic#live" className="live-pill" title="Visitors in the last 5 minutes">
      <span className="pulse" />
      {data ? data.active : "–"} live
    </Link>
  );
}

function Toasts() {
  const { toasts } = useData();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}
    </div>
  );
}
