import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Heartbeat, UsersThree, ArrowSquareOut, ShieldCheck, Cpu, Hash, EyeSlash, Moon, Sun, Trash, DownloadSimple, LockKey, PencilSimple, Clock, Warning, Bell, EnvelopeSimple, LockKeyOpen, XCircle, Info, CircleNotch, ClockCounterClockwise, HandHeart } from "@phosphor-icons/react";
import { Pagination, useToast } from "@unlocalhosted/metalui";
import { Persona } from "../components/Persona";
import { Top, NeedWallet } from "../app/Shell";
import { useApp } from "../app/state";
import { callVault, deadline, EXPLORER, nsToMs, view, type ChainEvent, type Vault } from "../lib/near";
import { countdown, span, when, tzLabel, short } from "../lib/format";
import { localVaults } from "../lib/local";
import { identityToken } from "../lib/privy";
import { useNow, useTheme } from "../components/ui";
import { label } from "./Vaults";
import { VAULT_CONTRACT, OUTLAYER_PROJECT, ENCLAVE_PUBKEY } from "@shared/morrowseal.mjs";

export function Heirs() {
  const { account, vaults } = useApp();
  const local = localVaults();
  if (!account) return (<><Top title="Heirs" /><NeedWallet what="See who you've named in each vault." /></>);
  const rows = vaults.filter((v) => v.status !== "Cancelled").flatMap((v) => Array.from({ length: v.heirs }, (_, i) => ({ v, i, h: local[v.id]?.heirs[i] })));
  return (
    <>
      <Top title="Heirs" sub="Names and emails are only on this device and inside the sealed vault. NEAR sees a count." />
      <div className="card card-pad">
        {rows.length === 0 ? <div className="empty"><UsersThree size={30} /><h3>No heirs yet</h3><p>Name heirs when you create a vault.</p><Link className="btn btn-dark" to="/app/create">Create a vault</Link></div> :
          <div className="list">{rows.map(({ v, i, h }) => (
            <div className="row" key={`${v.id}-${i}`}>
              <span style={{ flexShrink: 0 }}><Persona email={h?.email} name={h?.name || `Heir ${i + 1}`} /></span>
              <div className="grow"><div className="t" title={h?.name}>{h?.name || `Heir ${i + 1}`}</div><div className="s" title={h?.email}>{h?.email || "Sealed (created on another device)"} · {v.title}</div></div>
              <span className={`chip ${v.claims[i] ? "chip-green" : v.status === "Released" ? "chip-amber" : "chip-blue"}`}>{v.claims[i] ? "Opened" : v.status === "Released" ? "Emailed" : "Sealed"}</span>
            </div>))}</div>}
      </div>
    </>
  );
}

export function CheckIns() {
  const { account, vaults, refresh } = useApp();
  const toast = useToast();
  const now = useNow();
  if (!account) return (<><Top title="Check-ins" /><NeedWallet what="Checking in tells your vaults you're still here." /></>);
  const active = vaults.filter((v) => v.status === "Active");
  const go = async () => {
    for (const v of active) await toast.promise(callVault("check_in", { vault_id: v.id }, { tgas: 20 }), { loading: { title: `Checking in · ${v.title}` }, success: { title: "You're checked in", sub: v.title, tone: "success" }, error: (e: any) => ({ title: "Check-in failed", sub: String(e?.message || e).slice(0, 80), tone: "error" }) });
    refresh();
  };
  return (
    <>
      <Top title="Check-ins" sub={`Times are in your timezone (${tzLabel()}).`} />
      <div className="grid-2">
        <div className="card card-pad">
          <button className="big-check pulse" onClick={go} disabled={!active.length}><Heartbeat size={40} weight="bold" />I'm here<small>{active.length ? `Resets ${active.length} vault${active.length > 1 ? "s" : ""}` : "No active vaults"}</small></button>
        </div>
        <div className="card card-pad">
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 21, letterSpacing: "-.03em", marginBottom: 6 }}>Deadlines</h3>
          <div className="list">{active.length === 0 ? <p className="muted">Nothing is counting down.</p> : active.map((v) => (
            <div className="row" key={v.id}><div className="grow"><div className="t">{v.title}</div><div className="s">Every {span(v.interval_s)} · last {when(nsToMs(v.last_checkin_ns))}</div></div><div style={{ textAlign: "right" }}><div className="mono" style={{ fontWeight: 600 }}>{deadline(v) > now ? countdown(deadline(v) - now) : "due"}</div><div className="s muted" style={{ fontSize: 12 }}>{when(deadline(v))}</div></div></div>))}</div>
        </div>
      </div>
    </>
  );
}

