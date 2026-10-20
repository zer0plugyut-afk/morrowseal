import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { EnvelopeSimple, CheckCircle, CircleNotch, Info, LockKey } from "@phosphor-icons/react";
import { Folder } from "@unlocalhosted/metalui";
import { Logo, ThemeToggle, Reveal } from "../components/ui";
import { view, type Vault } from "../lib/near";
import { authConfigured, currentUser, signIn } from "../lib/privy";

// Where the "you've been named" email lands. Nothing here reveals contents; it confirms the
// heir's sign-in works and shows whether the vault is still sealed.
export default function Waiting() {
  const vid = Number(useParams().id);
  const [vault, setVault] = useState<Vault | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { const load = () => view<Vault>("get_vault", { vault_id: vid }).then(setVault).catch(() => {}); load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [vid]);
  useEffect(() => { currentUser().then((u) => u?.email && setEmail(u.email)); }, []);
  const login = async () => { setErr(""); setBusy(true); try { const u = await signIn(); setEmail(u.email); } catch (e: any) { setErr(String(e?.message || e)); } finally { setBusy(false); } };
  const released = vault?.status === "Released";
  return (
    <div className="claim-page">
      <div style={{ position: "fixed", top: 18, left: 22, right: 22, display: "flex", justifyContent: "space-between" }}><Logo /><ThemeToggle /></div>
      <div className="card claim-card fade-up">
        <div style={{ display: "grid", placeItems: "center" }}><Folder name="For you" count={3} hue={released ? "green" : "blue"} peeks={[{ thumb: "linear-gradient(135deg,#cfe8ff,#0953ff)" }, { thumb: "#e2ecf5" }, { thumb: "linear-gradient(160deg,#1a1615,#453f3d)" }]} /></div>
        <h1><Reveal text="Something is waiting for you" step={60} /></h1>
        <p>Someone close to you sealed a private vault and named you. It stays sealed while they keep checking in. If that ever stops, you'll get an email with a private link, and it opens here when you sign in with that same email.</p>
        <div className="banner" style={{ marginTop: 20, textAlign: "left" }}>
          {!vault ? <><CircleNotch size={18} className="spin" /> Checking the vault…</> : vault.status === "Active" ? <><LockKey size={20} /> Sealed. There's nothing you need to do now.</> : released ? <><CheckCircle size={20} /> It has been released. Open the button in your email titled “… left something for you”.</> : <><Info size={20} /> This vault was closed by its owner.</>}
        </div>
        <div className="claim-actions">
          {email ? <div className="banner" style={{ textAlign: "left" }}><CheckCircle size={20} weight="fill" color="#0ea158" /> <div>You're signed in as <b className="ellipsis" style={{ display: "inline" }} title={email}>{email}</b>. If this is the address that got the email, you're all set.</div></div>
            : authConfigured() && <button className="btn btn-dark btn-lg" disabled={busy} onClick={login}>{busy ? <CircleNotch size={18} className="spin" /> : <EnvelopeSimple size={18} weight="bold" />} Sign in to check</button>}
          {err && <div className="banner warn" style={{ textAlign: "left" }}><Info size={20} /> {err}</div>}
        </div>
        <p style={{ fontSize: 12.5, marginTop: 24 }}>No wallet or crypto needed. Signing in only confirms your email; nothing is opened until the vault is released.</p>
      </div>
    </div>
  );
}
