import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Plus, Heartbeat, UsersThree, Files, ArrowSquareOut, XCircle, ArrowLeft, Clock, PencilSimple } from "@phosphor-icons/react";
import { useToast } from "../components/toast";
import { Top, NeedWallet } from "../app/Shell";
import { useApp } from "../app/state";
import { VaultShelf } from "../components/VaultShelf";
import { callVault, deadline, EXPLORER, nsToMs, view, type ChainEvent } from "../lib/near";
import { countdown, span, when, tzLabel, short } from "../lib/format";
import { ownerOpen, friendly } from "../lib/ownerOpen";
import { saveLocal } from "../lib/local";
import { RevealHeirs, useLocalVaults } from "../components/RevealHeirs";
import { OWNER_PREVIEW_FROM } from "@shared/morrowseal.mjs";
import { Card, Empty, HeirChip, Kv, Mono, Panel, Row, btn, useNow } from "../components/ui";
import { Button } from "@/components/motion/button/base";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { NumberTicker } from "@/components/motion/number-ticker";

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
  const kpi = "gap-2 px-5";
  const lab = "flex items-center gap-2 text-sm text-muted-foreground";
  const val = "text-3xl font-semibold tracking-tight tabular-nums";
  return (
    <>
      <Top title="Your vaults" sub="Everything here is sealed. Only hashes live on NEAR.">
        {active.length > 0 && <Button size="sm" onClick={checkInAll}><Heartbeat size={16} weight="bold" /> I'm here</Button>}
        <Link to="/app/create" className={btn("secondary", "sm")}><Plus size={16} weight="bold" /> New vault</Link>
      </Top>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card size="compact" className={kpi}><div className={lab}><Clock size={16} /> Next release without a check-in</div><div className={val}>{next === undefined ? "—" : next > 0 ? countdown(next) : "Now"}</div></Card>
        <Card size="compact" className={kpi}><div className={lab}><UsersThree size={16} /> Heirs named</div><div className={val}><NumberTicker value={heirs} /></div></Card>
        <Card size="compact" className={kpi}><div className={lab}><Files size={16} /> Vaults</div><div className={val}><NumberTicker value={vaults.length} /></div></Card>
      </div>
      {vaults.length === 0 ? (
        <Card><Empty icon={<Files size={22} weight="duotone" />} title="No vaults yet" action={<Link to="/app/create" className={btn("primary", "md", "mt-1")}>Create your first vault</Link>}>Seal a letter or a few documents for someone. It takes about two minutes, and you can use a 2-minute check-in to watch the whole flow.</Empty></Card>
      ) : <VaultShelf vaults={vaults} onOpen={(id) => nav(`/app/vault/${id}`)} />}
    </>
  );
}

