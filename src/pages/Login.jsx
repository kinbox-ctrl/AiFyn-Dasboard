import { useState } from "react";
import { Lock, FlaskConical } from "lucide-react";
import { login } from "../lib/api";
import { Mark } from "../components/ui";

const NAME_KEY = "aifyn-dash-name";

export default function Login({ onSignIn, notice }) {
  const [name, setName] = useState(() => {
    try { return localStorage.getItem(NAME_KEY) || ""; } catch { return ""; }
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState(notice || "");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name — it appears on notes and changes.");
    setBusy(true);
    setError("");
    try {
      const s = await login(name.trim(), password);
      try { localStorage.setItem(NAME_KEY, name.trim()); } catch {}
      onSignIn(s);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <Mark size={44} />
        <div>
          <h1>AiFyn Control Room</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>Website traffic and demo-request management. Team only.</p>
        </div>
        <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" aria-label="Your name" />
        <input className="input" type="password" placeholder="Dashboard password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-label="Password" />
        {error && <div className="error" role="alert">{error}</div>}
        <button className="btn btn-warm" type="submit" disabled={busy}><Lock size={15} /> {busy ? "Signing in…" : "Sign in"}</button>
        <div className="divider">or</div>
        <button type="button" className="btn" onClick={() => onSignIn({ mode: "demo", name: name.trim() || "Demo user" })}>
          <FlaskConical size={15} /> Explore with demo data
        </button>
      </form>
    </main>
  );
}
