import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { EnvelopeSimple, LockKeyOpen, DownloadSimple, FileText, CheckCircle, CircleNotch, ArrowSquareOut, Info } from "@phosphor-icons/react";
import { Folder, useToast } from "@unlocalhosted/metalui";
import { Logo, ThemeToggle, Reveal } from "../components/ui";
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
  useEffect(() => { currentUser().then((s) => s?.email && setHeirEmail(s.email)); }, []);

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

  return (
    <div className="claim-page">
      <div style={{ position: "fixed", top: 18, left: 22, right: 22, display: "flex", justifyContent: "space-between" }}><Logo /><ThemeToggle /></div>
      <div className={`card claim-card fade-up ${phase === "done" && gift ? "claim-wide" : ""}`}>
        {phase === "done" && gift ? (<>
          <div style={{ display: "grid", placeItems: "center" }}><Folder name={gift.owner_name ? `From ${gift.owner_name}` : "For you"} count={gift.files.length + 1} hue="green" open peeks={[{ thumb: "linear-gradient(135deg,#d6f5e4,#0ea158)" }, { thumb: "#e2ecf5" }, { thumb: "#fff" }]} /></div>
          <h1><Reveal text={`${gift.heir_name ? gift.heir_name + ", this" : "This"} is what ${gift.owner_name || "they"} left you`} step={50} /></h1>
          {gift.message && <div className="letter">{gift.message}</div>}
          <div className="gift-files">{gift.files.map((f, k) => (
            <div key={k} className="file-row"><FileText size={20} /><div style={{ flex: 1, minWidth: 0 }}><div className="fname" style={{ fontWeight: 600 }} title={f.name}>{f.name}</div><div className="muted" style={{ fontSize: 13 }}>{(f.size / 1024).toFixed(1)} KB · decrypted here</div></div><button className="btn btn-dark btn-sm" onClick={() => download(f)}><DownloadSimple size={16} /> Save</button></div>))}</div>
          {gift.files.some((f) => f.type.startsWith("text/")) && <div className="letter mono text-preview" style={{ fontSize: 13 }}>{new TextDecoder().decode(gift.files.find((f) => f.type.startsWith("text/"))!.bytes).slice(0, 20000)}</div>}
          <p style={{ fontSize: 13, marginTop: 18 }}>Nothing was decrypted on a server. {tx && <a className="link" href={`${EXPLORER}/txns/${tx}`} target="_blank" rel="noreferrer">Claim transaction <ArrowSquareOut size={12} /></a>}</p>
        </>) : (<>
          <div style={{ display: "grid", placeItems: "center" }}><Folder name="For you" count={3} hue="blue" open={busy} peeks={[{ thumb: "linear-gradient(135deg,#cfe8ff,#0953ff)" }, { thumb: "#e2ecf5" }, { thumb: "linear-gradient(160deg,#1a1615,#453f3d)" }]} /></div>
          <h1><Reveal text="Something was left for you" step={60} /></h1>
          <p>Someone close to you set up a private vault and named you. Sign in with the email this link was sent to, and it opens right here in your browser.</p>
          {!heirEmail ? (
            <div className="claim-actions">
              {authConfigured() ? <button className="btn btn-dark btn-lg" disabled={busy} onClick={signInOnly}>{phase === "auth" ? <CircleNotch size={18} className="spin" /> : <EnvelopeSimple size={18} weight="bold" />} Sign in to open</button> : <p>Sign-in is being set up. Try again shortly.</p>}
              <p style={{ fontSize: 13.5 }}>Use the email this link was sent to. Email code or Google both work.</p>
            </div>
          ) : missing ? (
            <div className="banner warn" style={{ marginTop: 22, textAlign: "left" }}><Info size={20} /> We couldn't find this vault. Check that you opened the full link from your email.</div>
          ) : !vault ? (
            <p style={{ marginTop: 18 }}><CircleNotch size={14} className="spin" /> Looking up the vault on NEAR…</p>
          ) : vault.status === "Active" ? (
            <div className="banner" style={{ marginTop: 22, textAlign: "left" }}><Info size={20} /> Not released yet. It's still sealed while its owner keeps checking in. You'll get an email if that changes.</div>
          ) : vault.status === "Cancelled" ? (
            <div className="banner" style={{ marginTop: 22, textAlign: "left" }}><Info size={20} /> This vault was closed by its owner.</div>
          ) : claimed && !localStorage.getItem(slot) ? (
            <div className="claim-actions">
              <div className="banner" style={{ textAlign: "left" }}><CheckCircle size={20} /> <div>Already opened{claimed.verified_email ? " by a verified email sign-in" : ""}. Signed in as <b title={heirEmail}>{heirEmail}</b>, you can open it again here.</div></div>
              <button className="btn btn-dark btn-lg" disabled={busy} onClick={() => reopen()}>{busy ? <CircleNotch size={18} className="spin" /> : <LockKeyOpen size={18} weight="bold" />} Open it again</button>
              {phase === "claim" && <p style={{ fontSize: 14 }}><CircleNotch size={14} className="spin" /> The enclave is checking your email…</p>}
              {phase === "open" && <p style={{ fontSize: 14 }}><CircleNotch size={14} className="spin" /> Decrypting in your browser…</p>}
            </div>
          ) : !token ? (
            <div className="banner warn" style={{ marginTop: 22, textAlign: "left" }}><Info size={20} /> This link is missing its private part. Open the button in your email again.</div>
          ) : (
            <div className="claim-actions">
              <div className="banner" style={{ textAlign: "left" }}><CheckCircle size={20} weight="fill" color="#0ea158" /> <div>Ready to open. Signed in as <b title={heirEmail}>{heirEmail}</b>.</div></div>
              <button className="btn btn-dark btn-lg" disabled={busy} onClick={() => claim()}>{busy ? <CircleNotch size={18} className="spin" /> : <LockKeyOpen size={18} weight="bold" />} Open what was left</button>
              {phase === "claim" && <p style={{ fontSize: 14 }}><CircleNotch size={14} className="spin" /> The enclave is checking your link and email…</p>}
              {phase === "open" && <p style={{ fontSize: 14 }}><CircleNotch size={14} className="spin" /> Decrypting in your browser…</p>}
            </div>
          )}
          {err === "WRONG_EMAIL" ? <div className="banner warn" style={{ marginTop: 16, textAlign: "left" }}><Info size={20} /> <div>You're signed in as <b>{heirEmail}</b>, but this was left for a different email. <button className="link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }} onClick={switchAccount}>Sign in with another account</button></div></div> :
          err && <div className="banner warn" style={{ marginTop: 16, textAlign: "left" }}><Info size={20} /> <div>{err}{tx && <> · <a className="link" href={`${EXPLORER}/txns/${tx}`} target="_blank" rel="noreferrer">transaction</a></>}</div></div>}
          <p style={{ fontSize: 12.5, marginTop: 24 }}>No wallet or crypto needed. Your sign-in proves the email; the secure enclave checks it before releasing anything.</p>
        </>)}
      </div>
    </div>
  );
}
