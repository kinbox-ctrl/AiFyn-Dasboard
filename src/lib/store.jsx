import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AuthError, createClient } from "./api";
import { resolveRange } from "./range";

const Ctx = createContext(null);
const RANGE_KEY = "aifyn-dash-range";

export function DataProvider({ session, onSignOut, children }) {
  const client = useMemo(() => createClient(session), [session]);
  const [me, setMe] = useState({ name: session.name, team: [] });
  const [leads, setLeads] = useState(null);
  const [leadsError, setLeadsError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [rangeKey, setRangeKeyState] = useState(() => {
    try { return localStorage.getItem(RANGE_KEY) || "7d"; } catch { return "7d"; }
  });
  const [refreshTick, setRefreshTick] = useState(0);
  const range = useMemo(() => resolveRange(rangeKey), [rangeKey, refreshTick]);

  const toast = useCallback((text, tone = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  // Every call goes through here so an expired token signs the user out once, wherever it happens.
  const call = useCallback(
    async (fn) => {
      try {
        return await fn(client);
      } catch (e) {
        if (e instanceof AuthError) onSignOut(e.message);
        throw e;
      }
    },
    [client, onSignOut],
  );

  const reloadLeads = useCallback(async () => {
    try {
      setLeads(await call((c) => c.leads()));
      setLeadsError("");
    } catch (e) {
      setLeadsError(e.message);
    }
  }, [call]);

  useEffect(() => {
    call((c) => c.me()).then(setMe).catch(() => {});
    reloadLeads();
    const t = setInterval(reloadLeads, 60_000);
    return () => clearInterval(t);
  }, [call, reloadLeads]);

  const updateLead = useCallback(
    async (id, patch) => {
      let before;
      setLeads((ls) => ls.map((l) => (l.id === id ? ((before = l), { ...l, ...patch }) : l)));
      try {
        const saved = await call((c) => c.updateLead(id, patch));
        setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, ...saved } : l)));
        return saved;
      } catch (e) {
        if (before) setLeads((ls) => ls.map((l) => (l.id === id ? before : l)));
        toast(e.message || "Could not save change", "bad");
        throw e;
      }
    },
    [call, toast],
  );

  const addNote = useCallback(
    async (id, body) => {
      const ev = await call((c) => c.addNote(id, body));
      setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, notes: (l.notes || 0) + 1, updated_at: ev.ts } : l)));
      return ev;
    },
    [call],
  );

  const setRangeKey = (k) => {
    try { localStorage.setItem(RANGE_KEY, k); } catch {}
    setRangeKeyState(k);
  };

  const refresh = () => {
    setRefreshTick((n) => n + 1);
    reloadLeads();
  };

  const value = {
    session, me, client, call, range, rangeKey, setRangeKey, refreshTick, refresh,
    leads, leadsError, reloadLeads, updateLead, addNote, toast, toasts,
    demo: session.mode === "demo",
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useData = () => useContext(Ctx);

// Loads `fn(client)` whenever deps change; optional polling interval in ms.
export function useLoad(fn, deps, interval) {
  const { call } = useData();
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    call(fnRef.current)
      .then((data) => alive && setState({ data, error: "", loading: false }))
      .catch((e) => alive && setState((s) => ({ ...s, error: e.message, loading: false })));
    return () => { alive = false; };
  }, [call]);

  useEffect(() => {
    const cancel = load();
    const t = interval ? setInterval(load, interval) : null;
    return () => {
      cancel();
      if (t) clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, interval, ...deps]);

  return { ...state, reload: load };
}
