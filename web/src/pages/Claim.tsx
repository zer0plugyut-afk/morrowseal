import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { EnvelopeSimple, LockKeyOpen, DownloadSimple, FileText, ArrowSquareOut, LockKey } from "@phosphor-icons/react";
import { useToast } from "../components/toast";
import { Banner, CenterPage, Hero, Spinner } from "../components/ui";
import { Button } from "@/components/motion/button/base";
import { TextReveal } from "@/components/motion/text-reveal";
import { buildClaim, buildOwnerOpen, openGift } from "@shared/morrowseal.mjs";
import { fetchCid, relayClaim } from "../lib/api";
import { EXPLORER, view, type Vault } from "../lib/near";
import { authConfigured, currentUser, identityToken, signIn, signOut } from "../lib/privy";

type Gift = { owner_name: string; heir_name: string; message: string; files: { name: string; type: string; size: number; bytes: Uint8Array }[] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function Claim() {
  const { id, i } = useParams();
  const vid = Number(id), hi = Number(i);
  const toast = useToast();
  const slot = `ms-claim-${vid}-${hi}`;
  const token = useMemo(() => { const t = new URLSearchParams(location.hash.slice(1)).get("t"); if (t) sessionStorage.setItem(slot + "-t", t); return t || sessionStorage.getItem(slot + "-t") || ""; }, []);
  const [vault, setVault] = useState<Vault | null>(null);
  const [phase, setPhase] = useState<"idle" | "auth" | "claim" | "open" | "done">("idle");
  const [gift, setGift] = useState<Gift | null>(null);
  const [tx, setTx] = useState<string>("");
  const [err, setErr] = useState("");
  const [heirEmail, setHeirEmail] = useState("");

  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let live = true, t: any, tries = 0;
    const load = async () => {
      try { const v = await view<Vault | null>("get_vault", { vault_id: vid }); if (!live) return; if (v) { setVault(v); setMissing(false); } else setMissing(true); }
      catch { tries++; }
      if (live) t = setTimeout(load, tries > 0 && tries < 6 ? 3000 : 15000);
    };
    load(); return () => { live = false; clearTimeout(t); };
  }, [vid]);
  useEffect(() => { (async () => { const saved = localStorage.getItem(slot); const v = vault; if (saved && v?.claims[hi]) { setPhase("open"); await open(JSON.parse(saved).sk, v.claims[hi]!.key_ct); } })(); }, [vault?.id]);
  const [checked, setChecked] = useState(false);
  useEffect(() => { currentUser().then((s) => s?.email && setHeirEmail(s.email)).finally(() => setChecked(true)); }, []);

  async function open(sk: string, keyCt: string) {
    try { const g = await openGift(sk, keyCt, fetchCid); setGift(g); setPhase("done"); } catch (e: any) { setErr("Your browser could not open the files: " + (e?.message || e)); setPhase("idle"); }
  }

  async function signInOnly() {
    setErr(""); setPhase("auth");
    try { const u = await signIn(); setHeirEmail(u.email || ""); } catch (e: any) { setErr(String(e?.message || e)); } finally { setPhase("idle"); }
  }
  async function switchAccount() { await signOut(); setHeirEmail(""); setErr(""); await signInOnly(); }
  async function claim() {
    setErr("");
    try {
      setPhase("auth");
      const s = await signIn();
      if (s.email) setHeirEmail(s.email);
      const idToken = await identityToken();
      if (!idToken) throw new Error("Sign-in did not finish. Try again.");
      const claimant = s.account;
      setPhase("claim");
      const c = buildClaim({ token, claimant, idToken });
      localStorage.setItem(slot, JSON.stringify({ sk: c.ephSk }));
      const r = await relayClaim({ vault_id: vid, heir_index: hi, claim_hex: c.claimHex });
      setTx(r.tx);
      let v: Vault | null = null;
      for (let k = 0; k < 20; k++) { v = await view<Vault>("get_vault", { vault_id: vid }); if (v.claims[hi]) break; await sleep(1500); }
      if (!v?.claims[hi]) throw new Error("The claim is still settling. Refresh in a moment.");
      setVault(v); setPhase("open");
      await open(c.ephSk, v.claims[hi]!.key_ct);
      toast.show({ title: "Opened", sub: "decrypted in your browser", tone: "success" });
    } catch (e: any) {
      localStorage.removeItem(slot);
      setPhase("idle");
      const m = String(e?.message || e).replace(/^Error: /, "");
      setErr(/not the heir's email/i.test(m) ? "WRONG_EMAIL" : m);
      if (e?.tx) setTx(e.tx);
    }
  }

  // Reopen on any device: the enclave re-checks the signed-in email against the sealed heir email
  // and re-seals the key to a fresh one-time key in this browser. The first claim stays recorded.
  const reopening = useRef(false);
  async function reopen() {
    if (reopening.current) return;
    reopening.current = true;
    setErr("");
    try {
      setPhase("auth");
      const s = await signIn();
      if (s.email) setHeirEmail(s.email);
      const idToken = await identityToken();
      if (!idToken) throw new Error("Sign-in did not finish. Try again.");
      setPhase("claim");
      const req = buildOwnerOpen({ idToken });
      const r = await fetch("/api/reopen", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${idToken}` }, body: JSON.stringify({ vault_id: vid, heir_index: hi, request_hex: req.requestHex }) });
      const j = await r.json().catch(() => ({}));
      if (j.tx) setTx(j.tx);
      if (!r.ok || !j.ok || !j.key_ct) throw new Error(j.error || "The enclave refused to reopen it.");
      setPhase("open");
      await open(req.ephSk, j.key_ct);
    } catch (e: any) {
      setPhase("idle");
      const m = String(e?.message || e).replace(/^Error: /, "");
      setErr(/not the heir's email/i.test(m) ? "WRONG_EMAIL" : m);
    } finally { reopening.current = false; }
  }
  const autoFired = useRef(false);
  const wantReopen = useMemo(() => new URLSearchParams(location.hash.slice(1)).get("reopen") === "1", []);
  useEffect(() => { if (wantReopen && !autoFired.current && heirEmail && vault?.claims[hi] && !localStorage.getItem(slot) && phase === "idle" && !gift && !err) { autoFired.current = true; history.replaceState(null, "", location.pathname); reopen(); } }, [wantReopen, heirEmail, vault?.id]);

  const download = (f: Gift["files"][number]) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([f.bytes as any], { type: f.type })); a.download = f.name; a.click(); };
  const claimed = vault?.claims[hi];
  const busy = phase === "auth" || phase === "claim" || phase === "open";

  const lnk = "text-primary underline-offset-4 hover:underline";
  const note = (t: React.ReactNode) => <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">{t}</p>;
  const h1 = "text-balance text-3xl font-semibold tracking-tight sm:text-4xl";
  const sub = "max-w-md text-pretty text-muted-foreground";
  return (
    <CenterPage wide={phase === "done" && !!gift}>
      {phase === "done" && gift ? (<>
        <Hero tone="success" icon={<LockKeyOpen size={30} weight="duotone" />} />
        <h1 className={h1}><TextReveal text={`${gift.heir_name ? gift.heir_name + ", this" : "This"} is what ${gift.owner_name || "they"} left you`} /></h1>
        {gift.message && <div className="w-full whitespace-pre-wrap rounded-2xl bg-muted/60 p-5 text-left text-sm leading-relaxed">{gift.message}</div>}
        <div className="grid w-full gap-2">{gift.files.map((f, k) => (
          <div key={k} className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-left"><FileText size={20} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium" title={f.name}>{f.name}</div><div className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB · decrypted here</div></div><Button size="sm" onClick={() => download(f)}><DownloadSimple size={16} /> Save</Button></div>))}</div>
        {gift.files.some((f) => f.type.startsWith("text/")) && <pre className="w-full overflow-auto whitespace-pre-wrap rounded-2xl bg-muted/60 p-5 text-left font-mono text-xs">{new TextDecoder().decode(gift.files.find((f) => f.type.startsWith("text/"))!.bytes).slice(0, 20000)}</pre>}
        <p className="text-xs text-muted-foreground">Nothing was decrypted on a server. {tx && <a className={lnk} href={`${EXPLORER}/txns/${tx}`} target="_blank" rel="noreferrer">Claim transaction <ArrowSquareOut size={12} className="inline" /></a>}</p>
      </>) : (<>
        <Hero icon={busy ? <LockKeyOpen size={30} weight="duotone" /> : <LockKey size={30} weight="duotone" />} />
        <h1 className={h1}><TextReveal text="Something was left for you" /></h1>
        <p className={sub}>Someone close to you set up a private vault and named you. Sign in with the email this link was sent to, and it opens right here in your browser.</p>
        {!heirEmail ? (
          <div className="grid w-full justify-items-center gap-3">
            {!checked ? <Spinner size={22} /> : authConfigured() ? <Button size="lg" disabled={busy} onClick={signInOnly}>{phase === "auth" ? <Spinner size={18} /> : <EnvelopeSimple size={18} weight="bold" />} Sign in to open</Button> : <p className="text-sm text-muted-foreground">Sign-in is being set up. Try again shortly.</p>}
            <p className="text-sm text-muted-foreground">Use the email this link was sent to. Email code or Google both work.</p>
          </div>
        ) : missing ? (
          <Banner tone="warn" className="w-full text-left">We couldn't find this vault. Check that you opened the full link from your email.</Banner>
        ) : !vault ? (
          note(<><Spinner /> Looking up the vault on NEAR…</>)
        ) : vault.status === "Active" ? (
          <Banner className="w-full text-left">Not released yet. It's still sealed while its owner keeps checking in. You'll get an email if that changes.</Banner>
        ) : vault.status === "Cancelled" ? (
          <Banner className="w-full text-left">This vault was closed by its owner.</Banner>
        ) : claimed && !localStorage.getItem(slot) ? (
          <div className="grid w-full justify-items-center gap-3">
            <Banner tone="ok" className="w-full text-left">Already opened{claimed.verified_email ? " by a verified email sign-in" : ""}. Signed in as <b className="break-all" title={heirEmail}>{heirEmail}</b>, you can open it again here.</Banner>
            <Button size="lg" disabled={busy} onClick={() => reopen()}>{busy ? <Spinner size={18} /> : <LockKeyOpen size={18} weight="bold" />} Open it again</Button>
            {phase === "claim" && note(<><Spinner /> The enclave is checking your email…</>)}
            {phase === "open" && note(<><Spinner /> Decrypting in your browser…</>)}
          </div>
        ) : !token ? (
          <Banner tone="warn" className="w-full text-left">This link is missing its private part. Open the button in your email again.</Banner>
        ) : (
          <div className="grid w-full justify-items-center gap-3">
            <Banner tone="ok" className="w-full text-left">Ready to open. Signed in as <b className="break-all" title={heirEmail}>{heirEmail}</b>.</Banner>
            <Button size="lg" disabled={busy} onClick={() => claim()}>{busy ? <Spinner size={18} /> : <LockKeyOpen size={18} weight="bold" />} Open what was left</Button>
            {phase === "claim" && note(<><Spinner /> The enclave is checking your link and email…</>)}
            {phase === "open" && note(<><Spinner /> Decrypting in your browser…</>)}
          </div>
        )}
        {err === "WRONG_EMAIL" ? <Banner tone="warn" className="w-full text-left">You're signed in as <b className="break-all">{heirEmail}</b>, but this was left for a different email. <button className={lnk} onClick={switchAccount}>Sign in with another account</button></Banner> :
        err && <Banner tone="warn" className="w-full text-left">{err}{tx && <> · <a className={lnk} href={`${EXPLORER}/txns/${tx}`} target="_blank" rel="noreferrer">transaction</a></>}</Banner>}
        <p className="mt-2 max-w-sm text-xs text-muted-foreground">No wallet or crypto needed. Your sign-in proves the email; the secure enclave checks it before releasing anything.</p>
      </>)}
    </CenterPage>
  );
}
