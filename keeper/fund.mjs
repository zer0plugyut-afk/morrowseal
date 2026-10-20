// One-time testnet top-up for a new Privy-held NEAR implicit account. The caller must present a
// valid Privy access token for this app; each Privy user and each account is funded at most once.
import { createRemoteJWKSet, jwtVerify } from "jose";
import { RPC } from "./chain.mjs";

const APP_ID = process.env.PRIVY_APP_ID || "";
const AMOUNT = BigInt(process.env.FUND_YOCTO || "250000000000000000000000"); // 0.25 NEAR
const jwks = APP_ID ? createRemoteJWKSet(new URL(`https://auth.privy.io/api/v1/apps/${APP_ID}/jwks.json`)) : null;
const fundedUsers = new Set();
let today = { day: "", n: 0 };

async function exists(id) {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_account", finality: "final", account_id: id } }) });
  const j = await r.json();
  return !j.error && !j.result?.error;
}

export async function fund(ops, bearer, account) {
  if (!jwks) return { code: 503, error: "sign-in not configured" };
  if (!/^[0-9a-f]{64}$/.test(account || "")) return { code: 400, error: "bad account" };
  let sub;
  try { ({ payload: { sub } } = await jwtVerify(bearer || "", jwks, { issuer: "privy.io", audience: APP_ID })); }
  catch { return { code: 401, error: "Please sign in again." }; }
  if (await exists(account)) return { code: 200, funded: false };
  if (fundedUsers.has(sub)) return { code: 409, error: "This sign-in already has an account." };
  const d = new Date().toISOString().slice(0, 10);
  if (today.day !== d) today = { day: d, n: 0 };
  if (++today.n > Number(process.env.FUND_DAILY_CAP || 200)) return { code: 429, error: "Daily limit reached, try tomorrow." };
  fundedUsers.add(sub);
  const r = await ops.sendMoney(account, AMOUNT);
  return { code: 200, funded: true, tx: r.transaction.hash };
}
