import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Heartbeat, UsersThree, ArrowSquareOut, ShieldCheck, Cpu, Hash, EyeSlash, Moon, Sun, Trash, DownloadSimple } from "@phosphor-icons/react";
import { Pagination, useToast } from "@unlocalhosted/metalui";
import { Top, NeedWallet } from "../app/Shell";
import { useApp } from "../app/state";
import { callVault, deadline, EXPLORER, nsToMs, view, type ChainEvent, type Vault } from "../lib/near";
import { countdown, span, when, tzLabel, short } from "../lib/format";
import { localVaults } from "../lib/local";
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
              <span className="icon-chip" style={{ width: 40, height: 40, borderRadius: 12 }}>{(h?.name || "?").slice(0, 1).toUpperCase()}</span>
              <div className="grow"><div className="t">{h?.name || `Heir ${i + 1}`}</div><div className="s">{h?.email || "Sealed (created on another device)"} · {v.title}</div></div>
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
export function Activity() {
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [page, setPage] = useState(1);
  const [mine, setMine] = useState(true);
  const { account, vaults } = useApp();
  useEffect(() => { (async () => { const cfg = await view("get_config"); const n = cfg.events; const all: ChainEvent[] = []; for (let f = 0; f < n; f += 100) all.push(...(await view<ChainEvent[]>("list_events", { from: f, limit: 100 }))); setEvents(all.reverse()); })().catch(() => {}); }, [vaults.length]);
  const ids = new Set(vaults.map((v) => v.id));
  const list = useMemo(() => (mine && account ? events.filter((e) => ids.has(e.vault_id)) : events), [events, mine, account, vaults]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  return (
    <>
      <Top title="Activity" sub={`Public events from ${VAULT_CONTRACT}. Times in ${tzLabel()}.`}>
        <div className="seg">{account && <button className={mine ? "on" : ""} onClick={() => { setMine(true); setPage(1); }}>My vaults</button>}<button className={!mine || !account ? "on" : ""} onClick={() => { setMine(false); setPage(1); }}>Everyone</button></div>
      </Top>
      <div className="card card-pad">
        {list.length === 0 ? <p className="muted">No events yet.</p> : <div className="list">{list.slice((page - 1) * PAGE, page * PAGE).map((e, i) => (
          <div className="row" key={i}><div className="grow"><div className="t">{label(e.kind)} <span className="muted" style={{ fontWeight: 400 }}>· vault #{e.vault_id}</span></div><div className="s">{e.detail || "—"} · by <a className="link mono" href={`${EXPLORER}/address/${e.actor}`} target="_blank" rel="noreferrer">{short(e.actor, 14, 8)}</a></div></div><div className="muted" style={{ fontSize: 13, textAlign: "right" }}>{when(nsToMs(e.at_ns))}</div></div>))}</div>}
        {pages > 1 && <div className="pager"><Pagination page={page} count={pages} onPageChange={setPage} aria-label="Activity pages" /></div>}
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
    <>
      <Top title="Settings" />
      <div className="card card-pad" style={{ maxWidth: 720 }}>
        <div className="list">
          <div className="row"><div className="grow"><div className="t">Appearance</div><div className="s">Light follows Trezu's palette; dark keeps the same warm ink.</div></div><button className="btn btn-ghost btn-sm" onClick={toggle}>{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />} {theme === "dark" ? "Light" : "Dark"}</button></div>
          <div className="row"><div className="grow"><div className="t">Timezone</div><div className="s">All times show in {Intl.DateTimeFormat().resolvedOptions().timeZone} ({tzLabel()}).</div></div></div>
          <div className="row"><div className="grow"><div className="t">Network</div><div className="s">NEAR testnet · {VAULT_CONTRACT}</div></div><span className="chip chip-amber">Testnet</span></div>
          <div className="row"><div className="grow"><div className="t">Device notes</div><div className="s">Titles and heir names you typed are kept only in this browser.</div></div><button className="btn btn-ghost btn-sm" onClick={exportLocal}><DownloadSimple size={16} /> Export</button></div>
          <div className="row"><div className="grow"><div className="t">Clear device notes</div><div className="s">Vaults stay on chain; this only forgets local titles.</div></div><button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem("ms-vaults"); toast.show({ title: "Device notes cleared", tone: "success" }); }}><Trash size={16} /> Clear</button></div>
          {account && <div className="row"><div className="grow"><div className="t">Signed in</div><div className="s mono">{account}</div></div><button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button></div>}
        </div>
      </div>
    </>
  );
}
