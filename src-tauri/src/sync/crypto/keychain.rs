use arboard::Clipboard;
#[cfg(target_os = "macos")]
use arboard::SetExtApple;
#[cfg(windows)]
use arboard::SetExtWindows;
use keyring::{Entry, Error as KeyringError};
use std::{fs, path::PathBuf, time::Duration};

use super::DataKey;
use crate::{
    sync::webdav::secret::CREDENTIAL_SERVICE,
    user_error::{credential, UserError},
};

pub(crate) const ENCRYPTION_KEY_ACCOUNT: &str = "encryption-data-key";
const RECOVERY_FILE_PREFIX: &str = "fuyu-sync-recovery-key";

fn entry() -> Result<Entry, UserError> {
    Entry::new(&crate::dev_lane::service(CREDENTIAL_SERVICE), ENCRYPTION_KEY_ACCOUNT)
        .map_err(credential::open)
}

pub(crate) fn read_data_key() -> Result<Option<DataKey>, UserError> {
    #[cfg(test)]
    if let Some(override_val) = test_store::get() {
        return Ok(override_val);
    }
    match entry()?.get_password() {
        Ok(hex) if !hex.trim().is_empty() => Ok(DataKey::from_hex(&hex)),
        Ok(_) | Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(credential::read(error)),
    }
}

pub(crate) fn save_data_key(key: &DataKey) -> Result<(), UserError> {
    #[cfg(test)]
    if test_store::is_active() {
        test_store::set_override(Some(Some(key.clone())));
        return Ok(());
    }
    entry()?.set_password(&key.to_hex()).map_err(credential::save)
}

pub(crate) fn delete_data_key() -> Result<(), UserError> {
    #[cfg(test)]
    if test_store::is_active() {
        test_store::set_override(Some(None));
        return Ok(());
    }
    match entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(credential::delete(error)),
    }
}

pub(crate) fn has_data_key() -> bool {
    read_data_key().ok().flatten().is_some()
}

pub(crate) fn copy_recovery_key(key: &DataKey) -> Result<(), UserError> {
    let formatted = key.to_recovery_key();
    crate::clipboard_history::suspend_clipboard_capture(Duration::from_secs(3));
    let mut clipboard = Clipboard::new().map_err(|error| {
        UserError::new("sync.recoveryClipboard", "Could not copy the recovery key to the clipboard.")
            .detail(error.to_string())
    })?;
    let set = clipboard.set();
    #[cfg(windows)]
    let set = set.exclude_from_monitoring();
    #[cfg(target_os = "macos")]
    let set = set.exclude_from_history();
    set.text(formatted).map_err(|error| {
        UserError::new("sync.recoveryClipboard", "Could not copy the recovery key to the clipboard.")
            .detail(error.to_string())
    })
}

fn free_recovery_path(dir: &std::path::Path, stamp: &str) -> PathBuf {
    let base = format!("{RECOVERY_FILE_PREFIX}-{stamp}");
    (1..)
        .map(|n| {
            dir.join(if n == 1 {
                format!("{base}.txt")
            } else {
                format!("{base} ({n}).txt")
            })
        })
        .find(|path| !path.exists())
        .unwrap_or_else(|| dir.join(format!("{base}.txt")))
}

pub(crate) fn save_recovery_key_file(key: &DataKey) -> Result<String, UserError> {
    let dir = crate::system::downloads_dir()
        .ok_or_else(|| UserError::new("file.noDownloads", "The Downloads folder was not found."))?;
    let stamp = chrono::Local::now().format("%Y-%m-%d-%H%M").to_string();
    let path = free_recovery_path(&dir, &stamp);
    let content = format!(
        "Fuyu Cross-Device Sync Recovery Key\nKey ID: {}\nExported: {}\n\n{}\n\nKeep this recovery key in a safe place (for example your password manager).\nIf you forget your sync passphrase, you can unlock or recover encrypted sync data with this key.\n",
        key.key_id(),
        chrono::Local::now().format("%Y-%m-%d %H:%M"),
        key.to_recovery_key(),
    );
    fs::write(&path, content).map_err(|error| {
        UserError::new("file.write", format!("Could not write {}.", path.display()))
            .arg("path", path.display().to_string())
            .detail(error)
    })?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(path.to_string_lossy().into_owned())
}

#[cfg(test)]
pub(crate) fn set_test_key_override(value: Option<Option<DataKey>>) {
    test_store::set_override(value);
}

#[cfg(test)]
mod test_store {
    use super::DataKey;
    use std::sync::{Mutex, OnceLock, PoisonError};

    fn slot() -> &'static Mutex<Option<Option<DataKey>>> {
        static STORE: OnceLock<Mutex<Option<Option<DataKey>>>> = OnceLock::new();
        STORE.get_or_init(|| Mutex::new(None))
    }

    pub(super) fn is_active() -> bool {
        slot().lock().unwrap_or_else(PoisonError::into_inner).is_some()
    }

    pub(super) fn get() -> Option<Option<DataKey>> {
        slot().lock().unwrap_or_else(PoisonError::into_inner).clone()
    }

    pub(super) fn set_override(value: Option<Option<DataKey>>) {
        *slot().lock().unwrap_or_else(PoisonError::into_inner) = value;
    }
}
