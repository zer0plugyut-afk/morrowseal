//! Minimal RS256 check of a NEAR Auth (Auth0) ID token: signature against the tenant JWKS,
//! issuer, audience (the shared testnet client), expiry and email_verified.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
use rsa::{pkcs1v15::{Signature, VerifyingKey}, signature::Verifier, BigUint, RsaPublicKey};
use sha2::Sha256;

pub const ISSUER: &str = "https://login.testnet.fast-auth.com/";
pub const CLIENT_ID: &str = "np8paqIpMWmNbzT4xAvOOapZBjsOpptl";

pub fn verified_email(token: &str) -> Result<String, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 { return Err("id token shape".into()); }
    let header: serde_json::Value = serde_json::from_slice(&B64.decode(parts[0]).map_err(|_| "jwt b64")?).map_err(|_| "jwt header")?;
    if header["alg"] != "RS256" { return Err("jwt alg".into()); }
    let kid = header["kid"].as_str().ok_or("jwt kid")?;
    let jwks: serde_json::Value = serde_json::from_slice(&crate::net::get(&format!("{ISSUER}.well-known/jwks.json"))?).map_err(|_| "jwks json")?;
    let jwk = jwks["keys"].as_array().ok_or("jwks")?.iter().find(|k| k["kid"] == kid).ok_or("jwt kid unknown")?;
    let n = BigUint::from_bytes_be(&B64.decode(jwk["n"].as_str().ok_or("n")?).map_err(|_| "n b64")?);
    let e = BigUint::from_bytes_be(&B64.decode(jwk["e"].as_str().ok_or("e")?).map_err(|_| "e b64")?);
    let key = VerifyingKey::<Sha256>::new(RsaPublicKey::new(n, e).map_err(|_| "rsa key")?);
    let sig = Signature::try_from(B64.decode(parts[2]).map_err(|_| "sig b64")?.as_slice()).map_err(|_| "sig")?;
    key.verify(format!("{}.{}", parts[0], parts[1]).as_bytes(), &sig).map_err(|_| "id token signature invalid")?;
    let c: serde_json::Value = serde_json::from_slice(&B64.decode(parts[1]).map_err(|_| "claims b64")?).map_err(|_| "claims")?;
    if c["iss"] != ISSUER { return Err("jwt issuer".into()); }
    let aud_ok = c["aud"] == CLIENT_ID || c["aud"].as_array().map(|a| a.iter().any(|x| x == CLIENT_ID)).unwrap_or(false);
    if !aud_ok { return Err("jwt audience".into()); }
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    // ID tokens live ~10h; allow a claim within 24h of login.
    if c["iat"].as_u64().unwrap_or(0) + 86_400 < now { return Err("sign-in too old, sign in again".into()); }
    if c["email_verified"] != true { return Err("email not verified with NEAR Auth".into()); }
    c["email"].as_str().map(|s| s.to_string()).ok_or("no email in id token".into())
}
