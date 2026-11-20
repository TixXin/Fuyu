use std::{
    fs::{self, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

use crate::{download::ArchiveKind, node::hide_window};

#[derive(Debug)]
pub(crate) enum UnpackFailure {
    Missing,
    Disk(std::io::Error),
    Broken(String),
}

pub(crate) fn extract_one(archive: &Path, kind: ArchiveKind, entry: &str, into: &Path) -> Result<PathBuf, UnpackFailure> {
    match kind {
        ArchiveKind::Zip => unzip_one(archive, entry, into),
        ArchiveKind::TarXz => untar_one(archive, entry, into),
    }
}

fn unzip_one(archive: &Path, entry: &str, into: &Path) -> Result<PathBuf, UnpackFailure> {
    let file = File::open(archive).map_err(UnpackFailure::Disk)?;
    let mut zip = zip::ZipArchive::new(file).map_err(|error| UnpackFailure::Broken(format!("not a readable zip: {error}")))?;
    let mut source = match zip.by_name(entry) {
        Ok(source) => source,
        Err(zip::result::ZipError::FileNotFound) => return Err(UnpackFailure::Missing),
        Err(error) => return Err(UnpackFailure::Broken(format!("could not read {entry}: {error}"))),
    };
    let target = into.join(entry);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(UnpackFailure::Disk)?;
    }
    let mut output = File::create(&target).map_err(UnpackFailure::Disk)?;
    let mut buffer = vec![0u8; 64 * 1024];
    loop {
        let read = source.read(&mut buffer).map_err(|error| UnpackFailure::Broken(format!("could not read {entry}: {error}")))?;
        if read == 0 {
            break;
        }
        output.write_all(&buffer[..read]).map_err(UnpackFailure::Disk)?;
    }
    output.sync_all().map_err(UnpackFailure::Disk)?;
    #[cfg(unix)]
    if let Some(mode) = source.unix_mode() {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&target, fs::Permissions::from_mode(mode & 0o777)).map_err(UnpackFailure::Disk)?;
    }
    Ok(target)
}

fn untar_one(archive: &Path, entry: &str, into: &Path) -> Result<PathBuf, UnpackFailure> {
    let tar = if Path::new("/usr/bin/tar").is_file() { Path::new("/usr/bin/tar") } else { Path::new("tar") };
    let mut command = Command::new(tar);
    command.arg("-xJf").arg(archive).arg("-C").arg(into).arg(entry).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::piped());
    hide_window(&mut command);
    let output = command.output().map_err(|error| UnpackFailure::Broken(format!("could not run {}: {error}", tar.display())))?;
    let target = into.join(entry);
    if target.is_file() && output.status.success() {
        return Ok(target);
    }
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();
    if output.status.success() || stderr.to_ascii_lowercase().contains("not found") {
        return Err(UnpackFailure::Missing);
    }
    Err(UnpackFailure::Broken(format!("{} exited with {}: {stderr}", tar.display(), output.status)))
}
