//! Morrowseal enclave (OutLayer WASI, runs inside Intel TDX).
//!
//! stdin JSON -> stdout JSON. Actions:
//!   pubkey : the enclave's ECIES public key (secp256k1). Browsers seal vaults to it.
//!   notify : after the vault is Released on NEAR, return heir names, emails and one-time claim
//!            tokens, sealed to the keeper's mail key (KEEPER_PUB). Nothing readable goes on chain.
//!   claim  : an heir proves their claim token (and, if they signed in with email via Privy, their email
//!            via the Auth0 ID token); the enclave re-seals the file key to the heir's browser key.
//!
//! Every action re-reads the vault from NEAR RPC, so a forged input cannot release a live vault.
//! The private key is HKDF(PROTECTED_MORROWSEAL_MASTER), generated inside the OutLayer keystore TEE.

mod jwt;
mod net;

use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::{self, Read, Write};

const KEY_INFO: &[u8] = b"morrowseal:ecies:v1";
const TOKEN_INFO: &[u8] = b"morrowseal:claim-token:v1";
pub const VAULT_CONTRACT: &str = "morrowseal-vault.testnet";
pub const RPC: &str = "https://rpc.testnet.near.org";
const KEEPER_PUB: &str = "03576fe93a03cc822fc1216e5ad78e1854a84e47c9c8a7d32d476e2baa3e426459";

#[derive(Deserialize)]
struct Input {
    action: String,
    vault_id: Option<u64>,
    ciphertext_hex: Option<String>,
    heir_index: Option<u32>,
    claim_hex: Option<String>,
}

#[derive(Deserialize)]
struct Sealed {
    v: u32,
    owner: String,
    #[serde(default)]
    owner_name: String,
    #[serde(default)]
    message: String,
    file_key: String,
    #[serde(default)]
    files: serde_json::Value,
    heirs: Vec<Heir>,
}

#[derive(Deserialize, Serialize, Clone)]
struct Heir {
    name: String,
    email: String,
}

#[derive(Deserialize)]
struct ClaimReq {
    token: String,
    /// heir's one-time browser public key (secp256k1 hex)
    eph_pub: String,
    /// account or label the heir claims to (recorded on chain)
    claimant: String,
    /// optional Auth0 ID token from NEAR Auth (FastAuth) login
    id_token: Option<String>,
}

#[derive(Serialize)]
struct Output { success: bool, result: serde_json::Value, error: Option<String> }

fn main() {
    let mut s = String::new();
    let out = match io::stdin().read_to_string(&mut s) {
        Err(e) => err(format!("stdin: {e}")),
        Ok(_) => match serde_json::from_str::<Input>(&s) {
            Err(e) => err(format!("bad input: {e}")),
            Ok(i) => match run(i) { Ok(v) => Output { success: true, result: v, error: None }, Err(e) => err(e) },
        },
    };
    let _ = io::stdout().write_all(serde_json::to_string(&out).unwrap().as_bytes());
    let _ = io::stdout().flush();
}

fn err(e: String) -> Output { Output { success: false, result: serde_json::Value::Null, error: Some(e) } }

fn master() -> Result<Vec<u8>, String> {
    let m = std::env::var("PROTECTED_MORROWSEAL_MASTER").map_err(|_| "missing PROTECTED_MORROWSEAL_MASTER".to_string())?;
    hex::decode(m.trim()).map_err(|e| format!("master hex: {e}"))
}

fn derive(info: &[u8]) -> Result<[u8; 32], String> {
    let hk = hkdf::Hkdf::<Sha256>::new(Some(b"morrowseal"), &master()?);
    let mut k = [0u8; 32];
    hk.expand(info, &mut k).map_err(|_| "hkdf".to_string())?;
    Ok(k)
}

fn secret_key() -> Result<[u8; 32], String> {
    let sk = derive(KEY_INFO)?;
    libsecp256k1::SecretKey::parse(&sk).map_err(|e| format!("sk: {e:?}"))?;
    Ok(sk)
}

fn token_for(commitment: &str, i: u32) -> Result<String, String> {
    let k = derive(TOKEN_INFO)?;
    let mut m = <Hmac<Sha256> as Mac>::new_from_slice(&k).unwrap();
    m.update(commitment.as_bytes());
    m.update(&i.to_be_bytes());
    Ok(hex::encode(&m.finalize().into_bytes()[..16]))
}

fn seal_to(pub_hex: &str, plain: &[u8]) -> Result<String, String> {
    let pk = hex::decode(pub_hex.trim_start_matches("0x")).map_err(|_| "pubkey hex".to_string())?;
    ecies::encrypt(&pk, plain).map(hex::encode).map_err(|e| format!("seal: {e:?}"))
}

