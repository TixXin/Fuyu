use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub(crate) const STATE_FILE: &str = "rename-migration.json";

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

fn is_cache(name: &str) -> bool {
    name.to_ascii_lowercase().ends_with("cache")
}

pub(crate) fn copy_tree(from: &Path, to: &Path) -> io::Result<()> {
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