const PAGE = 10;
type Ev = ChainEvent & { role?: "owner" | "heir"; owner_name?: string };
const EV: Record<string, [string, any, string]> = {
  vault_created: ["Vault created", LockKey, "brand"],
  checked_in: ["Checked in", Heartbeat, "green"],
  vault_updated: ["Contents replaced", PencilSimple, "muted"],
  schedule_changed: ["Schedule changed", Clock, "muted"],
  vault_released: ["Released", Warning, "amber"],
  heirs_named: ["Heirs told they were named", UsersThree, "brand"],
  heirs_notified: ["Heir notices sealed by the enclave", Bell, "brand"],
  heir_email_sent: ["Heirs notified by email", EnvelopeSimple, "brand"],
  heir_claimed: ["Heir opened their share", LockKeyOpen, "green"],
  vault_cancelled: ["Cancelled", XCircle, "muted"],
};
const HEIR_EV: Record<string, [string, any, string]> = {
  vault_released: ["A vault shared with you was released", Warning, "amber"],
  heir_claimed: ["You opened a vault left for you", LockKeyOpen, "green"],
  vault_cancelled: ["A vault shared with you was closed", XCircle, "muted"],
};
export function Activity() {
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [page, setPage] = useState(1);
  const { account, vaults, watch } = useApp();
  useEffect(() => {
    let live = true, t: any;
    const load = async () => {
      try {
        if (!account) return;
        const token = watch ? null : await identityToken();
        const r = await fetch(`/api/activity?owner=${encodeURIComponent(account)}`, { cache: "no-store", headers: token ? { authorization: `Bearer ${token}` } : {} });
        if (r.ok) { const all = (await r.json()) as Ev[]; if (live) setEvents(all.reverse()); }
      } catch { /* API busy: try again shortly */ }
      if (live) t = setTimeout(load, 15000);
    };
    load(); return () => { live = false; clearTimeout(t); };
  }, [account, watch]);
  const list = events || [];
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const titleOf = (e: Ev) => (e.role === "heir" ? (e.owner_name ? `from ${e.owner_name}` : `Vault ${e.vault_id}`) : vaults.find((v) => v.id === e.vault_id)?.title || `Vault ${e.vault_id}`);
  if (!account) return (<><Top title="Activity" /><NeedWallet what="See what happened to your vaults and to vaults left for you." /></>);
  return (
    <>
      <Top title="Activity" sub={`Only your own vaults and the vaults left for you. Times in ${tzLabel()}.`} />
      <div className="card card-pad">
        {events === null ? <p className="muted"><CircleNotch size={14} className="spin" /> Loading…</p>
        : list.length === 0 ? (
          <div className="empty-state"><span className="icon-chip"><ClockCounterClockwise size={22} weight="duotone" /></span><h3>Nothing here yet</h3><p className="muted">Create a vault, check in, or open something left for you, and it shows up here with the time in your timezone and a link to the NEAR record.</p><div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}><Link className="btn btn-dark btn-sm" to="/app/create">Create a vault</Link><Link className="btn btn-ghost btn-sm" to="/app/shared">Shared with me</Link></div></div>
        ) : <div className="list">{list.slice((page - 1) * PAGE, page * PAGE).map((e, i) => {
          const [l, I, tone] = (e.role === "heir" ? HEIR_EV[e.kind] : EV[e.kind]) || EV[e.kind] || [e.kind, Info, "muted"];
          const by = e.role === "heir" ? "" : e.actor === account ? " · by you" : e.actor === "keeper" || e.actor.endsWith(".testnet") ? " · by the keeper" : "";
          return (<div className="row ev-row" key={i}><span className={`ev-ic tone-${tone}`}><I size={18} weight="duotone" /></span><div className="grow"><div className="t">{l} <span className="muted" style={{ fontWeight: 400 }}>· {titleOf(e)}</span></div><div className="s">{when(nsToMs(e.at_ns))}{e.detail && e.role !== "heir" ? ` · ${e.detail}` : ""}{by}</div></div></div>);
        })}</div>}
        {pages > 1 && <div className="pager"><Pagination page={page} count={pages} onPageChange={setPage} aria-label="Activity pages" /></div>}
      </div>
    </>
  );
}

