import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus, Heartbeat, UsersThree, Files, ArrowSquareOut, XCircle, ArrowLeft, Clock } from "@phosphor-icons/react";
import { useToast, StatusBadge } from "@unlocalhosted/metalui";
import { Top, NeedWallet } from "../app/Shell";
import { useApp } from "../app/state";
import { VaultShelf } from "../components/VaultShelf";
import { callVault, deadline, EXPLORER, nsToMs, view, type ChainEvent } from "../lib/near";
import { countdown, span, when, tzLabel, short } from "../lib/format";
import { localVaults } from "../lib/local";
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
  const v = vaults.find((x) => x.id === vid);
  const local = localVaults()[vid];
  useEffect(() => { view<ChainEvent[]>("list_events", { from: 0, limit: 100 }).then((e) => setEvents(e.filter((x) => x.vault_id === vid).reverse())).catch(() => {}); }, [vid, v?.checkins, v?.status]);
  if (!account) return <NeedWallet what="Sign in with the email that owns this vault." />;
  if (!v) return <div className="card empty"><h3>Loading vault…</h3></div>;
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
          <div style={{ fontFamily: "var(--font-display)", fontSize: 44, letterSpacing: "-.04em", margin: "16px 0 4px" }}>{v.status === "Active" ? (left > 0 ? countdown(left) : "Releasing…") : v.status === "Released" ? "Released" : "Cancelled"}</div>
          <p className="muted">{v.status === "Active" ? `Releases on ${when(deadline(v))} (${tzLabel()}) unless you check in. You check in every ${span(v.interval_s)}${v.grace_s ? `, plus ${span(v.grace_s)} grace` : ""}.` : v.status === "Released" ? `Released ${when(nsToMs(v.released_ns!))}. ${v.mailed ? "Heirs were emailed." : "Emailing heirs…"}` : "Nothing will be sent."}</p>
          <dl className="kv" style={{ marginTop: 24 }}>
            <dt>Heirs</dt><dd>{local?.heirs.map((h) => h.name).join(", ") || `${v.heirs} (names are only on the device that made it)`}</dd>
            <dt>Files</dt><dd>{local?.files.map((f) => f.name).join(", ") || "Sealed"}</dd>
            <dt>Check-ins</dt><dd>{v.checkins} · last {when(nsToMs(v.last_checkin_ns))}</dd>
            <dt>Commitment</dt><dd className="mono">{short(v.commitment, 12, 10)}</dd>
            <dt>Sealed blob</dt><dd><a className="link mono" href={`/api/ipfs/${v.cid}`} target="_blank" rel="noreferrer">{short(v.cid, 12, 8)} <ArrowSquareOut size={12} /></a></dd>
          </dl>
          {v.status === "Released" && (
            <div style={{ marginTop: 22 }}>{v.claims.map((c, i) => <div key={i} className="row"><div className="grow"><div className="t">{local?.heirs[i]?.name || `Heir ${i + 1}`}</div><div className="s">{c ? `Opened ${when(nsToMs(c.claimed_ns))}${c.verified_email ? " · email verified by the enclave" : ""}` : "Not opened yet"}</div></div><span className={`chip ${c ? "chip-green" : ""}`}>{c ? "Opened" : "Waiting"}</span></div>)}</div>
          )}
          {v.status === "Active" && <button className="btn btn-ghost btn-sm" style={{ marginTop: 26, color: "var(--danger)" }} onClick={() => confirm("Cancel this vault? Heirs will never receive it.") && act("cancel", "Cancelling")}><XCircle size={16} /> Cancel vault</button>}
        </div>
        <div className="card card-pad">
          <h3 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 21, letterSpacing: "-.03em", marginBottom: 18 }}>History</h3>
          <div className="tl">{events.map((e, i) => <div key={i} className="tl-item"><div className="t">{label(e.kind)}</div><div className="s">{when(nsToMs(e.at_ns))} · {short(e.actor, 14, 8)}</div></div>)}</div>
          <a className="link" href={`${EXPLORER}/address/${v.owner}`} target="_blank" rel="noreferrer" style={{ fontSize: 14 }}>View your account on NearBlocks <ArrowSquareOut size={12} /></a>
        </div>
      </div>
    </>
  );
}

export const label = (k: string) => ({ vault_created: "Vault sealed", checked_in: "Checked in", vault_updated: "Contents replaced", schedule_changed: "Schedule changed", vault_cancelled: "Cancelled", vault_released: "Released after missed check-in", heirs_notified: "Enclave sealed heir notices", heir_email_sent: "Heirs emailed", heir_claimed: "An heir opened it" } as Record<string, string>)[k] || k;
