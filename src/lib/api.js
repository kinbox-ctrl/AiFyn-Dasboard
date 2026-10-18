import { demoApi } from "./demo";

// Sign-in lives in sessionStorage: { mode: "live" | "demo", token, name }.
const KEY = "aifyn-dash-session";

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

export function saveSession(s) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {}
}

export class AuthError extends Error {}

async function request(session, path, { method = "GET", body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dashboard-token": session.token },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new AuthError("Session expired — please sign in again.");
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || `Request failed (${res.status})`);
  return res.json();
}

export async function login(name, password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Could not sign in.");
  return { mode: "live", token: data.token, name: data.name };
}

// One client per session; demo mode swaps in the in-browser dataset.
export function createClient(session) {
  if (session.mode === "demo") {
    return {
      ...demoApi,
      updateLead: (id, patch) => demoApi.updateLead(id, patch, session.name),
      addNote: (id, body) => demoApi.addNote(id, body, session.name),
      exportCsv: (leads) => downloadCsv(leads),
    };
  }
  const q = (range) => `from=${new Date(range.from).toISOString()}&to=${new Date(range.to).toISOString()}&tz=${range.tz}`;
  return {
    me: () => request(session, "/me"),
    traffic: (range) => request(session, `/traffic?${q(range)}`),
    live: () => request(session, "/live"),
    leads: () => request(session, "/leads"),
    events: (id) => request(session, `/leads/${id}/events`),
    updateLead: (id, patch) => request(session, `/leads/${id}`, { method: "PATCH", body: patch }),
    addNote: (id, body) => request(session, `/leads/${id}/notes`, { method: "POST", body: { body } }),
    exportCsv: async () => {
      const res = await fetch("/api/leads/export", { headers: { "x-dashboard-token": session.token } });
      if (!res.ok) throw new Error("Export failed");
      save(await res.blob());
    },
  };
}

function save(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aifyn-queries-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const COLUMNS = ["created_at", "status", "priority", "assignee", "name", "company", "industry", "cameras", "phone", "email", "city", "message", "source_page", "landing_page", "referrer", "utm_source", "utm_campaign"];
const cell = (v) => {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Demo export: the rows currently held in the browser.
function downloadCsv(leads) {
  const csv = [COLUMNS.join(","), ...leads.map((l) => COLUMNS.map((c) => cell(l[c])).join(","))].join("\r\n");
  save(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  return Promise.resolve();
}
