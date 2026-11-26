use base64::{engine::general_purpose::STANDARD, Engine};
use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock, PoisonError};

use crate::user_error::{credential, UserError};

const ACCOUNT: &str = "lan-identity";
const SUBJECT: &str = "fuyu.local";

#[derive(Clone, PartialEq, Eq)]
pub(crate) struct Identity {
    pub(crate) cert_der: Vec<u8>,
    pub(crate) key_der: Vec<u8>,
    pub(crate) fingerprint: String,
}

#[derive(Serialize, Deserialize)]
struct Stored {
    cert: String,
    key: String,
}

fn cache() -> &'static Mutex<Option<Identity>> {
    static CACHE: OnceLock<Mutex<Option<Identity>>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

fn entry() -> Result<Entry, UserError> {
    Entry::new(&crate::dev_lane::service(super::super::webdav::secret::CREDENTIAL_SERVICE), ACCOUNT).map_err(credential::open)
}

pub(crate) fn fingerprint(cert_der: &[u8]) -> String {
    ring::digest::digest(&ring::digest::SHA256, cert_der).as_ref().iter().map(|byte| format!("{byte:02x}")).collect()
}

pub(crate) fn is_fingerprint(text: &str) -> bool {
    text.len() == 64 && text.bytes().all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

pub(crate) fn short(fingerprint: &str) -> String {
    let head: String = fingerprint.chars().take(8).collect::<String>().to_ascii_uppercase();
    match head.len() {
        8 => format!("{}-{}", &head[..4], &head[4..]),
        _ => head,
    }
}

pub(crate) fn generate() -> Result<Identity, String> {
    let key = rcgen::KeyPair::generate_for(&rcgen::PKCS_ED25519).map_err(|error| format!("Could not make a device key: {error}"))?;
    let params = rcgen::CertificateParams::new(vec![SUBJECT.to_string()]).map_err(|error| format!("Could not describe the device certificate: {error}"))?;
    let cert = params.self_signed(&key).map_err(|error| format!("Could not sign the device certificate: {error}"))?;
    let cert_der = cert.der().to_vec();
    Ok(Identity { fingerprint: fingerprint(&cert_der), cert_der, key_der: key.serialize_der() })
}

fn decode(text: &str) -> Option<Identity> {
    let stored: Stored = serde_json::from_str(text).ok()?;
    let cert_der = STANDARD.decode(stored.cert).ok()?;
    let key_der = STANDARD.decode(stored.key).ok()?;
    (!cert_der.is_empty() && !key_der.is_empty()).then(|| Identity { fingerprint: fingerprint(&cert_der), cert_der, key_der })
}

fn encode(identity: &Identity) -> Result<String, UserError> {
    serde_json::to_string(&Stored { cert: STANDARD.encode(&identity.cert_der), key: STANDARD.encode(&identity.key_der) })
        .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error.to_string()))
}

pub(crate) fn load_or_create() -> Result<Identity, UserError> {
    let mut cached = cache().lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(identity) = cached.as_ref() {
        return Ok(identity.clone());
    }
    let entry = entry()?;
    let identity = match entry.get_password() {
        Ok(text) => decode(&text),
        Err(KeyringError::NoEntry) => None,
        Err(error) => return Err(credential::read(error)),
    };
    let identity = match identity {
        Some(identity) => identity,
        None => {
            let fresh = generate().map_err(UserError::from)?;
            entry.set_password(&encode(&fresh)?).map_err(credential::save)?;
            fresh
        }
    };
    *cached = Some(identity.clone());
    Ok(identity)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_identities_are_distinct_and_round_trip() {
        let first = generate().unwrap();
        let second = generate().unwrap();
        assert_ne!(first.fingerprint, second.fingerprint);
        assert!(is_fingerprint(&first.fingerprint));
        assert_eq!(first.fingerprint, fingerprint(&first.cert_der));
        let back = decode(&encode(&first).unwrap()).unwrap();
        assert!(back == first);
        assert!(decode("{\"cert\":\"\",\"key\":\"\"}").is_none());
        assert!(decode("not json").is_none());
    }

    #[test]
    fn short_fingerprints_are_grouped_and_validated() {
        let fp = "0123456789abcdef".repeat(4);
        assert_eq!(short(&fp), "0123-4567");
        assert!(is_fingerprint(&fp));
        assert!(!is_fingerprint(&fp.to_ascii_uppercase()));
        assert!(!is_fingerprint("abc"));
    }
}
