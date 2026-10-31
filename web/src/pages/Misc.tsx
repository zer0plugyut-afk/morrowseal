import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Heartbeat, UsersThree, ArrowSquareOut, ShieldCheck, Cpu, Hash, EyeSlash, Moon, Sun, Trash, DownloadSimple, LockKey, PencilSimple, Clock, Warning, Bell, EnvelopeSimple, LockKeyOpen, XCircle, Info, ClockCounterClockwise, HandHeart, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useToast } from "../components/toast";
import { Button } from "@/components/motion/button/base";
import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Persona } from "../components/Persona";
import { RevealHeirs, useLocalVaults } from "../components/RevealHeirs";
import { Top, NeedWallet } from "../app/Shell";
import { useApp } from "../app/state";
import { callVault, deadline, EXPLORER, nsToMs, view, type ChainEvent, type Vault } from "../lib/near";
import { countdown, span, when, tzLabel, short } from "../lib/format";
import { localVaults } from "../lib/local";
import { identityToken } from "../lib/privy";
import { Banner, Card, Empty, IconChip, Kv, Mono, Row, Spinner, btn, useNow } from "../components/ui";
import { label } from "./Vaults";
import { VAULT_CONTRACT, OUTLAYER_PROJECT, ENCLAVE_PUBKEY } from "@shared/morrowseal.mjs";

