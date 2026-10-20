// Shared crypto and constants for the browser, the keeper and scripts. No secrets here.
import { encrypt as eciesEncrypt, decrypt as eciesDecrypt, PrivateKey } from "eciesjs";

export const NETWORK = "testnet";
export const VAULT_CONTRACT = "morrowseal-vault.testnet";
export const OUTLAYER_PROJECT = "morrowseal-ops.testnet/morrowseal";
export const ENCLAVE_PUBKEY = "02c2a3119b44700420af138a0918682a074a162e7a10200c4234b5da8383cd6977";
export const TEE_DEPOSIT = "20000000000000000000000"; // 0.02 NEAR (OutLayer fee, unused part refunded)
export const FASTAUTH = { clientId: "np8paqIpMWmNbzT4xAvOOapZBjsOpptl", domain: "login.testnet.fast-auth.com", contract: "fast-auth.testnet", mpc: "v1.signer-prod.testnet" };

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = globalThis.crypto.subtle;

export const toHex = (b) => Array.from(b instanceof Uint8Array ? b : new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
export const fromHex = (h) => { h = h.replace(/^0x/, ""); const o = new Uint8Array(h.length / 2); for (let i = 0; i < o.length; i++) o[i] = parseInt(h.substr(i * 2, 2), 16); return o; };
export const randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
export async function sha256Hex(bytes) { return toHex(await subtle.digest("SHA-256", bytes)); }

/** AES-256-GCM. Returns iv(12) || ciphertext+tag. */
export async function aesEncrypt(keyBytes, plain) {
  const key = await subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = randomBytes(12);
  const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, plain));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
}
export async function aesDecrypt(keyBytes, blob) {
  const key = await subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  return new Uint8Array(await subtle.decrypt({ name: "AES-GCM", iv: blob.slice(0, 12) }, key, blob.slice(12)));
}

/** Seal JSON to a secp256k1 public key (enclave, keeper or heir). */
export function seal(pubHex, obj) { return new Uint8Array(eciesEncrypt(pubHex, enc.encode(JSON.stringify(obj)))); }
export function unseal(skHex, bytes) { return JSON.parse(dec.decode(eciesDecrypt(skHex, bytes))); }
export function newKeypair() { const k = new PrivateKey(); return { sk: k.toHex(), pub: k.publicKey.toHex(true) }; }

/**
 * Build a vault: encrypt each file under one fresh file key, then seal the manifest
 * (file key, CIDs, heirs, message) to the enclave. `upload(bytes) -> cid` stores ciphertext on IPFS.
 */
export async function buildVault({ owner, ownerName, message, heirs, files, upload, enclavePub = ENCLAVE_PUBKEY }) {
  const fileKey = randomBytes(32);
  const manifest = [];
  for (const f of files) {
    const ct = await aesEncrypt(fileKey, f.bytes);
    const cid = await upload(ct, `${toHex(randomBytes(6))}.bin`);
    manifest.push({ cid, name: f.name, type: f.type || "application/octet-stream", size: f.bytes.length });
  }
  const sealed = seal(enclavePub, { v: 1, owner, owner_name: ownerName, message, file_key: toHex(fileKey), files: manifest, heirs: heirs.map((h) => ({ name: h.name, email: h.email.trim().toLowerCase() })) });
  const commitment = await sha256Hex(sealed);
  const cid = await upload(sealed, `${commitment.slice(0, 12)}.sealed`);
  return { sealed, commitment, cid, heirs: heirs.length };
}

/** Heir side: the claim sealed to the enclave, plus the one-time key that will open the answer. */
export function buildClaim({ token, claimant, idToken, enclavePub = ENCLAVE_PUBKEY }) {
  const k = newKeypair();
  const claim = seal(enclavePub, { token, eph_pub: k.pub, claimant, ...(idToken ? { id_token: idToken } : {}) });
  return { claimHex: toHex(claim), ephSk: k.sk };
}

export async function openGift(ephSk, keyCtHex, fetchCid) {
  const gift = unseal(ephSk, fromHex(keyCtHex));
  const key = fromHex(gift.file_key);
  const files = [];
  for (const f of gift.files || []) files.push({ ...f, bytes: await aesDecrypt(key, await fetchCid(f.cid)) });
  return { ...gift, files };
}

export const deadlineMs = (v) => Number(BigInt(v.last_checkin_ns) / 1_000_000n) + (v.interval_s + v.grace_s) * 1000;