type Shared = { vault_id: number; heir_index: number; heir_name: string; owner_name: string; owner: string; status: "waiting" | "released" | "opened" | "cancelled"; created_ns: string; released_ns: string | null; claimed_ns: string | null; link: string | null };
const ST: Record<Shared["status"], [string, string]> = { waiting: ["Waiting", "chip-blue"], released: ["Released", "chip-amber"], opened: ["Opened", "chip-green"], cancelled: ["Closed", "chip-muted"] };
export function SharedWithMe() {
  const { account, email, watch } = useApp();
  const [rows, setRows] = useState<Shared[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true, t: any;
    const load = async () => {
      try {
        if (!account || watch) return;
        const token = await identityToken();
        const r = await fetch("/api/shared", { cache: "no-store", headers: { authorization: `Bearer ${token}` } });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Could not load");
        if (live) { setRows(j); setErr(""); }
      } catch (e: any) { if (live) setErr(String(e?.message || e)); }
      if (live) t = setTimeout(load, 20000);
    };
    load(); return () => { live = false; clearTimeout(t); };
  }, [account, watch]);
  if (!account || watch) return (<><Top title="Shared with me" /><NeedWallet what="See every vault where your email was named as an heir." /></>);
  return (
    <>
      <Top title="Shared with me" sub={`Vaults that name ${email || "your email"} as an heir. Times in ${tzLabel()}.`} />
      <div className="card card-pad">
        {err && !rows ? <div className="banner warn"><Info size={20} /> {err}</div>
        : rows === null ? <p className="muted"><CircleNotch size={14} className="spin" /> Loading…</p>
        : rows.length === 0 ? <div className="empty-state"><span className="icon-chip"><HandHeart size={22} weight="duotone" /></span><h3>Nothing shared with you yet</h3><p className="muted">When someone names your email as an heir in their vault, it appears here. Nothing inside is visible until it is released to you.</p></div>
        : <div className="list">{rows.map((r) => {
          const [l, c] = ST[r.status];
          const sub = r.status === "opened" ? `Opened ${when(nsToMs(r.claimed_ns!))}` : r.status === "released" ? `Released ${when(nsToMs(r.released_ns!))}` : r.status === "waiting" ? `Sealed ${when(nsToMs(r.created_ns))} · stays sealed while they check in` : "Closed by its owner";
          return (<div className="row" key={`${r.vault_id}-${r.heir_index}`}>
            <Persona name={r.owner_name || r.owner} email={r.owner} />
            <div className="grow"><div className="t">{r.owner_name ? `From ${r.owner_name}` : `Vault ${r.vault_id}`}</div><div className="s">{sub}</div></div>
            <span className={`chip ${c}`}>{l}</span>
            {(r.status === "released" || r.status === "opened") && r.link ? <a className="btn btn-dark btn-sm" href={r.status === "opened" ? `/claim/${r.vault_id}/${r.heir_index}#reopen=1` : r.link}><LockKeyOpen size={16} /> {r.status === "opened" ? "Reopen" : "Open"}</a>
              : r.status === "waiting" ? <a className="btn btn-ghost btn-sm" href={`/waiting/${r.vault_id}`}>Details</a> : null}
          </div>);
        })}</div>}
      </div>
    </>
  );
}
export function Proof() {
  const [cfg, setCfg] = useState<any>(null);
  const [sample, setSample] = useState<Vault | null>(null);
  const { vaults } = useApp();
  useEffect(() => { view("get_config").then(setCfg); view<Vault[]>("list_vaults", { from: 1, limit: 100 }).then((v) => setSample(v.find((x) => x.status === "Released" && x.claims.some(Boolean)) || v[v.length - 1] || null)); }, []);
  const shown = vaults[0] || sample;
  const trimmed = shown && { ...shown, notice_ct: shown.notice_ct ? short(shown.notice_ct, 24, 8) : null, claims: shown.claims.map((c) => c && { ...c, key_ct: short(c.key_ct, 24, 8) }) };
  return (
    <>
      <Top title="Proof" sub="What anyone can read, next to what only the enclave can." />
      <div className="compare">
        <div className="card card-pad">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}><span className="icon-chip"><Hash size={20} weight="duotone" /></span><div><b>On NEAR (public)</b><div className="muted" style={{ fontSize: 14 }}>Raw <span className="mono">get_vault</span> for vault #{shown?.id ?? "—"}</div></div></div>
          <pre className="code">{trimmed ? JSON.stringify(trimmed, null, 2) : "No vaults yet."}</pre>
          <p className="muted" style={{ fontSize: 14, marginTop: 12 }}>No names, emails, titles, messages or file names. <span className="mono">notice_ct</span> and <span className="mono">key_ct</span> are ciphertext sealed to the mail keeper and to the heir's one-time browser key.</p>
        </div>
        <div className="card card-pad">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}><span className="icon-chip"><EyeSlash size={20} weight="duotone" /></span><div><b>Inside the enclave only</b><div className="muted" style={{ fontSize: 14 }}>Decrypted in an Intel TDX worker</div></div></div>
          <pre className="code">{`{
  "owner_name": "…",
  "message": "…",
  "file_key": "32 random bytes",
  "files": [{ "cid": "…", "name": "…" }],
  "heirs": [{ "name": "…", "email": "…" }]
}`}</pre>
          <p className="muted" style={{ fontSize: 14, marginTop: 12 }}>Sealed in your browser to the enclave key below with ECIES (secp256k1 + AES-256-GCM).</p>
        </div>
      </div>
      <div className="card card-pad" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}><span className="icon-chip"><Cpu size={20} weight="duotone" /></span><b>Deployment</b></div>
        <dl className="kv">
          <dt>Vault contract</dt><dd><a className="link mono" href={`${EXPLORER}/address/${VAULT_CONTRACT}`} target="_blank" rel="noreferrer">{VAULT_CONTRACT} <ArrowSquareOut size={12} /></a></dd>
          <dt>OutLayer project</dt><dd className="mono">{OUTLAYER_PROJECT}</dd>
          <dt>Enclave public key</dt><dd className="mono">{ENCLAVE_PUBKEY}</dd>
          <dt>Key origin</dt><dd>HKDF of <span className="mono">PROTECTED_MORROWSEAL_MASTER</span>, generated inside the OutLayer keystore TEE</dd>
          <dt>Release rule</dt><dd>Enclave re-reads <span className="mono">get_vault</span> from NEAR RPC and refuses unless status is Released and the ciphertext hash matches</dd>
          <dt>Vaults / events</dt><dd>{cfg ? `${cfg.vaults} / ${cfg.events}` : "…"}</dd>
        </dl>
        <div className="banner" style={{ marginTop: 18 }}><ShieldCheck size={20} /> Each claim and notice is a NEAR transaction that calls <span className="mono">outlayer.testnet.request_execution</span> and resumes with the TEE result. Open any <span className="mono">heir_claimed</span> event on Activity to follow it on NearBlocks.</div>
      </div>
    </>
  );
}

