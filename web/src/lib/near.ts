import { VAULT_CONTRACT } from "@shared/morrowseal.mjs";

// All NEAR RPC goes through the keeper (same origin) because public RPCs do not send CORS headers.
export const RPC = "/api/rpc";
export const EXPLORER = "https://testnet.nearblocks.io";

export type Claim = { claimant: string; verified_email: boolean; key_ct: string; claimed_ns: number };
export type Vault = {
  id: number; owner: string; commitment: string; cid: string; heirs: number; interval_s: number; grace_s: number;
  created_ns: number | string; last_checkin_ns: number | string; checkins: number; status: "Active" | "Released" | "Cancelled";
  released_ns: number | string | null; notice_ct: string | null; claims: (Claim | null)[]; pending: boolean; mailed: boolean;
};
export type ChainEvent = { kind: string; vault_id: number; actor: string; at_ns: number | string; detail: string };

// Reads come from the keeper's read model (our API), which mirrors the contract views.
function route(method: string, args: any): string {
  switch (method) {
    case "get_config": return "/api/config";
    case "vaults_of": return `/api/vaults?owner=${encodeURIComponent(args.owner)}`;
    case "list_vaults": return "/api/vaults";
    case "get_vault": return `/api/vaults/${Number(args.vault_id)}`;
    case "list_events": return `/api/activity?${new URLSearchParams(Object.entries(args).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))}`;
    default: throw new Error("unsupported view " + method);
  }
}
export async function view<T = any>(method: string, args: any = {}): Promise<T> {
  let last: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(route(method, args), { cache: "no-store" });
      if (r.status === 404) return null as T;
      if (!r.ok) throw new Error(`api ${r.status}`);
      let out = await r.json();
      return out as T;
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 600 * (attempt + 1))); }
  }
  throw last;
}

export const nsToMs = (ns: number | string) => Number(BigInt(String(ns)) / 1_000_000n);
export const deadline = (v: Vault) => nsToMs(v.last_checkin_ns) + (v.interval_s + v.grace_s) * 1000;

export { callVault, signIn, signOut, currentUser } from "./privy";