export function Heirs() {
  const { account, vaults, watch } = useApp();
  const local = useLocalVaults();
  if (!account) return (<><Top title="Heirs" /><NeedWallet what="See who you've named in each vault." /></>);
  const rows = vaults.filter((v) => v.status !== "Cancelled").flatMap((v) => Array.from({ length: v.heirs }, (_, i) => ({ v, i, h: local[v.id]?.heirs[i] })));
  return (
    <>
      <Top title="Heirs" sub="Names and emails live inside the sealed vault and on your devices, never on NEAR (it sees a count). On a new device, use Show heir details." />
      <Card className="px-5 sm:px-6">
        {rows.length === 0 ? <Empty icon={<UsersThree size={22} weight="duotone" />} title="No heirs yet" action={<Link className={btn("primary", "md")} to="/app/create">Create a vault</Link>}>Name heirs when you create a vault.</Empty> :
          <div>{rows.map(({ v, i, h }) => (
            <Row key={`${v.id}-${i}`}>
              <span className="shrink-0"><Persona email={h?.email} name={h?.name || `Heir ${i + 1}`} /></span>
              <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium" title={h?.name}>{h?.name || `Heir ${i + 1}`}</div><div className="truncate text-xs text-muted-foreground" title={h?.email}>{h?.email || "Sealed in the vault"} · {v.title}</div>{!h && i === 0 && !watch && <div className="mt-1.5"><RevealHeirs v={v} /></div>}</div>
              <AnimatedBadge size="sm" status={v.claims[i] ? "success" : v.status === "Released" ? "warning" : "info"}>{v.claims[i] ? "Opened" : v.status === "Released" ? "Emailed" : "Sealed"}</AnimatedBadge>
            </Row>))}</div>}
      </Card>
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
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="items-center justify-center px-6 py-10">
          <motion.button whileTap={{ scale: 0.95 }} className="group relative grid size-48 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 outline-none transition-opacity focus-visible:ring-4 focus-visible:ring-primary/30 disabled:opacity-50 disabled:shadow-none" onClick={go} disabled={!active.length}>
            {active.length > 0 && <span className="absolute inset-0 animate-ping rounded-full bg-primary/25 [animation-duration:2.6s]" />}
            <span className="relative flex flex-col items-center gap-1 text-lg font-semibold"><Heartbeat size={40} weight="bold" />I'm here<small className="max-w-32 text-xs font-normal opacity-80">{active.length ? `Resets ${active.length} vault${active.length > 1 ? "s" : ""}` : "No active vaults"}</small></span>
          </motion.button>
        </Card>
        <Card className="px-5 sm:px-6">
          <h3 className="text-lg font-semibold tracking-tight">Deadlines</h3>
          <div>{active.length === 0 ? <p className="text-sm text-muted-foreground">Nothing is counting down.</p> : active.map((v) => (
            <Row key={v.id}><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{v.title}</div><div className="text-xs text-muted-foreground">Every {span(v.interval_s)} · last {when(nsToMs(v.last_checkin_ns))}</div></div><div className="text-right"><Mono className="font-semibold">{deadline(v) > now ? countdown(deadline(v) - now) : "due"}</Mono><div className="text-xs text-muted-foreground">{when(deadline(v))}</div></div></Row>))}</div>
        </Card>
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
const TONE: Record<string, string> = { brand: "bg-primary/10 text-primary", green: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400", muted: "bg-muted text-muted-foreground" };

function Pager({ page, count, onPage }: { page: number; count: number; onPage: (p: number) => void }) {
  const nums = Array.from({ length: count }, (_, i) => i + 1).filter((n) => n === 1 || n === count || Math.abs(n - page) <= 1);
  return (
    <nav aria-label="Activity pages" className="mt-5 flex items-center justify-center gap-1 border-t border-border pt-5">
      <Button variant="ghost" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><CaretLeft size={16} /></Button>
      {nums.map((n, k) => (
        <span key={n} className="flex items-center gap-1">
          {k > 0 && n - nums[k - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
          <button onClick={() => onPage(n)} aria-current={n === page ? "page" : undefined} className={cn("grid size-9 place-items-center rounded-full text-sm font-medium tabular-nums transition-colors", n === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{n}</button>
        </span>
      ))}
      <Button variant="ghost" size="icon" aria-label="Next page" disabled={page >= count} onClick={() => onPage(page + 1)}><CaretRight size={16} /></Button>
    </nav>
  );
}

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
      <Card className="px-5 sm:px-6">
        {events === null ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>
        : list.length === 0 ? (
          <Empty icon={<ClockCounterClockwise size={22} weight="duotone" />} title="Nothing here yet" action={<div className="mt-2 flex gap-2"><Link className={btn("primary", "sm")} to="/app/create">Create a vault</Link><Link className={btn("secondary", "sm")} to="/app/shared">Shared with me</Link></div>}>Create a vault, check in, or open something left for you, and it shows up here with the time in your timezone and a link to the NEAR record.</Empty>
        ) : <div>{list.slice((page - 1) * PAGE, page * PAGE).map((e, i) => {
          const [l, I, tone] = (e.role === "heir" ? HEIR_EV[e.kind] : EV[e.kind]) || EV[e.kind] || [e.kind, Info, "muted"];
          const by = e.role === "heir" ? "" : e.actor === account ? " · by you" : e.actor === "keeper" || e.actor.endsWith(".testnet") ? " · by the keeper" : "";
          return (<Row key={i}><span className={cn("grid size-9 shrink-0 place-items-center rounded-full", TONE[tone])}><I size={18} weight="duotone" /></span><div className="min-w-0 flex-1"><div className="text-sm font-medium">{l} <span className="font-normal text-muted-foreground">· {titleOf(e)}</span></div><div className="text-xs text-muted-foreground">{when(nsToMs(e.at_ns))}{e.detail && e.role !== "heir" ? ` · ${e.detail}` : ""}{by}</div></div></Row>);
        })}</div>}
        {pages > 1 && <Pager page={page} count={pages} onPage={setPage} />}
      </Card>
    </>
  );
}

type Shared = { vault_id: number; heir_index: number; heir_name: string; owner_name: string; owner: string; status: "waiting" | "released" | "opened" | "cancelled"; created_ns: string; released_ns: string | null; claimed_ns: string | null; link: string | null };
const ST: Record<Shared["status"], [string, AnimatedBadgeStatus]> = { waiting: ["Waiting", "info"], released: ["Released", "warning"], opened: ["Opened", "success"], cancelled: ["Closed", "neutral"] };
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
      <Card className="px-5 sm:px-6">
        {err && !rows ? <Banner tone="warn">{err}</Banner>
        : rows === null ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner /> Loading…</p>
        : rows.length === 0 ? <Empty icon={<HandHeart size={22} weight="duotone" />} title="Nothing shared with you yet">When someone names your email as an heir in their vault, it appears here. Nothing inside is visible until it is released to you.</Empty>
        : <div>{rows.map((r) => {
          const [l, c] = ST[r.status];
          const sub = r.status === "opened" ? `Opened ${when(nsToMs(r.claimed_ns!))}` : r.status === "released" ? `Released ${when(nsToMs(r.released_ns!))}` : r.status === "waiting" ? `Sealed ${when(nsToMs(r.created_ns))} · stays sealed while they check in` : "Closed by its owner";
          return (<Row key={`${r.vault_id}-${r.heir_index}`}>
            <Persona name={r.owner_name || r.owner} email={r.owner} />
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{r.owner_name ? `From ${r.owner_name}` : `Vault ${r.vault_id}`}</div><div className="text-xs text-muted-foreground">{sub}</div></div>
            <AnimatedBadge size="sm" status={c}>{l}</AnimatedBadge>
            {(r.status === "released" || r.status === "opened") && r.link ? <a className={btn("primary", "sm")} href={r.status === "opened" ? `/claim/${r.vault_id}/${r.heir_index}#reopen=1` : r.link}><LockKeyOpen size={16} /> {r.status === "opened" ? "Reopen" : "Open"}</a>
              : r.status === "waiting" ? <a className={btn("secondary", "sm")} href={`/waiting/${r.vault_id}`}>Details</a> : null}
          </Row>);
        })}</div>}
      </Card>
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
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 gap-4 px-5 sm:px-6">
          <div className="flex items-center gap-3"><IconChip><Hash size={20} weight="duotone" /></IconChip><div><b className="text-sm">On NEAR (public)</b><div className="text-sm text-muted-foreground">Raw <Mono>get_vault</Mono> for vault #{shown?.id ?? "—"}</div></div></div>
          <pre className="max-h-96 overflow-auto rounded-2xl bg-muted/60 p-4 font-mono text-xs leading-relaxed">{trimmed ? JSON.stringify(trimmed, null, 2) : "No vaults yet."}</pre>
          <p className="text-sm text-muted-foreground">No names, emails, titles, messages or file names. <Mono>notice_ct</Mono> and <Mono>key_ct</Mono> are ciphertext sealed to the mail keeper and to the heir's one-time browser key.</p>
        </Card>
        <Card className="min-w-0 gap-4 px-5 sm:px-6">
          <div className="flex items-center gap-3"><IconChip><EyeSlash size={20} weight="duotone" /></IconChip><div><b className="text-sm">Inside the enclave only</b><div className="text-sm text-muted-foreground">Decrypted in an Intel TDX worker</div></div></div>
          <pre className="overflow-auto rounded-2xl bg-muted/60 p-4 font-mono text-xs leading-relaxed">{`{
  "owner_name": "…",
  "message": "…",
  "file_key": "32 random bytes",
  "files": [{ "cid": "…", "name": "…" }],
  "heirs": [{ "name": "…", "email": "…" }]
}`}</pre>
          <p className="text-sm text-muted-foreground">Sealed in your browser to the enclave key below with ECIES (secp256k1 + AES-256-GCM).</p>
        </Card>
      </div>
      <Card className="mt-4 gap-5 px-5 sm:px-6">
        <div className="flex items-center gap-3"><IconChip><Cpu size={20} weight="duotone" /></IconChip><b>Deployment</b></div>
        <Kv rows={[
          ["Vault contract", <a key="a" className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline" href={`${EXPLORER}/address/${VAULT_CONTRACT}`} target="_blank" rel="noreferrer"><Mono>{VAULT_CONTRACT}</Mono> <ArrowSquareOut size={12} /></a>],
          ["OutLayer project", <Mono key="b">{OUTLAYER_PROJECT}</Mono>],
          ["Enclave public key", <Mono key="c" className="break-all">{ENCLAVE_PUBKEY}</Mono>],
          ["Key origin", <span key="d">HKDF of <Mono>PROTECTED_MORROWSEAL_MASTER</Mono>, generated inside the OutLayer keystore TEE</span>],
          ["Release rule", <span key="e">Enclave re-reads <Mono>get_vault</Mono> from NEAR RPC and refuses unless status is Released and the ciphertext hash matches</span>],
          ["Vaults / events", cfg ? `${cfg.vaults} / ${cfg.events}` : "…"],
        ]} />
        <Banner>Each claim and notice is a NEAR transaction that calls <Mono>outlayer.testnet.request_execution</Mono> and resumes with the TEE result. Open any <Mono>heir_claimed</Mono> event on Activity to follow it on NearBlocks.</Banner>
      </Card>
    </>
  );
}

export function Settings() {
  const { account, logout } = useApp();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const toast = useToast();
  const exportLocal = () => { const b = new Blob([JSON.stringify(localVaults(), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "morrowseal-device-notes.json"; a.click(); };
  const item = (t: string, d: React.ReactNode, right?: React.ReactNode) => <Row><div className="min-w-0 flex-1"><div className="text-sm font-medium">{t}</div><div className="break-words text-sm text-muted-foreground">{d}</div></div>{right}</Row>;
  return (
    <div className="max-w-2xl">
      <Top title="Settings" />
      <Card className="px-5 sm:px-6">
        {item("Appearance", "Light and dark both use the beUI palette.", <Button variant="outline" size="sm" onClick={() => setTheme(dark ? "light" : "dark")}>{dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? "Light" : "Dark"}</Button>)}
        {item("Timezone", `All times show in ${Intl.DateTimeFormat().resolvedOptions().timeZone} (${tzLabel()}).`)}
        {item("Network", `NEAR testnet · ${VAULT_CONTRACT}`, <AnimatedBadge status="warning" size="sm">Testnet</AnimatedBadge>)}
        {item("Device notes", "Titles and heir names you typed are kept only in this browser.", <Button variant="outline" size="sm" onClick={exportLocal}><DownloadSimple size={16} /> Export</Button>)}
        {item("Clear device notes", "Vaults stay on chain; this only forgets local titles.", <Button variant="outline" size="sm" onClick={() => { localStorage.removeItem("ms-vaults"); toast.show({ title: "Device notes cleared", tone: "success" }); }}><Trash size={16} /> Clear</Button>)}
        {account && item("Signed in", <Mono className="break-all">{account}</Mono>, <Button variant="outline" size="sm" onClick={logout}>Sign out</Button>)}
      </Card>
    </div>
  );
}
