import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Hash, EyeSlash, Heartbeat, EnvelopeSimple, Cpu, CheckCircle, Plus, LockKey, Fingerprint, FolderLock } from "@phosphor-icons/react";
import { Folder } from "@unlocalhosted/metalui";
import { Logo, Reveal, Rise, ThemeToggle } from "../components/ui";
import { AppPreview } from "../components/AppPreview";
import { VAULT_CONTRACT, OUTLAYER_PROJECT } from "@shared/morrowseal.mjs";
import { EXPLORER } from "../lib/near";

const FAQ = [
  ["What if I'm just busy and miss a check-in?", "You choose the rhythm (weekly to yearly) and a grace period on top. You can check in from any device with one tap, and nothing happens until both have passed."],
  ["Who can read my files?", "Nobody but your heirs, after release. Files are encrypted in your browser before they leave it. The key is sealed to a secure enclave (an Intel TDX worker run by OutLayer) that only hands it to a named heir once the vault is released on NEAR."],
  ["What does the blockchain see?", "A hash of the sealed vault, an IPFS address of ciphertext, how many heirs there are, and your check-in times. Never names, emails, file names or contents. Open the Proof page to see exactly what is stored."],
  ["How does an heir prove it's them?", "They get a private link by email and sign in with that same email using a one-time code. The enclave checks the link and the signed-in email before it releases anything. No seed phrase, no wallet needed."],
  ["Can I change my mind?", "Yes. While you're checking in you can replace files, change heirs or cancel the vault. Any update also counts as a check-in."],
  ["Is this live on mainnet?", "Not yet. Morrowseal runs on NEAR testnet today, so use it to try the flow, not for real documents."],
];

