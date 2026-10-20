// Keeper duties: release overdue vaults, ask the TEE to seal heir notices, mail heirs, relay claims.
import { view, call, lastValue, logsOf } from "./chain.mjs";
import { fetchCid } from "./ipfs.mjs";
import { heirEmail, sendMail } from "./email.mjs";
import { VAULT_CONTRACT, TEE_DEPOSIT, unseal, fromHex, deadlineMs, toHex } from "../shared/morrowseal.mjs";

const inflight = new Set();
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function once(key, fn) {
  if (inflight.has(key)) return null;
  inflight.add(key);
  try { return await fn(); } finally { inflight.delete(key); }
}

export async function allVaults() {
  const out = [];
  for (let from = 1; ; from += 100) { const page = await view(VAULT_CONTRACT, "list_vaults", { from, limit: 100 }); out.push(...page); if (page.length < 100) break; }
  return out;
}

export async function tick(ops, { appUrl }) {
  const vaults = await allVaults();
  const now = Date.now();
  for (const v of vaults) {
    try {
      if (v.status === "Active" && now >= deadlineMs(v) + 2000) {
        await once(`r${v.id}`, async () => { const o = await call(ops, VAULT_CONTRACT, "release", { vault_id: v.id }, { tgas: 30 }); log("released", v.id, o.transaction.hash); });
      } else if (v.status === "Released" && !v.notice_ct && !v.pending) {
        await once(`n${v.id}`, () => notify(ops, v));
      } else if (v.status === "Released" && v.notice_ct && !v.mailed) {
        await once(`m${v.id}`, () => mailHeirs(ops, v, appUrl));
      }
    } catch (e) { log("vault", v.id, "error", e.message.slice(0, 300)); }
  }
  return vaults.length;
}

export async function notify(ops, v) {
  const ct = await fetchCid(v.cid);
  const o = await call(ops, VAULT_CONTRACT, "notify", { vault_id: v.id, ciphertext_hex: toHex(ct) }, { deposit: TEE_DEPOSIT });
  log("notify", v.id, o.transaction.hash, JSON.stringify(lastValue(o)));
  return o.transaction.hash;
}

export async function mailHeirs(ops, v, appUrl) {
  const notice = unseal(process.env.KEEPER_SK, fromHex(v.notice_ct));
  const sent = [];
  for (const h of notice.heirs) {
    if (v.claims[h.i]) continue;
    const link = `${appUrl.replace(/\/$/, "")}/claim/${v.id}/${h.i}#t=${h.token}`;
    const m = heirEmail({ heirName: h.name, ownerName: notice.owner_name, link });
    let id;
    try { id = await sendMail({ to: h.email, toName: h.name, ...m }); }
    catch (e) { log("MAIL FAILED heir", h.i, "of vault", v.id, e.message.slice(0, 200)); throw e; }
    sent.push(id);
    log("mailed heir", h.i, "of vault", v.id, id);
  }
  const o = await call(ops, VAULT_CONTRACT, "set_mailed", { vault_id: v.id, mailed: true }, { tgas: 30 });
  log("set_mailed", v.id, o.transaction.hash);
  return { sent, tx: o.transaction.hash };
}

/** Relay an heir's claim (the heir needs no NEAR balance). Returns tx hash + contract result. */
export async function relayClaim(ops, { vault_id, heir_index, claim_hex }) {
  return once(`c${vault_id}:${heir_index}`, async () => {
    const v = await view(VAULT_CONTRACT, "get_vault", { vault_id });
    if (!v || v.status !== "Released") throw new Error("This vault has not been released.");
    if (v.claims[heir_index]) throw new Error("This share was already opened.");
    const ct = await fetchCid(v.cid);
    const o = await call(ops, VAULT_CONTRACT, "claim", { vault_id, heir_index, ciphertext_hex: toHex(ct), claim_hex }, { deposit: TEE_DEPOSIT });
    const r = lastValue(o);
    const refused = logsOf(o).find((l) => l.startsWith("claim refused"));
    log("claim", vault_id, heir_index, o.transaction.hash, JSON.stringify(r));
    return { tx: o.transaction.hash, ok: r?.ok === true, error: r?.error || refused || null };
  });
}

/** Relay an heir reopen (any device). The enclave checks the sealed Privy token; nothing is stored. */
export async function relayReopen(ops, { vault_id, heir_index, request_hex }) {
  const v = await view(VAULT_CONTRACT, "get_vault", { vault_id });
  if (!v || v.status !== "Released") throw new Error("This vault has not been released.");
  if (!v.claims[heir_index]) throw new Error("Open it from your email link first.");
  const ct = await fetchCid(v.cid);
  const o = await call(ops, VAULT_CONTRACT, "heir_open", { vault_id, heir_index, ciphertext_hex: toHex(ct), request_hex }, { deposit: TEE_DEPOSIT });
  const r = lastValue(o);
  log("heir_open", vault_id, heir_index, o.transaction.hash, r?.ok);
  return { tx: o.transaction.hash, ok: r?.ok === true, key_ct: r?.key_ct || null, error: r?.error || null };
}
