import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, ShieldCheck, Hash, EyeSlash, Heartbeat, EnvelopeSimple, Cpu, CheckCircle, LockKey, Fingerprint, FolderLock, FileText, Image as ImageIcon, Key } from "@phosphor-icons/react";
import { Logo, Rise, ThemeToggle, Card, btn } from "../components/ui";
import { AppPreview } from "../components/AppPreview";
import { Persona } from "../components/Persona";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { TextReveal } from "@/components/motion/text-reveal";
import { NumberTicker } from "@/components/motion/number-ticker";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { ProjectFolder } from "@/components/motion/project-folder";
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

const wrap = "mx-auto w-full max-w-6xl px-4 sm:px-6";
const eyebrow = "mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary";
const h2 = "text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl";

function Pv({ icon: I, label }: { icon: any; label: string }) {
  return <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground"><I size={26} weight="duotone" /><span className="text-xs">{label}</span></div>;
}
const previews = [
  { id: "letter", content: <Pv icon={EnvelopeSimple} label="Letter" /> },
  { id: "doc", content: <Pv icon={FileText} label="Documents" /> },
  { id: "photo", content: <Pv icon={ImageIcon} label="Photos" /> },
  { id: "key", content: <Pv icon={Key} label="Passwords" /> },
];

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className={`${wrap} flex h-16 items-center gap-6`}>
          <Logo />
          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
            {[["#how", "How it works"], ["#privacy", "Privacy"], ["#heirs", "For heirs"], ["#faq", "FAQ"]].map(([h, l]) => <a key={h} href={h} className="rounded-full px-3 py-1.5 transition-colors hover:bg-muted hover:text-foreground">{l}</a>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link to="/app" className={btn("ghost", "sm", "hidden sm:inline-flex")}>Sign in</Link>
            <Link to="/app/create" className={btn("primary", "sm")}>Create a vault</Link>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent)]" aria-hidden />
        <div className={`${wrap} relative flex flex-col items-center pb-10 pt-16 text-center sm:pt-24`}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <AnimatedBadge status="info" size="md" icon={<Cpu size={14} />}>Sealed in a secure enclave on NEAR</AnimatedBadge>
          </motion.div>
          <h1 className="mt-6 text-balance text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl lg:text-8xl" aria-label="Leave the keys. Keep the secret.">
            <TextReveal as="span" className="block" text="Leave the keys." delay={0.1} />
            <TextReveal as="span" className="block text-primary" text="Keep the secret." delay={0.45} />
          </h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.6 }} className="mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
            A private vault for the people you love. Your files are sealed in a secure enclave and released only if you stop checking in. No lawyers, no seed phrases.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.6 }} className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/app/create" className={btn("primary", "lg")}>Create a vault <ArrowRight size={18} weight="bold" /></Link>
            <a href="#heirs" className={btn("secondary", "lg")}>See how heirs claim</a>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1, duration: 0.6 }} className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><EyeSlash size={16} /> Encrypted in your browser</span><span className="inline-flex items-center gap-1.5"><Hash size={16} /> Only hashes on chain</span><span className="inline-flex items-center gap-1.5"><EnvelopeSimple size={16} /> Heirs sign in with email</span>
          </motion.div>
        </div>
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className={`${wrap} relative max-w-4xl pb-6`}>
          <div className="glass rounded-[2rem] p-2 sm:p-3"><AppPreview /></div>
        </motion.div>
      </section>

      <section className="py-20 sm:py-28" id="how">
        <div className={wrap}>
          <div className="grid gap-4 sm:grid-cols-3">
            {[[0, "", "", "names, emails or files stored on chain"], [1, "", "\u00a0tap", "to tell your vault you're still here"], [5, "", "\u00a0steps", "from empty to sealed, in about two minutes"]].map(([n, , suf, d]: any, i) => (
              <Rise key={d} delay={i * 80}><Card size="compact" className="h-full gap-2 px-6"><div className="text-5xl font-semibold tracking-tight text-primary tabular-nums"><NumberTicker value={n} startOnView suffix={suf} /></div><span className="text-sm text-muted-foreground">{d}</span></Card></Rise>
            ))}
          </div>
          <div className="mx-auto mt-24 max-w-2xl text-center">
            <div className={eyebrow}>How it works</div>
            <h2 className={h2}>Seal it once. Check in now and then. They'll know what to do.</h2>
            <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">Morrowseal is a quiet dead-man's switch. While you're around, nothing moves. If you go silent, the people you named get a calm email and one button.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { n: "01", t: "Seal", d: "Add letters, documents and passwords. They're encrypted in your browser and the key is sealed to the enclave.", art: <ProjectFolder title="For Ama" description="Sealed" previews={previews} className="w-full max-w-[15rem]" /> },
              { n: "02", t: "Check in", d: "Pick a rhythm, weekly to yearly. One tap from any device resets the clock. Miss it and a grace period begins.", art: <div className="relative grid size-24 place-items-center"><span className="absolute inset-0 animate-ping rounded-full bg-primary/20 [animation-duration:2.4s]" /><span className="relative grid size-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30"><Heartbeat size={36} weight="bold" /></span></div> },
              { n: "03", t: "Heirs claim", d: "Your heirs get a private link, sign in with their email, and the enclave hands the key to them alone.", art: <ProjectFolder title="Opened" description="Ready for Ama" previews={previews.slice(0, 3)} className="w-full max-w-[15rem]" /> },
            ].map((s, i) => (
              <Rise key={s.n} delay={i * 90} className="h-full"><Card className="h-full gap-3 px-6">
                <span className="font-mono text-xs text-muted-foreground">{s.n}</span><h3 className="text-xl font-semibold tracking-tight">{s.t}</h3><p className="text-pretty text-sm text-muted-foreground">{s.d}</p>
                <div className="mt-auto flex min-h-44 items-center justify-center pt-4">{s.art}</div>
              </Card></Rise>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card/50 py-20 sm:py-28" id="privacy">
        <div className={wrap}>
          <div className="mx-auto max-w-2xl text-center">
            <div className={eyebrow}>Privacy you can check</div>
            <h2 className={h2}>The chain keeps the promise. It never keeps the secret.</h2>
            <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">Everything a judge, a stranger or we could read is on the Proof page. Here is what that adds up to.</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [Hash, "Only hashes on NEAR", "The contract stores a SHA-256 commitment, an IPFS address of ciphertext, a heir count and your check-in times. That's all."],
              [Cpu, "The key never leaves the enclave", "Your vault key is sealed to an OutLayer worker running in Intel TDX. Its own key was generated inside the TEE; nobody has seen it."],
              [EyeSlash, "Heirs stay hidden", "Names and emails are inside the sealed vault. They only surface, encrypted to the mail keeper, after release."],
              [Fingerprint, "Email sign-in, no seed phrase", "Heirs sign in with a one-time email code. The enclave checks the signed-in email against the one you named."],
              [Heartbeat, "Re-checked on chain", "Every release request makes the enclave re-read the vault from NEAR, so a forged request can't open a live vault."],
              [FolderLock, "Files on IPFS, sealed", "AES-256-GCM in your browser before upload. IPFS only ever holds ciphertext."],
            ].map(([I, t, d]: any, i) => (
              <Rise key={t} delay={(i % 3) * 80} className="h-full"><Card className="h-full gap-3 px-6">
                <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary"><I size={22} weight="duotone" /></span>
                <h3 className="text-lg font-semibold tracking-tight">{t}</h3><p className="text-pretty text-sm text-muted-foreground">{d}</p>
                {i === 0 && <Link to="/app/proof" className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">Open the proof <ArrowRight size={14} /></Link>}
              </Card></Rise>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-28" id="heirs">
        <div className={`${wrap} grid items-center gap-12 lg:grid-cols-2`}>
          <Rise>
            <div className={eyebrow}>For the people you name</div>
            <h2 className={h2}>A calm email. One button. Their files, and your words.</h2>
            <p className="mt-4 text-pretty text-muted-foreground sm:text-lg">No crypto jargon, no wallet to install. Heirs sign in with the email you used for them, and their browser decrypts everything on the spot.</p>
            <ul className="mt-6 grid gap-3 text-sm">
              {["A private link that only works for them", "Owners and heirs sign in with email; the NEAR account is made for you", "Files decrypt in their browser, never on a server"].map((t) => <li key={t} className="flex items-start gap-2.5"><CheckCircle size={20} weight="fill" className="mt-px shrink-0 text-primary" />{t}</li>)}
            </ul>
          </Rise>
          <Rise delay={120}>
            <Card className="gap-4 p-6 shadow-xl shadow-black/5 sm:p-8">
              <div className="flex items-center gap-3"><Persona name="Vault Keeper" size={40} /><div><b className="text-sm">Vault Keeper</b><div className="text-sm text-muted-foreground">Kofi left something for you</div></div></div>
              <h4 className="text-xl font-semibold tracking-tight">Hi Ama,</h4>
              <p className="text-pretty text-sm text-muted-foreground">Kofi set up a private vault and named you as someone to receive it. It is ready for you now.</p>
              <div className="my-2"><span className={btn("primary", "md")}>Open what was left</span></div>
              <p className="text-sm text-muted-foreground">Take your time. The link is only for you, and nothing has been shared with anyone else.</p>
            </Card>
          </Rise>
        </div>
      </section>

      <section className="pb-20 sm:pb-28" id="faq">
        <div className={`${wrap} max-w-3xl`}>
          <div className="mb-10 text-center"><div className={eyebrow}>Questions</div><h2 className={h2}>Before you seal anything</h2></div>
          <BouncyAccordion items={FAQ.map(([q, a], i) => ({ id: String(i), title: q, description: a }))} defaultValue="0" />
        </div>
      </section>

      <section className="pb-20 sm:pb-28">
        <div className={wrap}>
          <Rise>
            <div className="relative overflow-hidden rounded-[2rem] bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12 sm:py-20">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(255_255_255/0.25),transparent)]" aria-hidden />
              <div className="relative">
                <LockKey size={34} weight="duotone" className="mx-auto" />
                <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-5xl">Two minutes now. Peace of mind for later.</h2>
                <p className="mx-auto mt-4 max-w-lg text-pretty text-primary-foreground/85 sm:text-lg">Create a vault on NEAR testnet, set a short check-in, and watch your heir receive it.</p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Link to="/app/create" className={btn("secondary", "lg", "border-transparent bg-white text-neutral-900 hover:bg-white/90")}>Create a vault</Link>
                  <Link to="/app/proof" className={btn("outline", "lg", "border-white/40 text-white hover:bg-white/10")}><ShieldCheck size={18} /> See the proof</Link>
                </div>
              </div>
            </div>
          </Rise>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-sm text-muted-foreground">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-4`}>
          <Logo />
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href={`${EXPLORER}/address/${VAULT_CONTRACT}`} target="_blank" rel="noreferrer" className="hover:text-foreground">Contract {VAULT_CONTRACT}</a>
            <span>Enclave {OUTLAYER_PROJECT}</span>
            <span>NEAR testnet</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
