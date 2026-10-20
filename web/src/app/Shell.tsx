import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Vault, PlusCircle, UsersThree, Heartbeat, ClockCounterClockwise, ShieldCheck, GearSix, SignOut, EnvelopeSimple, Copy, ArrowSquareOut } from "@phosphor-icons/react";
import { Logo, ThemeToggle } from "../components/ui";
import { useApp } from "./state";
import { short } from "../lib/format";
import { useEffect, useState } from "react";
import { useToast } from "@unlocalhosted/metalui";
import { balanceOf } from "../lib/privy";

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
            <AccountCard account={account} email={watch ? null : email} watch={watch} onLogout={logout} />
          ) : (
            <button className="btn btn-dark btn-sm" onClick={login}><EnvelopeSimple size={16} /> Sign in</button>
          )}
        </div>
      </aside>
      <main className="main" key={loc.pathname}><div className="fade-up page-narrow"><Outlet /></div></main>
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

function AccountCard({ account, email, watch, onLogout }: { account: string; email: string | null; watch: boolean; onLogout: () => void }) {
  const toast = useToast();
  const [bal, setBal] = useState<bigint | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => balanceOf(account).then((b) => live && setBal(b));
    load(); const t = setInterval(load, 20000);
    return () => { live = false; clearInterval(t); };
  }, [account]);
  const near = bal === null ? "…" : (Number(bal / 10n ** 20n) / 10000).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const copy = async () => { try { await navigator.clipboard.writeText(account); toast.show({ title: "Address copied", sub: short(account, 10, 6), tone: "success" }); } catch { toast.show({ title: "Copy failed", tone: "error" }); } };
  return (
    <div className="acct-card">
      <div className="acct">
        <span className="dot" />
        <div className="acct-id">
          <div className="muted acct-k">{watch ? "Viewing read-only" : "Signed in · testnet"}</div>
          <div className="who" title={email || account}>{email || short(account, 10, 6)}</div>
        </div>
        {!watch && <button className="icon-btn acct-btn" onClick={onLogout} aria-label="Sign out" title="Sign out"><SignOut size={16} /></button>}
      </div>
      <div className="acct-row">
        <span className="mono acct-addr" title={account}>{short(account, 8, 6)}</span>
        <button className="icon-btn acct-btn" onClick={copy} aria-label="Copy address" title="Copy address"><Copy size={14} /></button>
        <a className="icon-btn acct-btn" href={`https://testnet.nearblocks.io/address/${account}`} target="_blank" rel="noreferrer" aria-label="View on NearBlocks" title="View on NearBlocks"><ArrowSquareOut size={14} /></a>
      </div>
      <div className="acct-row">
        <span className="muted">Balance</span><b className="mono acct-bal">{near} NEAR</b>
      </div>
      {bal === 0n && !watch && <a className="acct-hint" href="https://near-faucet.io/" target="_blank" rel="noreferrer">Balance is 0. Setting up your account; if it stays at 0, get test NEAR from the faucet ↗</a>}
    </div>
  );
}
