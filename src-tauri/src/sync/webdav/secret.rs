use keyring::{Entry, Error as KeyringError};

use crate::user_error::{credential, UserError};

pub(crate) const CREDENTIAL_SERVICE: &str = "com.tixxin.fuyu.sync";
pub(crate) const WEBDAV_ACCOUNT: &str = "webdav-password";

fn entry() -> Result<Entry, UserError> {
    Entry::new(&crate::dev_lane::service(CREDENTIAL_SERVICE), WEBDAV_ACCOUNT).map_err(credential::open)
}

pub(crate) fn read_password() -> Result<Option<String>, UserError> {
    #[cfg(test)]
    if let Some(override_val) = test_store::get() {
        return Ok(override_val.filter(|secret| !secret.is_empty()));
    }
    match entry()?.get_password() {
        Ok(secret) if !secret.is_empty() => Ok(Some(secret)),
        Ok(_) | Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(credential::read(error)),
    }
}

pub(crate) fn save_password(secret: &str) -> Result<(), UserError> {
    #[cfg(test)]
    if test_store::get().is_some() {
        test_store::set_override(Some(Some(secret.to_string())));
        return Ok(());
    }
    entry()?.set_password(secret).map_err(credential::save)
}

pub(crate) fn delete_password() -> Result<(), UserError> {
    #[cfg(test)]
    if test_store::get().is_some() {
        test_store::set_override(Some(None));
        return Ok(());
    }
    match entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(credential::delete(error)),
    }
}

pub(crate) fn has_password() -> bool {
    read_password().ok().flatten().is_some()
}

#[cfg(test)]
pub(crate) fn set_test_password_override(value: Option<Option<String>>) {
    test_store::set_override(value);
}

#[cfg(test)]
mod test_store {
    use std::sync::{Mutex, OnceLock, PoisonError};

    fn slot() -> &'static Mutex<Option<Option<String>>> {
        static STORE: OnceLock<Mutex<Option<Option<String>>>> = OnceLock::new();
        STORE.get_or_init(|| Mutex::new(None))
    }

    pub(super) fn get() -> Option<Option<String>> {
        slot().lock().unwrap_or_else(PoisonError::into_inner).clone()
    }

    pub(super) fn set_override(value: Option<Option<String>>) {
        *slot().lock().unwrap_or_else(PoisonError::into_inner) = value;
    }
}
