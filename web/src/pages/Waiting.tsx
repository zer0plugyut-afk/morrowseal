import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { EnvelopeSimple, LockKey, Hourglass } from "@phosphor-icons/react";
import { Banner, CenterPage, Hero, Spinner } from "../components/ui";
import { Button } from "@/components/motion/button/base";
import { TextReveal } from "@/components/motion/text-reveal";
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
  const [checked, setChecked] = useState(false);
  useEffect(() => { currentUser().then((u) => u?.email && setEmail(u.email)).finally(() => setChecked(true)); }, []);
  const login = async () => { setErr(""); setBusy(true); try { const u = await signIn(); setEmail(u.email); } catch (e: any) { setErr(String(e?.message || e)); } finally { setBusy(false); } };
  const released = vault?.status === "Released";
  return (
    <CenterPage>
      <Hero tone={released ? "success" : "primary"} icon={<Hourglass size={30} weight="duotone" />} />
      <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl"><TextReveal text="Something is waiting for you" /></h1>
      <p className="max-w-md text-pretty text-muted-foreground">Someone close to you sealed a private vault and named you. It stays sealed while they keep checking in. If that ever stops, you'll get an email with a private link, and it opens here when you sign in with that same email.</p>
      <Banner tone={released ? "ok" : "info"} className="w-full text-left">
        {!vault ? "Checking the vault…" : vault.status === "Active" ? "Sealed. There's nothing you need to do now." : released ? "It has been released. Open the button in your email titled “… left something for you”." : "This vault was closed by its owner."}
      </Banner>
      <div className="grid w-full gap-3">
        {email ? <Banner tone="ok" className="text-left">You're signed in as <b className="break-all" title={email}>{email}</b>. If this is the address that got the email, you're all set.</Banner>
          : checked && authConfigured() && <Button size="lg" className="justify-self-center" disabled={busy} onClick={login}>{busy ? <Spinner size={18} /> : <EnvelopeSimple size={18} weight="bold" />} Sign in to check</Button>}
        {err && <Banner tone="warn" className="text-left">{err}</Banner>}
      </div>
      <p className="mt-2 max-w-sm text-xs text-muted-foreground">No wallet or crypto needed. Signing in only confirms your email; nothing is opened until the vault is released.</p>
    </CenterPage>
  );
}
