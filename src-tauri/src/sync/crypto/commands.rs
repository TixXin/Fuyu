use super::{
    keychain,
    migrate::{
        migrate_remote_to_encrypted_with, migrate_remote_to_plain, read_remote_meta,
        reset_remote_store_with, rewrap_remote_passphrase_with, KdfStrength,
    },
    unwrap_with_secret, DataKey,
};
use crate::{
    sync::{
        clock,
        config::{self, SyncBackendKind},
        engine,
        status::{EncryptionState, SyncStatus},
    },
    user_error::UserError,
};

fn active_backend(home: &std::path::Path) -> Result<Box<dyn crate::sync::backend::Backend>, UserError> {
    let cfg = config::load(home);
    if cfg.active_backend() == SyncBackendKind::Off {
        return Err(UserError::new(
            "sync.needBackendFirst",
            "Choose a sync folder or connect WebDAV before configuring encryption.",
        ));
    }
    engine::open_backend(&cfg)
}

fn verified_key_for_remote(
    backend: &dyn crate::sync::backend::Backend,
    secret: Option<&str>,
) -> Result<DataKey, UserError> {
    let meta = read_remote_meta(backend)?.ok_or_else(|| {
        UserError::new("sync.notEncrypted", "End-to-end encryption is not enabled yet.")
    })?;
    let enc = meta.encryption.as_ref().ok_or_else(|| {
        UserError::new("sync.notEncrypted", "End-to-end encryption is not enabled yet.")
    })?;
    if let Some(raw) = secret.map(str::trim).filter(|text| !text.is_empty()) {
        return unwrap_with_secret(enc, raw);
    }
    if let Some(saved) = keychain::read_data_key()? {
        if saved.key_check() == enc.key_check {
            return Ok(saved);
        }
    }
    Err(UserError::new(
        "sync.badPassphrase",
        "Enter the current sync passphrase or recovery key.",
    ))
}

pub(crate) fn enable(passphrase: String) -> Result<SyncStatus, UserError> {
    let eng = engine::instance()?;
    let run_guard = eng.lock_run();
    let backend = active_backend(eng.home_dir())?;
    let (enc_meta, key) = migrate_remote_to_encrypted_with(
        backend.as_ref(),
        clock::wall_ms(),
        &passphrase,
        KdfStrength::default(),
    )?;
    keychain::save_data_key(&key)?;
    drop(run_guard);
    eng.set_encryption_summary(EncryptionState::Unlocked, true, Some(enc_meta.key_id()));
    eng.run_round_blocking()
}

pub(crate) fn unlock(secret: String) -> Result<SyncStatus, UserError> {
    let eng = engine::instance()?;
    let run_guard = eng.lock_run();
    let backend = active_backend(eng.home_dir())?;
    let meta = read_remote_meta(backend.as_ref())?.ok_or_else(|| {
        UserError::new("sync.notEncrypted", "End-to-end encryption is not enabled on the remote store.")
    })?;
    let enc = meta.encryption.as_ref().ok_or_else(|| {
        UserError::new("sync.notEncrypted", "End-to-end encryption is not enabled on the remote store.")
    })?;
    let key = unwrap_with_secret(enc, &secret)?;
    keychain::save_data_key(&key)?;
    let key_id = enc.key_id();
    drop(run_guard);
    eng.set_encryption_summary(EncryptionState::Unlocked, true, Some(key_id));
    eng.run_round_blocking()
}

pub(crate) fn change_passphrase(
    current_secret: String,
    new_passphrase: String,
) -> Result<SyncStatus, UserError> {
    let eng = engine::instance()?;
    let _run_guard = eng.lock_run();
    let backend = active_backend(eng.home_dir())?;
    let key = verified_key_for_remote(backend.as_ref(), Some(&current_secret))?;
    let next_enc = rewrap_remote_passphrase_with(
        backend.as_ref(),
        &key,
        &new_passphrase,
        KdfStrength::default(),
    )?;
    keychain::save_data_key(&key)?;
    Ok(eng.set_encryption_summary(EncryptionState::Unlocked, true, Some(next_enc.key_id())))
}

pub(crate) fn disable(secret: String) -> Result<SyncStatus, UserError> {
    let eng = engine::instance()?;
    let run_guard = eng.lock_run();
    let backend = active_backend(eng.home_dir())?;
    let key = verified_key_for_remote(backend.as_ref(), Some(&secret))?;
    migrate_remote_to_plain(backend.as_ref(), &key)?;
    keychain::delete_data_key()?;
    drop(run_guard);
    eng.set_encryption_summary(EncryptionState::Off, false, None);
    eng.run_round_blocking()
}

pub(crate) fn reset_remote(passphrase: Option<String>) -> Result<SyncStatus, UserError> {
    let eng = engine::instance()?;
    let run_guard = eng.lock_run();
    let backend = active_backend(eng.home_dir())?;
    let created = reset_remote_store_with(
        backend.as_ref(),
        clock::wall_ms(),
        passphrase.as_deref(),
        KdfStrength::default(),
    )?;
    match &created {
        Some((_, key)) => keychain::save_data_key(key)?,
        None => keychain::delete_data_key()?,
    }
    eng.prepare_after_remote_reset();
    drop(run_guard);
    match created {
        Some((enc, _)) => eng.set_encryption_summary(EncryptionState::Unlocked, true, Some(enc.key_id())),
        None => eng.set_encryption_summary(EncryptionState::Off, false, None),
    };
    eng.run_round_blocking()
}

fn require_unlocked_local_key() -> Result<DataKey, UserError> {
    keychain::read_data_key()?.ok_or_else(|| {
        UserError::new(
            "sync.noUnlockedKey",
            "Unlock sync encryption on this computer first before exporting the recovery key.",
        )
    })
}

pub(crate) fn copy_recovery_key() -> Result<(), UserError> {
    let key = require_unlocked_local_key()?;
    keychain::copy_recovery_key(&key)
}

pub(crate) fn save_recovery_key() -> Result<String, UserError> {
    let key = require_unlocked_local_key()?;
    keychain::save_recovery_key_file(&key)
}
