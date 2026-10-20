import { NearConnector } from "@hot-labs/near-connect";
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

export async function view<T = any>(method: string, args: object = {}, contract = VAULT_CONTRACT): Promise<T> {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method, args_base64: btoa(JSON.stringify(args)) } }) });
  const j = await r.json();
  if (j.error || j.result?.error) throw new Error(j.error?.data || j.result?.error || "rpc error");
  return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result)));
}

export const nsToMs = (ns: number | string) => Number(BigInt(String(ns)) / 1_000_000n);
export const deadline = (v: Vault) => nsToMs(v.last_checkin_ns) + (v.interval_s + v.grace_s) * 1000;

let connector: NearConnector | null = null;
export function nearConnector() {
  if (!connector) connector = new NearConnector({ network: "testnet", features: { signAndSendTransaction: true, testnet: true }, footerBranding: null });
  return connector;
}

export async function connectedAccount(): Promise<string | null> {
  try { const { accounts } = await nearConnector().getConnectedWallet(); return accounts[0]?.accountId ?? null; } catch { return null; }
}

export async function signIn(): Promise<string | null> {
  const c = nearConnector();
  await c.connect();
  return connectedAccount();
}
export async function signOut() { try { await nearConnector().disconnect(); } catch {} }

export async function callVault(method: string, args: object, { tgas = 50, deposit = "0" } = {}) {
  const { wallet, accounts } = await nearConnector().getConnectedWallet();
  const out: any = await wallet.signAndSendTransaction({
    network: "testnet", signerId: accounts[0].accountId, receiverId: VAULT_CONTRACT,
    actions: [{ type: "FunctionCall", params: { methodName: method, args, gas: String(BigInt(tgas) * 10n ** 12n), deposit } } as any],
  });
  const hash: string = out?.transaction?.hash || out?.transaction_outcome?.id || "";
  let value: any = null;
  const sv = out?.status?.SuccessValue;
  if (sv) { try { value = JSON.parse(atob(sv)); } catch {} }
  if (out?.status?.Failure) throw new Error(JSON.stringify(out.status.Failure).slice(0, 200));
  return { hash, value };
}