export function VaultDetail() {
  const { id } = useParams();
  const vid = Number(id);
  const { vaults, refresh, account, watch } = useApp();
  const toast = useToast();
  const now = useNow();
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [evErr, setEvErr] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, []);
  const v = vaults.find((x) => x.id === vid);
  const local = useLocalVaults()[vid];
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
  if (!v) return <Card><Empty icon={<Files size={22} weight="duotone" />} title={slow ? "This vault isn't loading" : "Loading vault…"}>{slow && <>It may belong to another account, or the network is slow. We'll keep trying. <Link className="text-primary underline underline-offset-4" to="/app">Back to your vaults</Link></>}</Empty></Card>;
  const left = deadline(v) - now;
  const act = (method: string, label: string) => toast.promise(callVault(method, { vault_id: v.id }, { tgas: 20 }).then((r) => { refresh(); return r; }), { loading: { title: label }, success: { title: method === "cancel" ? "Vault cancelled" : "You're checked in", tone: "success" }, error: (e: any) => ({ title: "That didn't go through", sub: String(e?.message || e).slice(0, 80), tone: "error" }) });
  const stStatus = v.status === "Active" ? (left > 0 ? "success" : "warning") : v.status === "Released" ? "info" : "neutral";
  const link = "inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline";
  return (
    <>
      <Link to="/app" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={16} /> All vaults</Link>
      <Top title={v.title} sub={`Vault #${v.id} · created ${when(nsToMs(v.created_ns))} (${tzLabel()})`}>
        {!watch && <Button variant="outline" size="sm" onClick={() => {
          const t = window.prompt("Vault title (kept off-chain, synced encrypted to your devices)", local?.title || v.title);
          if (t == null || !t.trim()) return;
          saveLocal(v.id, { title: t.trim().slice(0, 60), heirs: local?.heirs || [], files: local?.files || [], createdAt: local?.createdAt || Date.now() });
          toast.show({ title: "Renamed", sub: t.trim().slice(0, 60), tone: "success" });
        }}><PencilSimple size={16} /> Rename</Button>}
        {v.status === "Active" && <Button size="sm" onClick={() => act("check_in", "Checking in")}><Heartbeat size={16} weight="bold" /> I'm here</Button>}
      </Top>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel>
          <AnimatedBadge status={stStatus} size="md" className="self-start">{v.status}</AnimatedBadge>
          <div className="mb-1 mt-4 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{v.status === "Active" ? (left > 0 ? countdown(left) : "Releasing…") : v.status === "Released" ? (v.claims.every(Boolean) ? "Opened" : "Claimable") : "Cancelled"}</div>
          <p className="text-sm text-muted-foreground">{v.status === "Active" ? `Releases on ${when(deadline(v))} (${tzLabel()}) unless you check in. You check in every ${span(v.interval_s)}${v.grace_s ? `, plus ${span(v.grace_s)} grace` : ""}.` : v.status === "Released" ? `Released ${when(nsToMs(v.released_ns!))}. ${v.mailed ? "Heirs were emailed." : "Emailing heirs…"}` : "Nothing will be sent."}</p>
          <Kv className="mt-6 border-t border-border pt-5" rows={[
            ["Heirs", local?.heirs.length ? <span className="flex flex-wrap gap-1.5">{local.heirs.map((h, k) => <HeirChip key={k} name={h.name} email={h.email} />)}</span> : <span>{v.heirs} sealed {v.heirs === 1 ? "heir" : "heirs"}{!watch && <div className="mt-1.5"><RevealHeirs v={v} /></div>}</span>],
            ["Files", local?.files.map((f) => f.name).join(", ") || "Sealed"],
            ["Emails", v.status === "Released" ? (v.mailed ? "Heirs have been emailed their link." : "Emailing heirs now…") : `Heirs were told they were named. Their link is emailed only if you miss a check-in (after ${span(v.interval_s + v.grace_s)} of silence).`],
            ["Check-ins", `${v.checkins} · last ${when(nsToMs(v.last_checkin_ns))}`],
            ["Commitment", <Mono>{short(v.commitment, 12, 10)}</Mono>],
            ["Preview", <OwnerOpen v={v} />],
            ["Sealed blob", <a className={link} href={`/api/ipfs/${v.cid}`} target="_blank" rel="noreferrer"><Mono>{short(v.cid, 12, 8)}</Mono> <ArrowSquareOut size={12} /></a>],
          ]} />
          {v.status === "Released" && (
            <div className="mt-6 border-t border-border pt-5">{v.claims.map((c, i) => <Row key={i}><div className="min-w-0 flex-1"><div className="text-sm font-medium">{local?.heirs[i]?.name || `Heir ${i + 1}`}</div><div className="text-xs text-muted-foreground">{c ? `Opened ${when(nsToMs(c.claimed_ns))}${c.verified_email ? " · email verified by the enclave" : ""}` : "Not opened yet"}</div></div><AnimatedBadge size="sm" status={c ? "success" : "neutral"}>{c ? "Opened" : "Waiting"}</AnimatedBadge></Row>)}</div>
          )}
          {v.status === "Active" && <Button variant="ghost" size="sm" className="mt-6 self-start text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => confirm("Cancel this vault? Heirs will never receive it.") && act("cancel", "Cancelling")}><XCircle size={16} /> Cancel vault</Button>}
        </Panel>
        <Panel>
          <h3 className="mb-5 text-lg font-semibold tracking-tight">History</h3>
          {events.length === 0 ? <p className="mb-4 text-sm text-muted-foreground">{evErr ? "Couldn't load history right now. Retrying…" : "Loading history…"}</p> :
          <ol className="relative mb-5 ml-2 flex flex-col gap-5 border-l border-border pl-5">{events.map((e, i) => <li key={i} className="relative"><span className={`absolute -left-[1.62rem] top-1.5 size-2.5 rounded-full ring-4 ring-background ${i === 0 ? "bg-primary" : "bg-foreground/25"}`} /><div className="text-sm font-medium">{label(e.kind)}</div><div className="text-xs text-muted-foreground">{when(nsToMs(e.at_ns))} · {e.actor === v.owner ? "you" : e.actor.endsWith(".testnet") ? "the keeper" : short(e.actor, 10, 6)}{e.detail ? ` · ${e.detail}` : ""}</div></li>)}</ol>}
          <a className={link + " text-sm"} href={`${EXPLORER}/address/${v.owner}`} target="_blank" rel="noreferrer">View your account on NearBlocks <ArrowSquareOut size={12} /></a>
        </Panel>
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
  if (v.id < OWNER_PREVIEW_FROM) return <span className="text-muted-foreground">Owner preview unavailable for vaults sealed before this update</span>;
  if (v.status === "Cancelled") return <span className="text-muted-foreground">Cancelled</span>;
  const go = async () => {
    setSt("busy"); setErr("");
    try {
      setGift(await ownerOpen(v)); setSt("done");
    } catch (e: any) { setErr(friendly(e)); setSt("idle"); }
  };
  if (st === "done" && gift) return (
    <div className="rounded-xl bg-muted/60 p-3">
      {gift.message && <p className="mb-2 whitespace-pre-wrap">{gift.message}</p>}
      {gift.files.map((f: any, i: number) => <div key={i}><a className="block truncate text-primary underline-offset-4 hover:underline" download={f.name} href={URL.createObjectURL(new Blob([f.bytes], { type: f.type }))}>{f.name}</a></div>)}
      <p className="mt-1.5 text-xs text-muted-foreground">Decrypted in this browser only.</p>
    </div>);
  return <span><Button variant="secondary" size="sm" disabled={st === "busy"} onClick={go}>{st === "busy" ? "Opening…" : "Open vault"}</Button>{err && <div className="mt-1.5 text-sm text-destructive">{err}</div>}<div className="mt-1 text-xs text-muted-foreground">Free. The keeper pays the enclave fee.</div></span>;
}