/// Read the vault from NEAR (optimistic finality, the release receipt may be seconds old).
fn vault_on_chain(id: u64) -> Result<serde_json::Value, String> {
    use base64::Engine;
    let args = base64::engine::general_purpose::STANDARD.encode(format!("{{\"vault_id\":{id}}}"));
    let body = format!(r#"{{"jsonrpc":"2.0","id":1,"method":"query","params":{{"request_type":"call_function","finality":"optimistic","account_id":"{VAULT_CONTRACT}","method_name":"get_vault","args_base64":"{args}"}}}}"#);
    let v: serde_json::Value = serde_json::from_slice(&net::post(RPC, &body)?).map_err(|e| e.to_string())?;
    let bytes: Vec<u8> = v["result"]["result"].as_array().ok_or("rpc: no result")?.iter().map(|b| b.as_u64().unwrap_or(0) as u8).collect();
    serde_json::from_slice(&bytes).map_err(|e| format!("vault json: {e}"))
}

fn open_released(input: &Input) -> Result<(u64, String, Sealed), String> {
    let id = input.vault_id.ok_or("vault_id")?;
    let ct = hex::decode(input.ciphertext_hex.as_deref().ok_or("ciphertext_hex")?.trim_start_matches("0x")).map_err(|e| format!("ct hex: {e}"))?;
    let commitment = hex::encode(Sha256::digest(&ct));
    let v = vault_on_chain(id)?;
    if v["commitment"].as_str() != Some(commitment.as_str()) { return Err("ciphertext does not match the vault commitment".into()); }
    if v["status"].as_str() != Some("Released") { return Err("vault is not released".into()); }
    let plain = ecies::decrypt(&secret_key()?, &ct).map_err(|_| "decrypt failed".to_string())?;
    let s: Sealed = serde_json::from_slice(&plain).map_err(|e| format!("vault json: {e}"))?;
    if s.v != 1 || v["owner"].as_str() != Some(s.owner.as_str()) { return Err("vault is not bound to this owner".into()); }
    if s.heirs.is_empty() || s.heirs.len() > 8 { return Err("heir count".into()); }
    Ok((id, commitment, s))
}

fn run(input: Input) -> Result<serde_json::Value, String> {
    match input.action.as_str() {
        "pubkey" => {
            let sk = libsecp256k1::SecretKey::parse(&secret_key()?).unwrap();
            let pk = libsecp256k1::PublicKey::from_secret_key(&sk);
            Ok(serde_json::json!({ "pubkey": hex::encode(pk.serialize_compressed()), "scheme": "ecies-secp256k1-aes256gcm (eciesjs compatible)", "vault_contract": VAULT_CONTRACT }))
        }
        "notify" => {
            let (id, commitment, s) = open_released(&input)?;
            let mut heirs = vec![];
            for (i, h) in s.heirs.iter().enumerate() {
                heirs.push(serde_json::json!({ "i": i, "name": h.name, "email": h.email, "token": token_for(&commitment, i as u32)? }));
            }
            let notice = serde_json::json!({ "vault_id": id, "owner_name": s.owner_name, "heirs": heirs });
            Ok(serde_json::json!({ "commitment": commitment, "heirs": s.heirs.len(), "notice_ct": seal_to(KEEPER_PUB, notice.to_string().as_bytes())? }))
        }
        "claim" => {
            let (id, commitment, s) = open_released(&input)?;
            let i = input.heir_index.ok_or("heir_index")?;
            let heir = s.heirs.get(i as usize).ok_or("no such heir")?;
            let cbytes = hex::decode(input.claim_hex.as_deref().ok_or("claim_hex")?.trim_start_matches("0x")).map_err(|_| "claim hex".to_string())?;
            let cplain = ecies::decrypt(&secret_key()?, &cbytes).map_err(|_| "claim decrypt failed".to_string())?;
            let req: ClaimReq = serde_json::from_slice(&cplain).map_err(|e| format!("claim json: {e}"))?;
            let want = token_for(&commitment, i)?;
            if !ct_eq(req.token.as_bytes(), want.as_bytes()) { return Err("claim link is not valid for this heir".into()); }
            if req.claimant.is_empty() || req.claimant.len() > 128 { return Err("claimant".into()); }
            let mut verified_email = false;
            if let Some(t) = req.id_token.as_deref() {
                let email = jwt::verified_email(t)?;
                if email.trim().to_lowercase() != heir.email.trim().to_lowercase() { return Err("signed-in email is not the heir's email".into()); }
                verified_email = true;
            }
            let gift = serde_json::json!({ "vault_id": id, "owner_name": s.owner_name, "heir_name": heir.name, "message": s.message, "file_key": s.file_key, "files": s.files });
            Ok(serde_json::json!({
                "commitment": commitment, "heir_index": i, "claimant": req.claimant, "verified_email": verified_email,
                "key_ct": seal_to(&req.eph_pub, gift.to_string().as_bytes())?,
            }))
        }
        other => Err(format!("unknown action {other}")),
    }
}

fn ct_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}
