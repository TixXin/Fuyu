//! Copying the data folders from the old app identifier to the new one.
//!
//! Both AppData folders (Roaming: settings and data files; Local: the WebView's
//! storage, so localStorage) are copied to `<new>.migrating` first and renamed
//! into place at the end, the Roaming one last, so a Roaming folder under the new
//! identifier means the copy finished (or the app started there fresh). A copy
//! cut short leaves only `.migrating` folders, which the next start removes
//! before trying again. The old folders are never changed.

use std::{
    fs, io,
    path::{Path, PathBuf},
};

/// Written into the new Roaming folder when the copy is done (`MigrationState` in mod.rs).
pub(crate) const STATE_FILE: &str = "rename-migration.json";

/// Copies `<base>/<old>` to `<base>/<new>` for each base (Roaming first, then
/// Local) when the new Roaming folder does not exist yet and an old folder does.
/// `state` is written into the new Roaming folder. Returns whether it copied.
pub(crate) fn copy_data_dirs(bases: &[PathBuf], old: &str, new: &str, state: &str) -> io::Result<bool> {
    let Some(roaming) = bases.first() else {
        return Ok(false);
    };
    if roaming.join(new).exists() || !bases.iter().any(|base| base.join(old).is_dir()) {
        return Ok(false);
    }
    let staging = |base: &Path| base.join(format!("{new}.migrating"));
    let result = (|| {
        for base in bases {
            remove_if_present(&staging(base))?;
            let from = base.join(old);
            if from.is_dir() {
                copy_tree(&from, &staging(base))?;
            } else {
                fs::create_dir_all(staging(base))?;
            }
        }
        fs::write(staging(roaming).join(STATE_FILE), state)?;
        for base in bases.iter().skip(1).chain(std::iter::once(roaming)) {
            // Only a copy cut short between the renames leaves a folder here.
            remove_if_present(&base.join(new))?;
            fs::rename(staging(base), base.join(new))?;
        }
        Ok(())
    })();
    if result.is_err() {
        for base in bases {
            let _ = remove_if_present(&staging(base));
        }
    }
    result.map(|()| true)
}

fn remove_if_present(dir: &Path) -> io::Result<()> {
    match fs::remove_dir_all(dir) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
        _ => Ok(()),
    }
}

/// The WebView rebuilds its caches; they are large and not worth copying.
fn is_cache(name: &str) -> bool {
    name.to_ascii_lowercase().ends_with("cache")
}

fn copy_tree(from: &Path, to: &Path) -> io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let kind = entry.file_type()?;
        let target = to.join(entry.file_name());
        if kind.is_dir() {
            if !is_cache(&entry.file_name().to_string_lossy()) {
                copy_tree(&entry.path(), &target)?;
            }
        } else if kind.is_file() {
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}
