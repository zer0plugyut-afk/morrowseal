import { useEffect, useRef, useState, type ReactNode } from "react";
import { Moon, Sun, LockKey } from "@phosphor-icons/react";

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <a href={to} className="logo" aria-label="Morrowseal home">
      <span className="logo-mark"><LockKey size={17} weight="bold" /></span>
      morrowseal
    </a>
  );
}

export function useTheme() {
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme || "light");
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  // Persist only an explicit toggle; everyone else gets light (OS preference is ignored).
  return [theme, () => setTheme((t) => { const n = t === "dark" ? "light" : "dark"; try { localStorage.setItem("ms-theme-choice", n); } catch {} return n; })] as const;
}

export function ThemeToggle({ className = "icon-btn" }: { className?: string }) {
  const [theme, toggle] = useTheme();
  return (
    <button className={className} onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title="Theme">
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

/** Word-by-word blur reveal (Trezu headline motion). */
export function Reveal({ text, delay = 0, step = 70 }: { text: string; delay?: number; step?: number }) {
  const words = text.split(/(\s+)/);
  let i = 0;
  return (
    <>
      {words.map((w, k) => (/\s+/.test(w) ? w : <span key={k} className="rw" style={{ animationDelay: `${delay + step * i++}ms` }}>{w}</span>))}
    </>
  );
}

export function useInView<T extends HTMLElement>(threshold = 0.18) {
  const ref = useRef<T>(null);
  const [inView, set] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { set(true); io.disconnect(); } }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
}

export function Rise({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return <div ref={ref} className={`rise ${inView ? "in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

export function useNow(ms = 1000) {
  const [now, set] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => set(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
