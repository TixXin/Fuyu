use super::provider::{Provider, MAX_BASE_URL_LENGTH};
use crate::user_error::UserError;

pub(super) fn no_address(provider: &Provider) -> UserError {
    let name = provider.name;
    UserError::new("translation.noAddress", format!("Fill in the address of {name} in the translation settings first.")).arg("service", name)
}

pub(super) fn stored_or(provider: &Provider, given: Option<&str>, stored: impl FnOnce() -> Result<Option<String>, UserError>) -> Result<Option<String>, UserError> {
    if !provider.needs_address() || given.is_some() {
        return Ok(given.map(str::to_owned));
    }
    stored()?.map(Some).ok_or_else(|| no_address(provider))
}

#[cfg(not(test))]
mod store {
    use crate::user_error::{credential, UserError};
    use keyring::{Entry, Error as KeyringError};

    const ACCOUNT: &str = "custom-address";

    fn entry() -> Result<Entry, UserError> {
        Entry::new(&crate::dev_lane::service("com.tixxin.fuyu.translation"), ACCOUNT).map_err(credential::open)
    }

    pub(super) fn read() -> Result<Option<String>, UserError> {
        match entry()?.get_password() {
            Ok(address) => Ok(Some(address)),
            Err(KeyringError::NoEntry) => Ok(None),
            Err(error) => Err(credential::read(error)),
        }
    }

    pub(super) fn write(address: Option<&str>) -> Result<(), UserError> {
        let entry = entry()?;
        match address {
            Some(address) => entry.set_password(address).map_err(credential::save),
            None => match entry.delete_credential() {
                Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
                Err(error) => Err(credential::delete(error)),
            },
        }
    }
}

#[cfg(test)]
mod store {
    use crate::user_error::UserError;
    use std::sync::{Mutex, PoisonError};

    static STORED: Mutex<Option<String>> = Mutex::new(None);

    pub(super) fn read() -> Result<Option<String>, UserError> {
        Ok(STORED.lock().unwrap_or_else(PoisonError::into_inner).clone())
    }

    pub(super) fn write(address: Option<&str>) -> Result<(), UserError> {
        *STORED.lock().unwrap_or_else(PoisonError::into_inner) = address.map(str::to_owned);
        Ok(())
    }
}

pub(super) fn read() -> Result<Option<String>, UserError> {
    store::read()
}

pub(super) fn save(address: &str) -> Result<(), UserError> {
    let address = address.trim();
    if address.len() > MAX_BASE_URL_LENGTH {
        return Err(UserError::new("translation.urlLong", "The service address is too long."));
    }
    let wanted = Some(address).filter(|address| !address.is_empty());
    if store::read()?.as_deref() == wanted {
        return Ok(());
    }
    store::write(wanted)
}

#[tauri::command]
pub fn save_translation_custom_address(address: String) -> Result<(), UserError> {
    save(&address)
}
