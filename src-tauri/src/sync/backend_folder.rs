use std::{
    fs::{self, OpenOptions},
    io::{ErrorKind, Write},
    path::{Path, PathBuf},
};

use super::backend::{is_ignored_name, is_safe_path, Backend, BackendError, Listed};

pub(crate) struct FolderBackend {
    root: PathBuf,
}

impl FolderBackend {
    pub(crate) fn new(root: PathBuf) -> Self {
        Self { root }
    }

    fn resolve(&self, path: &str) -> Result<PathBuf, BackendError> {
        if !is_safe_path(path) {
            return Err(BackendError::Failed(format!("\"{path}\" is not a sync path.")));
        }
        Ok(path.split('/').fold(self.root.clone(), |full, part| full.join(part)))
    }

    fn failed(&self, path: &Path, error: &std::io::Error) -> BackendError {
        if !self.root.is_dir() {
            return BackendError::Unavailable(format!("The sync folder {} is not there.", self.root.display()));
        }
        BackendError::Failed(format!("{}: {error}", path.display()))
    }
}

fn write_synced(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut file = OpenOptions::new().write(true).create(true).truncate(true).open(path)?;
    file.write_all(bytes)?;
    file.sync_all()
}

impl Backend for FolderBackend {
    fn check(&self) -> Result<(), BackendError> {
        match fs::metadata(&self.root) {
            Ok(meta) if meta.is_dir() => Ok(()),
            Ok(_) => Err(BackendError::Unavailable(format!("{} is not a folder.", self.root.display()))),
            Err(error) => Err(BackendError::Unavailable(format!("The sync folder {} is not there: {error}", self.root.display()))),
        }
    }

    fn list(&self, dir: &str) -> Result<Vec<Listed>, BackendError> {
        let full = self.resolve(dir)?;
        let entries = match fs::read_dir(&full) {
            Ok(entries) => entries,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(self.failed(&full, &error)),
        };
        let mut listed: Vec<Listed> = entries
            .flatten()
            .filter_map(|entry| {
                let name = entry.file_name().to_str()?.to_string();
                let is_dir = entry.file_type().ok()?.is_dir();
                (!is_ignored_name(&name)).then_some(Listed { name, is_dir })
            })
            .collect();
        listed.sort_by(|left, right| left.name.cmp(&right.name));
        Ok(listed)
    }

    fn read(&self, path: &str) -> Result<Option<Vec<u8>>, BackendError> {
        let full = self.resolve(path)?;
        match fs::read(&full) {
            Ok(bytes) => Ok(Some(bytes)),
            Err(error) if error.kind() == ErrorKind::NotFound => {
                self.check()?;
                Ok(None)
            }
            Err(error) => Err(self.failed(&full, &error)),
        }
    }

    fn write(&self, path: &str, bytes: &[u8]) -> Result<(), BackendError> {
        self.check()?;
        let full = self.resolve(path)?;
        let (Some(parent), Some(name)) = (full.parent(), full.file_name().and_then(|name| name.to_str())) else {
            return Err(BackendError::Failed(format!("\"{path}\" is not a sync path.")));
        };
        fs::create_dir_all(parent).map_err(|error| self.failed(parent, &error))?;
        let temporary = parent.join(format!(".{name}.fuyu-tmp"));
        write_synced(&temporary, bytes).map_err(|error| {
            let _ = fs::remove_file(&temporary);
            self.failed(&temporary, &error)
        })?;
        fs::rename(&temporary, &full).map_err(|error| {
            let _ = fs::remove_file(&temporary);
            self.failed(&full, &error)
        })
    }

    fn delete(&self, path: &str) -> Result<(), BackendError> {
        let full = self.resolve(path)?;
        match fs::remove_file(&full) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
            Err(error) => Err(self.failed(&full, &error)),
        }
    }
}
