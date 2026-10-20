import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus, Heartbeat, UsersThree, Files, ArrowSquareOut, XCircle, ArrowLeft, Clock } from "@phosphor-icons/react";
import { useToast, StatusBadge, Avatar } from "@unlocalhosted/metalui";
import { Top, NeedWallet } from "../app/Shell";
import { useApp } from "../app/state";
import { VaultShelf } from "../components/VaultShelf";
import { callVault, deadline, EXPLORER, nsToMs, view, type ChainEvent } from "../lib/near";
import { countdown, span, when, tzLabel, short } from "../lib/format";
import { localVaults } from "../lib/local";
import { identityToken } from "../lib/privy";
import { fetchCid } from "../lib/api";
import { buildOwnerOpen, openGift, OWNER_PREVIEW_FROM } from "@shared/morrowseal.mjs";
import { useNow } from "../components/ui";

export default function Vaults() {
  const { account, vaults, refresh } = useApp();
  const nav = useNavigate();
  const toast = useToast();
  const now = useNow();
  if (!account) return (<><Top title="Your vaults" sub="Everything here is sealed. Only hashes live on NEAR." /><NeedWallet what="Your vaults are tied to your NEAR account, so you can check in from anywhere." /></>);
  const active = vaults.filter((v) => v.status === "Active");
  const next = active.map((v) => deadline(v) - now).sort((a, b) => a - b)[0];
  const heirs = vaults.reduce((n, v) => n + (v.status !== "Cancelled" ? v.heirs : 0), 0);
  async function checkInAll() {
    for (const v of active) await toast.promise(callVault("check_in", { vault_id: v.id }, { tgas: 20 }), { loading: { title: `Checking in · ${v.title}` }, success: { title: "You're checked in", sub: v.title, tone: "success" }, error: (e: any) => ({ title: "Check-in failed", sub: String(e?.message || e).slice(0, 80), tone: "error" }) });
    refresh();
  }
  return (
    <>
      <Top title="Your vaults" sub="Everything here is sealed. Only hashes live on NEAR.">
        {active.length > 0 && <button className="btn btn-brand btn-sm" onClick={checkInAll}><Heartbeat size={16} weight="bold" /> I'm here</button>}
        <Link to="/app/create" className="btn btn-dark btn-sm"><Plus size={16} weight="bold" /> New vault</Link>
      </Top>
      <div className="grid-3" style={{ marginBottom: 22 }}>
        <div className="card kpi"><div className="l"><Clock size={16} /> Next release without a check-in</div><div className="v">{next === undefined ? "—" : next > 0 ? countdown(next) : "Now"}</div></div>
        <div className="card kpi"><div className="l"><UsersThree size={16} /> Heirs named</div><div className="v">{heirs}</div></div>
        <div className="card kpi"><div className="l"><Files size={16} /> Vaults</div><div className="v">{vaults.length}</div></div>
      </div>
      {vaults.length === 0 ? (
        <div className="card empty"><span className="icon-chip" style={{ margin: "0 auto" }}><Files size={22} weight="duotone" /></span><h3>No vaults yet</h3><p>Seal a letter or a few documents for someone. It takes about two minutes, and you can use a 2-minute check-in to watch the whole flow.</p><Link to="/app/create" className="btn btn-dark">Create your first vault</Link></div>
      ) : <VaultShelf vaults={vaults} onOpen={(id) => nav(`/app/vault/${id}`)} />}
    </>
  );
}

export function VaultDetail() {
  const { id } = useParams();
  const vid = Number(id);
  const { vaults, refresh, account } = useApp();
  const toast = useToast();
  const now = useNow();
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [evErr, setEvErr] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, []);
  const v = vaults.find((x) => x.id === vid);
  const local = localVaults()[vid];
  useEffect(() => {
    let live = true, t: any;
    const load = async () => {
      try {
        const all = await view<ChainEvent[]>("list_events", { vault: vid });
        if (live) { setEvents(all.reverse()); setEvErr(false); }
      } catch { if (live) setEvErr(true); }
      if (live) t = setTimeout(load, 10000);
    };
    load(); return () => { live = false; clearTimeout(t); };
  }, [vid]);
  // While the deadline has passed but the chain still says Active, poll quickly.
  useEffect(() => { if (!v || v.status !== "Active" || deadline(v) > now) return; const t = setInterval(() => refresh(), 5000); return () => clearInterval(t); }, [v?.status, v && deadline(v) <= now]);
  if (!account) return <NeedWallet what="Sign in with the email that owns this vault." />;
  if (!v) return <div className="card empty"><h3>{slow ? "This vault isn't loading" : "Loading vault…"}</h3>{slow && <p className="muted">It may belong to another account, or the network is slow. We'll keep trying. <Link className="link" to="/app">Back to your vaults</Link></p>}</div>;
  const left = deadline(v) - now;
  const act = (method: string, label: string) => toast.promise(callVault(method, { vault_id: v.id }, { tgas: 20 }).then((r) => { refresh(); return r; }), { loading: { title: label }, success: { title: method === "cancel" ? "Vault cancelled" : "You're checked in", tone: "success" }, error: (e: any) => ({ title: "That didn't go through", sub: String(e?.message || e).slice(0, 80), tone: "error" }) });
  return (
    <>
      <Link to="/app" className="muted" style={{ display: "inline-flex", gap: 6, alignItems: "center", marginBottom: 14 }}><ArrowLeft size={16} /> All vaults</Link>
      <Top title={v.title} sub={`Vault #${v.id} · created ${when(nsToMs(v.created_ns))} (${tzLabel()})`}>
        {v.status === "Active" && <button className="btn btn-brand btn-sm" onClick={() => act("check_in", "Checking in")}><Heartbeat size={16} weight="bold" /> I'm here</button>}
      </Top>
      <div className="grid-2">
        <div className="card card-pad">
          <StatusBadge led={v.status === "Active" ? "waiting" : v.status === "Released" ? "live" : "off"}>{v.status.toUpperCase()}</StatusBadge>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 44, letterSpacing: "-.04em", margin: "16px 0 4px" }}>{v.status === "Active" ? (left > 0 ? countdown(left) : "Releasing…") : v.status === "Released" ? (v.claims.every(Boolean) ? "Opened" : "Claimable") : "Cancelled"}</div>
          <p className="muted">{v.status === "Active" ? `Releases on ${when(deadline(v))} (${tzLabel()}) unless you check in. You check in every ${span(v.interval_s)}${v.grace_s ? `, plus ${span(v.grace_s)} grace` : ""}.` : v.status === "Released" ? `Released ${when(nsToMs(v.released_ns!))}. ${v.mailed ? "Heirs were emailed." : "Emailing heirs…"}` : "Nothing will be sent."}</p>
          <dl className="kv" style={{ marginTop: 24 }}>
            <dt>Heirs</dt><dd>{local?.heirs.length ? <span className="heir-chips">{local.heirs.map((h, k) => <span key={k} className="heir-chip" title={`${h.name} · ${h.email}`}><Avatar name={h.name} size="small" /><span className="ellipsis">{h.name}</span></span>)}</span> : `${v.heirs} (names are only on the device that made it)`}</dd>
            <dt>Files</dt><dd>{local?.files.map((f) => f.name).join(", ") || "Sealed"}</dd>
            <dt>Emails</dt><dd>{v.status === "Released" ? (v.mailed ? "Heirs have been emailed their link." : "Emailing heirs now…") : `Heirs were told they were named. Their link is emailed only if you miss a check-in (after ${span(v.interval_s + v.grace_s)} of silence).`}</dd>
            <dt>Check-ins</dt><dd>{v.checkins} · last {when(nsToMs(v.last_checkin_ns))}</dd>
            <dt>Commitment</dt><dd className="mono">{short(v.commitment, 12, 10)}</dd>
            <dt>Preview</dt><dd><OwnerOpen v={v} /></dd>
            <dt>Sealed blob</dt><dd><a className="link mono" href={`/api/ipfs/${v.cid}`} target="_blank" rel="noreferrer">{short(v.cid, 12, 8)} <ArrowSquareOut size={12} /></a></dd>
          </dl>
          {v.status === "Released" && (
            <div style={{ marginTop: 22 }}>{v.claims.map((c, i) => <div key={i} className="row"><div className="grow"><div className="t">{local?.heirs[i]?.name || `Heir ${i + 1}`}</div><div className="s">{c ? `Opened ${when(nsToMs(c.claimed_ns))}${c.verified_email ? " · email verified by the enclave" : ""}` : "Not opened yet"}</div></div><span className={`chip ${c ? "chip-green" : ""}`}>{c ? "Opened" : "Waiting"}</span></div>)}</div>
          )}
          {v.status === "Active" && <button className="btn btn-ghost btn-sm" style={{ marginTop: 26, color: "var(--danger)" }} onClick={() => confirm("Cancel this vault? Heirs will never receive it.") && act("cancel", "Cancelling")}><XCircle size={16} /> Cancel vault</button>}
        </div>
        <div className="card card-pad">
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 21, letterSpacing: "-.03em", marginBottom: 18 }}>History</h3>
          {events.length === 0 ? <p className="muted" style={{ marginBottom: 16 }}>{evErr ? "Couldn't load history right now. Retrying…" : "Loading history…"}</p> :
          <div className="tl">{events.map((e, i) => <div key={i} className="tl-item"><div className="t">{label(e.kind)}</div><div className="s">{when(nsToMs(e.at_ns))} · {e.actor === v.owner ? "you" : e.actor.endsWith(".testnet") ? "the keeper" : short(e.actor, 10, 6)}{e.detail ? ` · ${e.detail}` : ""}</div></div>)}</div>}
          <a className="link" href={`${EXPLORER}/address/${v.owner}`} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>View your account on NearBlocks <ArrowSquareOut size={12} /></a>
        </div>
      </div>
    </>
  );
}