export default function Landing() {
  const [flat, setFlat] = useState(false);
  useEffect(() => { const f = () => setFlat(window.scrollY > 60); f(); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, []);
  return (
    <div className="landing">
      <header className="nav">
        <div className="wrap nav-in">
          <Logo />
          <nav className="nav-links"><a href="#how">How it works</a><a href="#privacy">Privacy</a><a href="#heirs">For heirs</a><a href="#faq">FAQ</a></nav>
          <div className="nav-cta">
            <ThemeToggle className="icon-btn" />
            <Link to="/app" className="nav-signin">Sign in</Link>
            <Link to="/app/create" className="btn btn-dark btn-sm" style={{ background: "#1a1615", color: "#fff" }}>Create a vault</Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap hero-copy">
          <div className="chip fade-up" style={{ background: "rgba(255,255,255,.14)", color: "#fff", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)" }}><Cpu size={14} /> Sealed in a secure enclave on NEAR</div>
          <h1 style={{ marginTop: 22 }}><Reveal text="Leave the keys." delay={80} /><br /><Reveal text="Keep the secret." delay={360} /></h1>
          <p className="hero-sub fade-up" style={{ animationDelay: "600ms" }}>A private vault for the people you love. Your files are sealed in a secure enclave and released only if you stop checking in. No lawyers, no seed phrases.</p>
          <div className="hero-ctas fade-up" style={{ animationDelay: "760ms" }}>
            <Link to="/app/create" className="btn btn-white btn-lg">Create a vault <ArrowRight size={18} weight="bold" /></Link>
            <a href="#heirs" className="btn btn-glass btn-lg">See how heirs claim</a>
          </div>
          <div className="hero-trust fade-up" style={{ animationDelay: "900ms" }}>
            <span><EyeSlash size={16} /> Encrypted in your browser</span><span><Hash size={16} /> Only hashes on chain</span><span><EnvelopeSimple size={16} /> Heirs sign in with email</span>
          </div>
        </div>
        <div className="hero-shot fade-up" style={{ animationDelay: "1000ms" }}>
          <div className={`hero-shot-in ${flat ? "flat" : ""}`}><AppPreview /></div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap">
          <div className="stats">
            <Rise><div className="stat"><b>0</b><span>names, emails or files stored on chain</span></div></Rise>
            <Rise delay={80}><div className="stat"><b>1 tap</b><span>to tell your vault you're still here</span></div></Rise>
            <Rise delay={160}><div className="stat"><b>5 steps</b><span>from empty to sealed, in about two minutes</span></div></Rise>
          </div>
          <div className="section-head" style={{ marginTop: 110 }}>
            <div className="eyebrow">How it works</div>
            <h2>Seal it once. Check in now and then. They'll know what to do.</h2>
            <p>Morrowseal is a quiet dead-man's switch. While you're around, nothing moves. If you go silent, the people you named get a calm email and one button.</p>
          </div>
          <div className="steps3">
            {[
              { n: "01", t: "Seal", d: "Add letters, documents and passwords. They're encrypted in your browser and the key is sealed to the enclave.", icon: <Folder name="For Ama" count={3} hue="blue" peeks={[{ thumb: "linear-gradient(135deg,#cfe8ff,#0953ff)" }, { thumb: "#e2ecf5" }, { thumb: "linear-gradient(160deg,#1a1615,#453f3d)" }]} /> },
              { n: "02", t: "Check in", d: "Pick a rhythm, weekly to yearly. One tap from any device resets the clock. Miss it and a grace period begins.", icon: <div className="pulse" style={{ width: 84, height: 84, borderRadius: 28, background: "var(--brand)", display: "grid", placeItems: "center", color: "#fff" }}><Heartbeat size={38} weight="bold" /></div> },
              { n: "03", t: "Heirs claim", d: "Your heirs get a private link, sign in with their email, and the enclave hands the key to them alone.", icon: <Folder name="Opened" count={3} hue="green" open peeks={[{ thumb: "linear-gradient(135deg,#d6f5e4,#0ea158)" }, { thumb: "#e2ecf5" }, { thumb: "#fff" }]} /> },
            ].map((s, i) => (
              <Rise key={s.n} delay={i * 90}><div className="card step3"><span className="num">{s.n}</span><h3>{s.t}</h3><p>{s.d}</p><div className="stage">{s.icon}</div></div></Rise>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="privacy" style={{ background: "var(--bg-subtle)" }}>
        <div className="wrap">
          <div className="section-head">
            <div className="eyebrow">Privacy you can check</div>
            <h2>The chain keeps the promise. It never keeps the secret.</h2>
            <p>Everything a judge, a stranger or we could read is on the Proof page. Here is what that adds up to.</p>
          </div>
          <div className="features">
            {[
              [Hash, "Only hashes on NEAR", "The contract stores a SHA-256 commitment, an IPFS address of ciphertext, a heir count and your check-in times. That's all."],
              [Cpu, "The key never leaves the enclave", "Your vault key is sealed to an OutLayer worker running in Intel TDX. Its own key was generated inside the TEE; nobody has seen it."],
              [EyeSlash, "Heirs stay hidden", "Names and emails are inside the sealed vault. They only surface, encrypted to the mail keeper, after release."],
              [Fingerprint, "Email sign-in, no seed phrase", "Heirs sign in with a one-time email code. The enclave checks the signed-in email against the one you named."],
              [Heartbeat, "Re-checked on chain", "Every release request makes the enclave re-read the vault from NEAR, so a forged request can't open a live vault."],
              [FolderLock, "Files on IPFS, sealed", "AES-256-GCM in your browser before upload. IPFS only ever holds ciphertext."],
            ].map(([I, t, d]: any, i) => (
              <Rise key={t} delay={(i % 3) * 80}><div className="card feature"><span className="icon-chip"><I size={22} weight="duotone" /></span><h3>{t}</h3><p>{d}</p>{i === 0 && <Link to="/app/proof">Open the proof <ArrowRight size={14} /></Link>}</div></Rise>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="heirs">
        <div className="wrap split">
          <Rise>
            <div className="eyebrow">For the people you name</div>
            <h2>A calm email. One button. Their files, and your words.</h2>
            <p className="lead">No crypto jargon, no wallet to install. Heirs sign in with the email you used for them, and their browser decrypts everything on the spot.</p>
            <ul className="ticks">
              <li><CheckCircle size={20} weight="fill" /> A private link that only works for them</li>
              <li><CheckCircle size={20} weight="fill" /> Owners and heirs sign in with email; the NEAR account is made for you</li>
              <li><CheckCircle size={20} weight="fill" /> Files decrypt in their browser, never on a server</li>
            </ul>
          </Rise>
          <Rise delay={120}>
            <div className="card mail-mock">
              <div className="from"><span className="av" /><div><b>Vault Keeper</b><div className="muted">Kofi left something for you</div></div></div>
              <h4>Hi Ama,</h4>
              <p>Kofi set up a private vault and named you as someone to receive it. It is ready for you now.</p>
              <div style={{ margin: "24px 0" }}><span className="btn btn-dark">Open what was left</span></div>
              <p className="muted" style={{ fontSize: 14 }}>Take your time. The link is only for you, and nothing has been shared with anyone else.</p>
            </div>
          </Rise>
        </div>
      </section>

      <section className="section" id="faq" style={{ paddingTop: 20 }}>
        <div className="wrap">
          <div className="section-head"><div className="eyebrow">Questions</div><h2>Before you seal anything</h2></div>
          <div className="faq">
            {FAQ.map(([q, a]) => (<details key={q}><summary>{q}<Plus size={18} /></summary><p>{a}</p></details>))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 30 }}>
        <div className="wrap">
          <Rise><div className="cta-band">
            <LockKey size={34} weight="duotone" />
            <h2 style={{ marginTop: 14 }}>Two minutes now. Peace of mind for later.</h2>
            <p>Create a vault on NEAR testnet, set a short check-in, and watch your heir receive it.</p>
            <div className="hero-ctas" style={{ marginTop: 0 }}><Link to="/app/create" className="btn btn-white btn-lg">Create a vault</Link><Link to="/app/proof" className="btn btn-glass btn-lg"><ShieldCheck size={18} /> See the proof</Link></div>
          </div></Rise>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap footer-in">
          <Logo />
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            <a href={`${EXPLORER}/address/${VAULT_CONTRACT}`} target="_blank" rel="noreferrer">Contract {VAULT_CONTRACT}</a>
            <span>Enclave {OUTLAYER_PROJECT}</span>
            <span>NEAR testnet</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
