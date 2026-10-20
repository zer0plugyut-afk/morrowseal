import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Vault, PlusCircle, UsersThree, Heartbeat, ClockCounterClockwise, ShieldCheck, GearSix, SignOut, EnvelopeSimple } from "@phosphor-icons/react";
import { Logo, ThemeToggle } from "../components/ui";
import { useApp } from "./state";
import { short } from "../lib/format";

export const NAV = [
  { to: "/app", icon: Vault, label: "Vaults", end: true },
  { to: "/app/create", icon: PlusCircle, label: "Create" },
  { to: "/app/heirs", icon: UsersThree, label: "Heirs" },
  { to: "/app/check-ins", icon: Heartbeat, label: "Check-ins" },
  { to: "/app/activity", icon: ClockCounterClockwise, label: "Activity" },
  { to: "/app/proof", icon: ShieldCheck, label: "Proof" },
  { to: "/app/settings", icon: GearSix, label: "Settings" },
];

export default function Shell() {
  const { account, login, logout, vaults, watch, email } = useApp();
  const loc = useLocation();
  const overdue = vaults.filter((v) => v.status === "Active").length;
  return (
    <div className="shell">
      <aside className="side">
        <Logo to="/" />
        {NAV.map(({ to, icon: I, label, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>
            {({ isActive }) => (<><I size={20} weight={isActive ? "fill" : "regular"} />{label}{label === "Check-ins" && overdue > 0 ? <span className="badge">{overdue}</span> : null}</>)}
          </NavLink>
        ))}
        <div className="side-foot">
          <div style={{ display: "flex", gap: 8 }}><ThemeToggle /></div>
          {account ? (
            <div className="acct"><span className="dot" /><div style={{ minWidth: 0, flex: 1 }}><div className="muted" style={{ fontSize: 11 }}>{watch ? "Viewing read-only" : "Signed in · testnet"}</div><div className="who mono" title={account}>{email && !watch ? email : short(account, 14, 8)}</div></div><button className="icon-btn" style={{ width: 32, height: 32 }} onClick={logout} aria-label="Sign out"><SignOut size={16} /></button></div>
          ) : (
            <button className="btn btn-dark btn-sm" onClick={login}><EnvelopeSimple size={16} /> Sign in</button>
          )}
        </div>
      </aside>
      <main className="main" key={loc.pathname}><div className="fade-up"><Outlet /></div></main>
      <nav className="bottom-nav">
        {NAV.filter((n) => n.label !== "Settings").map(({ to, icon: I, label, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "active" : "")}>{({ isActive }) => (<><I size={22} weight={isActive ? "fill" : "regular"} />{label}</>)}</NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Top({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="topbar">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      <div className="topbar-actions">{children}<span className="mobile-only"><ThemeToggle /></span></div>
    </div>
  );
}

export function NeedWallet({ what }: { what: string }) {
  const { login } = useApp();
  return (
    <div className="card empty">
      <span className="icon-chip" style={{ margin: "0 auto" }}><EnvelopeSimple size={22} weight="duotone" /></span>
      <h3>Sign in with your email</h3>
      <p>{what} We send a one-time code. Your NEAR testnet account is created for you, no wallet or seed phrase.</p>
      <button className="btn btn-dark" onClick={login}>Sign in with email</button>
    </div>
  );
}
