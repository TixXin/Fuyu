use keyring::{Entry, Error as KeyringError};

use crate::user_error::{credential, UserError};

const CREDENTIAL_SERVICE: &str = "com.tixxin.fuyu.apple-music";
const ACCOUNT: &str = "media-user-token";
const MAX_LEN: usize = 8_000;

fn entry() -> Result<Entry, UserError> {
    Entry::new(&crate::dev_lane::service(CREDENTIAL_SERVICE), ACCOUNT).map_err(credential::open)
}

fn normalize(token: &str) -> Option<String> {
    let token = token.trim();
    let token = token.strip_prefix("media-user-token=").unwrap_or(token).trim_matches(['"', '\'', ';', ' ']);
    let valid = !token.is_empty() && token.len() <= MAX_LEN && token.chars().all(|c| c.is_ascii_graphic());
    valid.then(|| token.to_string())
}

pub(super) fn read() -> Result<Option<String>, UserError> {
    match entry()?.get_password() {
        Ok(token) => Ok(normalize(&token)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(credential::read(error)),
    }
}

pub(super) fn save(token: &str) -> Result<(), UserError> {
    let token = normalize(token).ok_or_else(|| UserError::new("lyrics.appleToken", "That does not look like an Apple Music media-user-token."))?;
    entry()?.set_password(&token).map_err(credential::save)
}

pub(super) fn delete() -> Result<(), UserError> {
    match entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(credential::delete(error)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pasted_cookie_is_reduced_to_the_token() {
        assert_eq!(normalize("  Ag8abc+/=  ").as_deref(), Some("Ag8abc+/="));
        assert_eq!(normalize("media-user-token=Ag8abc;").as_deref(), Some("Ag8abc"));
        assert_eq!(normalize("\"Ag8abc\"").as_deref(), Some("Ag8abc"));
        assert_eq!(normalize("   "), None);
        assert_eq!(normalize("two words"), None);
        assert_eq!(normalize(&"a".repeat(MAX_LEN + 1)), None);
    }
}
