import { VAULT_CONTRACT } from "@shared/morrowseal.mjs";

export const RPC = "https://rpc.testnet.near.org";
export const EXPLORER = "https://testnet.nearblocks.io";

export type Claim = { claimant: string; verified_email: boolean; key_ct: string; claimed_ns: number };
export type Vault = {
  id: number; owner: string; commitment: string; cid: string; heirs: number; interval_s: number; grace_s: number;
  created_ns: number | string; last_checkin_ns: number | string; checkins: number; status: "Active" | "Released" | "Cancelled";
  released_ns: number | string | null; notice_ct: string | null; claims: (Claim | null)[]; pending: boolean; mailed: boolean;
};
export type ChainEvent = { kind: string; vault_id: number; actor: string; at_ns: number | string; detail: string };

const RPCS = [RPC, "https://test.rpc.fastnear.com", "https://rpc.testnet.pagoda.co"];
export async function view<T = any>(method: string, args: object = {}, contract = VAULT_CONTRACT): Promise<T> {
  let last: any;
  for (let attempt = 0; attempt < 2; attempt++) for (const url of RPCS) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method, args_base64: btoa(JSON.stringify(args)) } }) });
      if (!r.ok) throw new Error(`rpc ${r.status}`);
      const j = await r.json();
      if (j.error || j.result?.error) throw new Error(j.error?.data || j.result?.error || "rpc error");
      return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result)));
    } catch (e) { last = e; }
  }
  throw last;
}

export const nsToMs = (ns: number | string) => Number(BigInt(String(ns)) / 1_000_000n);
export const deadline = (v: Vault) => nsToMs(v.last_checkin_ns) + (v.interval_s + v.grace_s) * 1000;

export { callVault, signIn, signOut, currentUser } from "./privy";