export const label = (k: string) => ({ vault_created: "Vault sealed", checked_in: "Checked in", vault_updated: "Contents replaced", schedule_changed: "Schedule changed", vault_cancelled: "Cancelled", vault_released: "Deadline missed", heirs_notified: "Heirs notified", heir_email_sent: "Heirs emailed", heir_claimed: "Claimed" } as Record<string, string>)[k] || k;

/** Owner preview: the enclave checks your sign-in email against the one sealed inside, then re-seals the key to this browser only. */
function OwnerOpen({ v }: { v: any }) {
  const [st, setSt] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  const [gift, setGift] = useState<any>(null);
  if (v.id < OWNER_PREVIEW_FROM) return <span className="muted">Owner preview unavailable for vaults sealed before this update</span>;
  if (v.status === "Cancelled") return <span className="muted">Cancelled</span>;
  const go = async () => {
    setSt("busy"); setErr("");
    try {
      const ct = await fetchCid(v.cid);
      const ctHex = Array.from(ct, (b) => b.toString(16).padStart(2, "0")).join("");
      const tok = await identityToken();
      if (!tok) throw new Error("Sign in again to open this vault");
      const req = buildOwnerOpen({ idToken: tok });
      const r = await callVault("owner_open", { vault_id: v.id, ciphertext_hex: ctHex, request_hex: req.requestHex }, { tgas: 300, deposit: "20000000000000000000000" });
      if (!r.value?.ok) throw new Error(r.value?.error || "The enclave did not answer");
      setGift(await openGift(req.ephSk, r.value.key_ct, fetchCid)); setSt("done");
    } catch (e: any) { setErr(String(e?.message || e).slice(0, 160)); setSt("idle"); }
  };
  if (st === "done" && gift) return (
    <div className="owner-preview">
      {gift.message && <p style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>{gift.message}</p>}
      {gift.files.map((f: any, i: number) => <div key={i}><a className="link ellipsis" download={f.name} href={URL.createObjectURL(new Blob([f.bytes], { type: f.type }))}>{f.name}</a></div>)}
      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>Decrypted in this browser only.</p>
    </div>);
  return <span><button className="btn btn-sm" disabled={st === "busy"} onClick={go}>{st === "busy" ? "Opening…" : "Open vault"}</button>{err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 6 }}>{err}</div>}<div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Costs about 0.02 NEAR for the enclave.</div></span>;
}
