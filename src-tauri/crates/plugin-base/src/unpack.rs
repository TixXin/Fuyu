use std::{
    fs::File,
    path::Path,
    process::{Command, Stdio},
};

use crate::{download::ArchiveKind, node::hide_window};

pub(crate) fn unpack(archive: &Path, kind: ArchiveKind, into: &Path) -> Result<(), String> {
    match kind {
        ArchiveKind::Zip => unzip(archive, into),
        ArchiveKind::TarXz => untar(archive, into),
    }
}

fn unzip(archive: &Path, into: &Path) -> Result<(), String> {
    let file = File::open(archive).map_err(|error| format!("could not open {}: {error}", archive.display()))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|error| format!("not a readable zip: {error}"))?;
    zip.extract(into).map_err(|error| format!("could not extract the zip: {error}"))
}

fn untar(archive: &Path, into: &Path) -> Result<(), String> {
    let tar = if Path::new("/usr/bin/tar").is_file() { Path::new("/usr/bin/tar") } else { Path::new("tar") };
    let mut command = Command::new(tar);
    command.arg("-xJf").arg(archive).arg("-C").arg(into).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::piped());
    hide_window(&mut command);
    let output = command.output().map_err(|error| format!("could not run {}: {error}", tar.display()))?;
    if output.status.success() {
        return Ok(());
    }
    Err(format!("{} exited with {}: {}", tar.display(), output.status, String::from_utf8_lossy(&output.stderr).trim()))
}
