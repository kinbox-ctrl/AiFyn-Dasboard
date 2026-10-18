import { useCallback, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { loadSession, saveSession } from "./lib/api";
import { DataProvider } from "./lib/store";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Traffic from "./pages/Traffic";
import Queries from "./pages/Queries";
import Insights from "./pages/Insights";

export default function App() {
  const [session, setSession] = useState(loadSession);
  const [notice, setNotice] = useState("");

  const signIn = (s) => {
    saveSession(s);
    setNotice("");
    setSession(s);
  };
  const signOut = useCallback((message = "") => {
    saveSession(null);
    setNotice(typeof message === "string" ? message : "");
    setSession(null);
  }, []);

  if (!session) return <Login onSignIn={signIn} notice={notice} />;

  return (
    <BrowserRouter>
      <DataProvider session={session} onSignOut={signOut}>
        <Shell onSignOut={signOut}>
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/traffic" element={<Traffic />} />
            <Route path="/queries" element={<Queries />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Shell>
      </DataProvider>
    </BrowserRouter>
  );
}
