// Heir index and keeper event log. Emails are never stored: each heir is keyed by an HMAC of the
// lowercased email under a keeper-held key, so the file alone does not reveal who was named.
// Sources: the owner's browser at seal time (/api/named, unverified hint) and, authoritatively,
// the TEE-sealed heir notice once a vault is released (decrypted with the keeper key).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { unseal, fromHex } from "../shared/morrowseal.mjs";

const DIR = process.env.DATA_DIR || "/tmp/morrowseal";
fs.mkdirSync(DIR, { recursive: true });
const FILE = path.join(DIR, "heir-index.json");
const PEPPER = crypto.createHash("sha256").update("morrowseal-heir-index:" + (process.env.INDEX_PEPPER || process.env.KEEPER_SK || "dev")).digest();
export const emailHash = (e) => crypto.createHmac("sha256", PEPPER).update(String(e).trim().toLowerCase()).digest("hex");

const S = (() => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return { heirs: {}, events: [], verified: {} }; } })();
// heirs: { [hash]: [{ vault_id, heir_index, name, owner_name, source }] }
let saveT = null;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { fs.writeFileSync(FILE + ".tmp", JSON.stringify(S)); fs.renameSync(FILE + ".tmp", FILE); } catch (e) { console.log("heir index save failed", e.message); } }, 200); };

function put(vault_id, heir_index, email, name, owner_name, source) {
  const h = emailHash(email);
  const list = (S.heirs[h] ||= []);
  const cur = list.find((x) => x.vault_id === vault_id && x.heir_index === heir_index);
  if (cur) { if (source === "notice") Object.assign(cur, { name, owner_name, source }); return; }
  list.push({ vault_id, heir_index, name: String(name || "").slice(0, 60), owner_name: String(owner_name || "").slice(0, 60), source });
}

/** Seal-time hint from the owner's browser. Index order = heir order in the sealed manifest. */
export function indexNamed(vault_id, heirs, owner_name) {
  heirs.forEach((h, i) => { if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(h.email || ""))) put(vault_id, i, h.email, h.name, owner_name, "named"); });
  save();
}

/** Authoritative: the TEE notice for a released vault. Replaces any hint entries for that vault. */
export function indexNotice(v) {
  if (!v.notice_ct || S.verified[v.id] || !process.env.KEEPER_SK) return;
  try {
    const n = unseal(process.env.KEEPER_SK, fromHex(v.notice_ct));
    for (const k of Object.keys(S.heirs)) S.heirs[k] = S.heirs[k].filter((x) => x.vault_id !== v.id);
    for (const h of n.heirs) put(v.id, h.i, h.email, h.name, n.owner_name, "notice");
    S.verified[v.id] = true; save();
  } catch (e) { console.log("index notice", v.id, e.message.slice(0, 120)); }
}

export function sharedWith(emails) {
  const out = [];
  for (const e of emails) for (const x of S.heirs[emailHash(e)] || []) if (!out.some((y) => y.vault_id === x.vault_id && y.heir_index === x.heir_index)) out.push(x);
  return out;
}

/** The claim link for a released vault, rebuilt from the sealed notice (never stored). */
export function claimLink(v, heir_index, appUrl) {
  if (!v.notice_ct || !process.env.KEEPER_SK) return null;
  try { const h = unseal(process.env.KEEPER_SK, fromHex(v.notice_ct)).heirs.find((x) => x.i === heir_index); return h ? `/claim/${v.id}/${h.i}#t=${h.token}` : null; } catch { return null; }
}

/** Keeper-side events that the contract does not log (e.g. "you were named" notices). */
export function record(kind, vault_id, detail = "") {
  S.events.push({ kind, vault_id, actor: "keeper", at_ns: String(BigInt(Date.now()) * 1_000_000n), detail });
  if (S.events.length > 5000) S.events.splice(0, S.events.length - 5000);
  save();
}
export const keeperEvents = () => S.events;
