import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { view, type Vault } from "../lib/near";
import { currentUser, ensureAccount, onAuthChange, signIn, signOut } from "../lib/privy";
import { localVaults } from "../lib/local";
import { pullMeta, pushMeta, resetMetaKey } from "../lib/meta";
import type { ShelfVault } from "../components/VaultShelf";

type Ctx = { watch: boolean; account: string | null; ready: boolean; vaults: ShelfVault[]; refresh: () => Promise<void>; login: () => Promise<void>; logout: () => Promise<void>; loading: boolean; email: string | null };
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

export function AppState({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [vaults, setVaults] = useState<ShelfVault[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!account) { setVaults([]); return; }
    setLoading(true);
    try {
      const vs = await view<Vault[]>("vaults_of", { owner: account });
      const local = localVaults();
      setVaults(vs.sort((a, b) => b.id - a.id).map((v) => ({ ...v, title: local[v.id]?.title || `Vault ${v.id}`, files: local[v.id]?.files.length })));
    } catch { /* RPC busy; next poll retries */ } finally { setLoading(false); }
  }, [account]);

  const [watch, setWatch] = useState(false);
  useEffect(() => {
    const w = new URLSearchParams(location.search).get("watch") || sessionStorage.getItem("ms-watch");
    if (w && /^[a-z0-9._-]{2,64}$/.test(w)) { sessionStorage.setItem("ms-watch", w); setAccount(w); setWatch(true); setReady(true); return; }
    // Not "ready" until Privy is ready and, for a signed-in user, the NEAR account has hydrated,
    // so a refresh never flashes the sign-in prompt for someone already logged in.
    const sync = () => currentUser().then(async (u) => {
      setEmail(u?.email ?? null);
      if (u && !u.account) { const a = await ensureAccount().catch(() => null); setAccount(a ?? null); } else setAccount(u?.account ?? null);
      setReady(true);
      if (u?.account) ensureAccount().then((a) => { if (a) setAccount(a); }).catch(() => {});
    }).catch(() => setReady(true));
    sync(); return onAuthChange(() => { if (!sessionStorage.getItem("ms-watch")) sync(); });
  }, []);
  // Pull encrypted device notes once per signed-in account (and push anything only this device has).
  useEffect(() => { if (!account || watch || !/^[0-9a-f]{64}$/.test(account)) return; resetMetaKey(); pullMeta().then(() => { refresh(); pushMeta(); }); }, [account, watch]);
  useEffect(() => { const f = () => refresh(); window.addEventListener("ms-local", f); return () => window.removeEventListener("ms-local", f); }, [refresh]);
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [refresh]);

  const login = async () => { const u = await signIn(); setAccount(u.account); setEmail(u.email); };
  const logout = async () => { sessionStorage.removeItem("ms-watch"); setWatch(false); await signOut(); setAccount(null); setEmail(null); };
  return <C.Provider value={{ watch, account, ready, vaults, refresh, login, logout, loading, email }}>{children}</C.Provider>;
}
