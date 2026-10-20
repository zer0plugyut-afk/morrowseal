//! Privy sign-in check. The heir's Privy access token is verified here (ES256 against the app's
//! JWKS, issuer privy.io, audience = the Morrowseal app id compiled in, not expired). The enclave
//! then asks Privy itself, over TLS from inside the TEE, which email is linked to that user.
//! Privy only links an email after a one-time code sent to it.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B64, Engine};
use p256::ecdsa::{signature::Verifier, Signature, VerifyingKey};

pub const ISSUER: &str = "privy.io";
pub const APP_ID: &str = env!("PRIVY_APP_ID");

pub fn verified_email(token: &str) -> Result<String, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 { return Err("id token shape".into()); }
    let header: serde_json::Value = serde_json::from_slice(&B64.decode(parts[0]).map_err(|_| "jwt b64")?).map_err(|_| "jwt header")?;
    if header["alg"] != "ES256" { return Err("jwt alg".into()); }
    let jwks: serde_json::Value = serde_json::from_slice(&crate::net::get(&format!("https://auth.privy.io/api/v1/apps/{APP_ID}/jwks.json"))?).map_err(|_| "jwks json")?;
    let keys = jwks["keys"].as_array().ok_or("jwks")?;
    let jwk = match header["kid"].as_str() { Some(k) => keys.iter().find(|j| j["kid"] == k), None => keys.first() }.ok_or("jwt kid unknown")?;
    let x = B64.decode(jwk["x"].as_str().ok_or("x")?).map_err(|_| "x b64")?;
    let y = B64.decode(jwk["y"].as_str().ok_or("y")?).map_err(|_| "y b64")?;
    let mut sec1 = vec![4u8]; sec1.extend_from_slice(&x); sec1.extend_from_slice(&y);
    let key = VerifyingKey::from_sec1_bytes(&sec1).map_err(|_| "ec key")?;
    let sig = Signature::from_slice(&B64.decode(parts[2]).map_err(|_| "sig b64")?).map_err(|_| "sig")?;
    key.verify(format!("{}.{}", parts[0], parts[1]).as_bytes(), &sig).map_err(|_| "id token signature invalid")?;
    let c: serde_json::Value = serde_json::from_slice(&B64.decode(parts[1]).map_err(|_| "claims b64")?).map_err(|_| "claims")?;
    if c["iss"] != ISSUER { return Err("jwt issuer".into()); }
    let aud_ok = c["aud"] == APP_ID || c["aud"].as_array().map(|a| a.iter().any(|x| x == APP_ID)).unwrap_or(false);
    if !aud_ok { return Err("jwt audience".into()); }
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    if c["exp"].as_u64().unwrap_or(0) < now { return Err("sign-in expired, sign in again".into()); }
    let sub = c["sub"].as_str().ok_or("no subject")?;
    let me: serde_json::Value = serde_json::from_slice(&crate::net::get_with("https://auth.privy.io/api/v1/users/me",
        &[("Authorization", &format!("Bearer {token}")), ("privy-app-id", APP_ID)])?).map_err(|_| "user json")?;
    let u = if me["user"].is_object() { &me["user"] } else { &me };
    if u["id"] != sub { return Err("sign-in user mismatch".into()); }
    u["linked_accounts"].as_array().and_then(|a| a.iter().find(|x| x["type"] == "email")).and_then(|x| x["address"].as_str())
        .map(|s| s.to_string()).ok_or("no email linked to this sign-in".into())
}
