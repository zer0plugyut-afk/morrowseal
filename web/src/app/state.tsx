import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { connectedAccount, signIn, signOut, view, type Vault } from "../lib/near";
import { localVaults } from "../lib/local";
import type { ShelfVault } from "../components/VaultShelf";

type Ctx = { watch: boolean; account: string | null; ready: boolean; vaults: ShelfVault[]; refresh: () => Promise<void>; login: () => Promise<void>; logout: () => Promise<void>; loading: boolean };
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

export function AppState({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [vaults, setVaults] = useState<ShelfVault[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!account) { setVaults([]); return; }
    setLoading(true);
    try {
      const vs = await view<Vault[]>("vaults_of", { owner: account });
      const local = localVaults();
      setVaults(vs.sort((a, b) => b.id - a.id).map((v) => ({ ...v, title: local[v.id]?.title || `Vault ${v.id}`, files: local[v.id]?.files.length })));
    } finally { setLoading(false); }
  }, [account]);

  const [watch, setWatch] = useState(false);
  useEffect(() => {
    const w = new URLSearchParams(location.search).get("watch") || sessionStorage.getItem("ms-watch");
    if (w && /^[a-z0-9._-]{2,64}$/.test(w)) { sessionStorage.setItem("ms-watch", w); setAccount(w); setWatch(true); setReady(true); return; }
    connectedAccount().then((a) => { setAccount(a); setReady(true); });
  }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); }, [refresh]);

  const login = async () => { const a = await signIn(); setAccount(a); };
  const logout = async () => { sessionStorage.removeItem("ms-watch"); setWatch(false); await signOut(); setAccount(null); };
  return <C.Provider value={{ watch, account, ready, vaults, refresh, login, logout, loading }}>{children}</C.Provider>;
}