export function Settings() {
  const { account, logout } = useApp();
  const [theme, toggle] = useTheme();
  const toast = useToast();
  const exportLocal = () => { const b = new Blob([JSON.stringify(localVaults(), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "morrowseal-device-notes.json"; a.click(); };
  return (
    <div className="page-form">
      <Top title="Settings" />
      <div className="card card-pad">
        <div className="list">
          <div className="row"><div className="grow"><div className="t">Appearance</div><div className="s">Light follows Trezu's palette; dark keeps the same warm ink.</div></div><button className="btn btn-ghost btn-sm" onClick={toggle}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light" : "Dark"}</button></div>
          <div className="row"><div className="grow"><div className="t">Timezone</div><div className="s">All times show in {Intl.DateTimeFormat().resolvedOptions().timeZone} ({tzLabel()}).</div></div></div>
          <div className="row"><div className="grow"><div className="t">Network</div><div className="s">NEAR testnet · {VAULT_CONTRACT}</div></div><span className="chip chip-amber">Testnet</span></div>
          <div className="row"><div className="grow"><div className="t">Device notes</div><div className="s">Titles and heir names you typed are kept only in this browser.</div></div><button className="btn btn-ghost btn-sm" onClick={exportLocal}><DownloadSimple size={16} /> Export</button></div>
          <div className="row"><div className="grow"><div className="t">Clear device notes</div><div className="s">Vaults stay on chain; this only forgets local titles.</div></div><button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem("ms-vaults"); toast.show({ title: "Device notes cleared", tone: "success" }); }}><Trash size={16} /> Clear</button></div>
          {account && <div className="row"><div className="grow"><div className="t">Signed in</div><div className="s mono">{account}</div></div><button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button></div>}
        </div>
      </div>
    </div>
  );
}
