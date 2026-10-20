import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { EnvelopeSimple, Wallet, DownloadSimple, FileText, CheckCircle, CircleNotch, ArrowSquareOut, LockKeyOpen, Info } from "@phosphor-icons/react";
import { Folder, useToast } from "@unlocalhosted/metalui";
import { Logo, ThemeToggle, Reveal } from "../components/ui";
import { buildClaim, openGift } from "@shared/morrowseal.mjs";
import { fetchCid, relayClaim } from "../lib/api";
import { EXPLORER, view, signIn, type Vault } from "../lib/near";
import { currentHeir, fastAuthAvailable, loginHeir } from "../lib/fastauth";

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

  useEffect(() => { view<Vault>("get_vault", { vault_id: vid }).then(setVault).catch(() => setErr("This vault could not be found.")); }, [vid]);
  useEffect(() => { (async () => { const saved = localStorage.getItem(slot); const v = vault; if (saved && v?.claims[hi]) { setPhase("open"); await open(JSON.parse(saved).sk, v.claims[hi]!.key_ct); } })(); }, [vault?.id]);
  useEffect(() => { currentHeir().then((s) => s && setHeirEmail(s.email)); }, []);

  async function open(sk: string, keyCt: string) {
    try { const g = await openGift(sk, keyCt, fetchCid); setGift(g); setPhase("done"); } catch (e: any) { setErr("Your browser could not open the files: " + (e?.message || e)); setPhase("idle"); }
  }

  async function claim(mode: "email" | "wallet" | "link") {
    setErr("");
    try {
      let claimant = "link-holder", idToken: string | undefined;
      if (mode === "email") {
        setPhase("auth");
        const s = (await currentHeir()) || (await loginHeir());
        if (!s) throw new Error("Sign-in was cancelled.");
        setHeirEmail(s.email); claimant = s.label; idToken = s.idToken;
      } else if (mode === "wallet") {
        setPhase("auth");
        const a = await signIn();
        if (!a) throw new Error("No wallet connected.");
        claimant = a;
      }
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
      setErr(String(e?.message || e).replace(/^Error: /, ""));
      if (e?.tx) setTx(e.tx);
    }
  }

  const download = (f: Gift["files"][number]) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([f.bytes as any], { type: f.type })); a.download = f.name; a.click(); };
  const claimed = vault?.claims[hi];
  const busy = phase === "auth" || phase === "claim" || phase === "open";

  return (
    <div className="claim-page">
      <div style={{ position: "fixed", top: 18, left: 22, right: 22, display: "flex", justifyContent: "space-between" }}><Logo /><ThemeToggle /></div>
      <div className="card claim-card fade-up">
        {phase === "done" && gift ? (<>
          <div style={{ display: "grid", placeItems: "center" }}><Folder name={gift.owner_name ? `From ${gift.owner_name}` : "For you"} count={gift.files.length + 1} hue="green" open peeks={[{ thumb: "linear-gradient(135deg,#d6f5e4,#0ea158)" }, { thumb: "#e2ecf5" }, { thumb: "#fff" }]} /></div>
          <h1><Reveal text={`${gift.heir_name ? gift.heir_name + ", this" : "This"} is what ${gift.owner_name || "they"} left you`} step={50} /></h1>
          {gift.message && <div className="letter">{gift.message}</div>}
          <div className="gift-files">{gift.files.map((f, k) => (
            <div key={k} className="file-row"><FileText size={20} /><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div><div className="muted" style={{ fontSize: 13 }}>{(f.size / 1024).toFixed(1)} KB · decrypted here</div></div><button className="btn btn-dark btn-sm" onClick={() => download(f)}><DownloadSimple size={16} /> Save</button></div>))}</div>
          {gift.files.some((f) => f.type.startsWith("text/")) && <div className="letter mono" style={{ fontSize: 13 }}>{new TextDecoder().decode(gift.files.find((f) => f.type.startsWith("text/"))!.bytes).slice(0, 1200)}</div>}
          <p style={{ fontSize: 13, marginTop: 18 }}>Nothing was decrypted on a server. {tx && <a className="link" href={`${EXPLORER}/txns/${tx}`} target="_blank" rel="noreferrer">Claim transaction <ArrowSquareOut size={12} /></a>}</p>
        </>) : (<>
          <div style={{ display: "grid", placeItems: "center" }}><Folder name="For you" count={3} hue="blue" open={busy} peeks={[{ thumb: "linear-gradient(135deg,#cfe8ff,#0953ff)" }, { thumb: "#e2ecf5" }, { thumb: "linear-gradient(160deg,#1a1615,#453f3d)" }]} /></div>
          <h1><Reveal text="Something was left for you" step={60} /></h1>
          <p>Someone close to you set up a private vault and named you. Sign in with the email this link was sent to, and it opens right here in your browser.</p>
          {!vault ? <p style={{ marginTop: 18 }}>{err || "Loading…"}</p> : vault.status !== "Released" ? (
            <div className="banner" style={{ marginTop: 22, textAlign: "left" }}><Info size={20} /> This vault is still sealed. Its owner is checking in.</div>
          ) : claimed && !localStorage.getItem(slot) ? (
            <div className="banner" style={{ marginTop: 22, textAlign: "left" }}><CheckCircle size={20} /> This share was already opened{claimed.verified_email ? " by a verified email sign-in" : ""}. If that was you, open it on the same browser.</div>
          ) : !token ? (
            <div className="banner warn" style={{ marginTop: 22, textAlign: "left" }}><Info size={20} /> This link is missing its private part. Open the button in your email again.</div>
          ) : (
            <div className="claim-actions">
              {fastAuthAvailable() && <button className="btn btn-dark btn-lg" disabled={busy} onClick={() => claim("email")}>{phase === "auth" ? <CircleNotch size={18} className="spin" /> : <EnvelopeSimple size={18} weight="bold" />} {heirEmail ? `Continue as ${heirEmail}` : "Continue with email"}</button>}
              <div className="or">{fastAuthAvailable() ? "or" : "sign in"}</div>
              <button className={`btn ${fastAuthAvailable() ? "btn-ghost" : "btn-dark btn-lg"}`} disabled={busy} onClick={() => claim("wallet")}><Wallet size={18} /> Use a NEAR wallet</button>
              {!fastAuthAvailable() && <button className="btn btn-ghost" disabled={busy} onClick={() => claim("link")}><LockKeyOpen size={18} /> Open with this link only</button>}
              {phase === "claim" && <p style={{ fontSize: 14 }}><CircleNotch size={14} className="spin" /> The enclave is checking your link…</p>}
              {phase === "open" && <p style={{ fontSize: 14 }}><CircleNotch size={14} className="spin" /> Decrypting in your browser…</p>}
            </div>
          )}
          {err && <div className="banner warn" style={{ marginTop: 16, textAlign: "left" }}><Info size={20} /> <div>{err}{tx && <> · <a className="link" href={`${EXPLORER}/txns/${tx}`} target="_blank" rel="noreferrer">transaction</a></>}</div></div>}
          <p style={{ fontSize: 12.5, marginTop: 24 }}>No wallet or crypto needed. Your sign-in proves the email; the secure enclave checks it before releasing anything.</p>
        </>)}
      </div>
    </div>
  );
}
