import { useMemo, useState } from "react";
import { createApiClient } from "./api";
import { Dashboard } from "./pages/Dashboard";
import { Settings } from "./pages/Settings";

const STORAGE_KEY = "issue-butler-admin-session";

interface Session {
  adminToken: string;
  guildId: string;
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function LoginForm({ onSubmit }: { onSubmit: (session: Session) => void }) {
  const [adminToken, setAdminToken] = useState("");
  const [guildId, setGuildId] = useState("");

  return (
    <form
      className="login-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ adminToken, guildId });
      }}
    >
      <h1>Issue Butler</h1>
      <label>
        Admin token
        <input type="password" value={adminToken} onChange={(e) => setAdminToken(e.target.value)} required />
      </label>
      <label>
        Discord server (guild) ID
        <input value={guildId} onChange={(e) => setGuildId(e.target.value)} required />
      </label>
      <button type="submit">Continue</button>
    </form>
  );
}

export function App() {
  const [session, setSession] = useState<Session | null>(loadSession);
  const [tab, setTab] = useState<"dashboard" | "settings">("dashboard");

  const api = useMemo(() => (session ? createApiClient({ adminToken: session.adminToken }) : null), [session]);

  if (!session || !api) {
    return (
      <LoginForm
        onSubmit={(next) => {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          setSession(next);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header>
        <h1>Issue Butler</h1>
        <nav>
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>
            Reports
          </button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
            Settings
          </button>
          <button
            className="signout"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setSession(null);
            }}
          >
            Sign out
          </button>
        </nav>
      </header>
      <main>{tab === "dashboard" ? <Dashboard api={api} guildId={session.guildId} /> : <Settings api={api} guildId={session.guildId} />}</main>
    </div>
  );
}
