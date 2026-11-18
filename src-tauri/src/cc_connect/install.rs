use crate::user_error::UserError;
use std::{
    fs::{self, File},
    io::{self, Cursor, Read},
    path::{Path, PathBuf},
    time::Duration,
};

use serde::Deserialize;
use sha2::{Digest, Sha256};

use super::locate::{EXE_NAME, FOLDER};
use crate::system::updater::reqwest_proxy;

const LATEST: &str = "https://api.github.com/repos/chenhg5/cc-connect/releases/latest";
const DOWNLOADS: &str = "https://github.com/chenhg5/cc-connect/releases/download/";
const MAX_TEXT: u64 = 1 << 20;
const MAX_ZIP: u64 = 100 << 20;
const MAX_EXE: u64 = 300 << 20;
const TIMEOUT: Duration = Duration::from_secs(600);

#[derive(Deserialize)]
pub(super) struct Release {
    pub(super) tag_name: String,
    assets: Vec<Asset>,
}

#[derive(Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

pub(super) struct Package {
    pub(super) sha256: String,
    pub(super) bytes: Vec<u8>,
}

pub(super) async fn latest(client: &reqwest::Client) -> Result<Release, UserError> {
    let release: Release =
        serde_json::from_slice(&get(client, LATEST, MAX_TEXT).await?).map_err(|error| UserError::new("net.unreadable", "Could not read GitHub's answer.").arg("service", "GitHub").detail(error))?;
    let tag = release.tag_name.as_str();
    if tag.is_empty() || !tag.bytes().all(|byte| byte.is_ascii_alphanumeric() || b".-_".contains(&byte)) {
        return Err(UserError::new("ccConnect.tag", format!("cc-connect's version tag is not valid: {tag}")).arg("tag", tag));
    }
    Ok(release)
}

pub(super) async fn download(client: &reqwest::Client, release: &Release, name: &str) -> Result<Package, UserError> {
    let tag = release.tag_name.as_str();
    let url_of = |name: &str| {
        release
            .assets
            .iter()
            .find(|asset| asset.name == name && asset.browser_download_url.starts_with(DOWNLOADS))
            .map(|asset| asset.browser_download_url.as_str())
            .ok_or_else(|| UserError::new("ccConnect.asset", format!("cc-connect {tag} has no {name}.")).arg("tag", tag).arg("name", name))
    };
    let sums = get(client, url_of("checksums.txt")?, MAX_TEXT).await?;
    let expected = checksum_for(&String::from_utf8_lossy(&sums), name).ok_or_else(|| UserError::new("ccConnect.checksumMissing", format!("checksums.txt does not list {name}.")).arg("name", name))?;
    let bytes = get(client, url_of(name)?, MAX_ZIP).await?;
    let actual: String = Sha256::digest(&bytes).iter().map(|byte| format!("{byte:02x}")).collect();
    if actual != expected {
        return Err(UserError::new("ccConnect.checksum", "The downloaded cc-connect does not match the release's checksum; it was thrown away."));
    }
    Ok(Package { sha256: actual, bytes })
}

pub(super) async fn install(app_dir: PathBuf) -> Result<PathBuf, UserError> {
    let client = client()?;
    let release = latest(&client).await?;
    let dir = app_dir.join(FOLDER).join(&release.tag_name);
    let exe = dir.join(EXE_NAME);
    if exe.is_file() {
        return Ok(exe);
    }
    let archive_name = asset_name(&release.tag_name, std::env::consts::OS, std::env::consts::ARCH)?;
    let package = download(&client, &release, &archive_name).await?;
    tauri::async_runtime::spawn_blocking(move || unpack(&package.bytes, &dir, &exe).map(|()| exe))
        .await
        .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

pub(super) fn client() -> Result<reqwest::Client, UserError> {
    let mut builder = reqwest::Client::builder()
        .timeout(TIMEOUT)
        .user_agent(concat!("Fuyu/", env!("CARGO_PKG_VERSION")));
    if let Some(proxy) = reqwest_proxy()? {
        builder = builder.proxy(proxy);
    }
    builder.build().map_err(|error| UserError::new("http.client", "Could not set up the connection.").detail(error))
}

async fn get(client: &reqwest::Client, url: &str, limit: u64) -> Result<Vec<u8>, UserError> {
    let response = client.get(url).send().await.map_err(|error| UserError::new("net.unreachable", format!("Could not reach {}.", url)).arg("service", url).detail(error))?;
    if !response.status().is_success() {
        return Err(UserError::new("net.status", format!("{url} answered {}.", response.status())).arg("service", url).arg("status", response.status().as_u16()));
    }
    if response.content_length().is_some_and(|length| length > limit) {
        return Err(UserError::new("net.tooLarge", format!("{url} is larger than {limit} bytes.")).arg("service", url).arg("bytes", limit));
    }
    let bytes = response.bytes().await.map_err(|error| UserError::new("net.unreachable", format!("Could not reach {}.", url)).arg("service", url).detail(error))?;
    if bytes.len() as u64 > limit {
        return Err(UserError::new("net.tooLarge", format!("{url} is larger than {limit} bytes.")).arg("service", url).arg("bytes", limit));
    }
    Ok(bytes.to_vec())
}

fn asset_name(tag: &str, os: &str, arch: &str) -> Result<String, UserError> {
    let arch = match arch {
        "x86_64" => "amd64",
        "aarch64" => "arm64",
        other => return Err(UserError::new("ccConnect.arch", format!("cc-connect has no build for {other}.")).arg("arch", other)),
    };
    match os {
        "windows" => Ok(format!("cc-connect-{tag}-windows-{arch}.zip")),
        "macos" => Ok(format!("cc-connect-{tag}-darwin-{arch}.tar.gz")),
        other => Err(UserError::new("ccConnect.arch", format!("cc-connect has no build for {other}.")).arg("arch", other)),
    }
}

fn checksum_for(sums: &str, name: &str) -> Option<String> {
    sums.lines().find_map(|line| {
        let (hash, file) = line.trim().split_once(char::is_whitespace)?;
        let file = file.trim().trim_start_matches('*');
        (file == name && hash.len() == 64 && hash.bytes().all(|byte| byte.is_ascii_hexdigit())).then(|| hash.to_ascii_lowercase())
    })
}

#[cfg(windows)]
fn unpack(bytes: &[u8], dir: &Path, exe: &Path) -> Result<(), UserError> {
    unpack_zip(bytes, dir, exe)
}

#[cfg(not(windows))]
fn unpack(bytes: &[u8], dir: &Path, exe: &Path) -> Result<(), UserError> {
    unpack_tar_gz(bytes, dir, exe)
}

#[cfg(any(windows, test))]
fn unpack_zip(zip: &[u8], dir: &Path, exe: &Path) -> Result<(), UserError> {
    let mut archive = zip::ZipArchive::new(Cursor::new(zip)).map_err(|error| UserError::new("ccConnect.zip", "Could not read the cc-connect package.").detail(error))?;
    let index = (0..archive.len())
        .find(|&index| {
            archive
                .by_index(index)
                .is_ok_and(|file| file.is_file() && file.name().is_ok_and(|name| name.to_ascii_lowercase().ends_with(".exe")))
        })
        .ok_or_else(|| UserError::new("ccConnect.zipEmpty", "The cc-connect package has no program in it."))?;
    let file = archive.by_index(index).map_err(|error| UserError::new("ccConnect.zip", "Could not read the cc-connect package.").detail(error))?;
    if file.size() > MAX_EXE {
        return Err(UserError::new("ccConnect.zipLarge", "The cc-connect program is unusually large; gave up."));
    }
    write_program(file, dir, exe)
}

#[cfg(any(not(windows), test))]
fn unpack_tar_gz(tgz: &[u8], dir: &Path, exe: &Path) -> Result<(), UserError> {
    let unreadable = |error: io::Error| UserError::new("ccConnect.zip", "Could not read the cc-connect package.").detail(error);
    let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(Cursor::new(tgz)));
    for entry in archive.entries().map_err(unreadable)? {
        let entry = entry.map_err(unreadable)?;
        if !entry.header().entry_type().is_file() {
            continue;
        }
        let path = entry.path().map_err(unreadable)?.into_owned();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else { continue };
        if !is_tar_program(name) {
            continue;
        }
        if entry.size() > MAX_EXE {
            return Err(UserError::new("ccConnect.zipLarge", "The cc-connect program is unusually large; gave up."));
        }
        return write_program(entry, dir, exe);
    }
    Err(UserError::new("ccConnect.zipEmpty", "The cc-connect package has no program in it."))
}

#[cfg(any(not(windows), test))]
fn is_tar_program(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    (name == "cc-connect" || name.starts_with("cc-connect-"))
        && ![".md", ".txt", ".json", ".sha256", ".sig"].iter().any(|ext| lower.ends_with(ext))
}

fn write_program(reader: impl Read, dir: &Path, exe: &Path) -> Result<(), UserError> {
    fs::create_dir_all(dir).map_err(|error| UserError::new("file.create", format!("Could not create {}.", dir.display())).arg("path", dir.display().to_string()).detail(error))?;
    let part = exe.with_file_name(format!("{}.part", exe.file_name().map(|name| name.to_string_lossy()).unwrap_or_default()));
    let mut out = File::create(&part).map_err(|error| UserError::new("file.write", format!("Could not write {}.", part.display())).arg("path", part.display().to_string()).detail(error))?;
    io::copy(&mut reader.take(MAX_EXE), &mut out).map_err(|error| UserError::new("ccConnect.unpack", "Could not unpack cc-connect.").detail(error))?;
    drop(out);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&part, fs::Permissions::from_mode(0o755))
            .map_err(|error| UserError::new("file.write", format!("Could not write {}.", part.display())).arg("path", part.display().to_string()).detail(error))?;
    }
    fs::rename(&part, exe).map_err(|error| UserError::new("file.write", format!("Could not write {}.", exe.display())).arg("path", exe.display().to_string()).detail(error))
}

#[cfg(test)]
mod tests {
    use super::{asset_name, checksum_for, unpack_tar_gz, unpack_zip};
    use std::{fs, io::Write};

    #[test]
    #[ignore = "downloads cc-connect from GitHub"]
    fn downloads_the_latest_release_and_it_runs() {
        use super::install;
        let dir = std::env::temp_dir().join(format!("fuyu-cc-connect-install-{}", std::process::id()));
        let exe = tauri::async_runtime::block_on(install(dir.clone())).unwrap();
        let version = std::process::Command::new(&exe).arg("--version").output().unwrap();
        assert!(String::from_utf8_lossy(&version.stdout).contains("cc-connect"), "{version:?}");
        assert_eq!(tauri::async_runtime::block_on(install(dir.clone())).unwrap(), exe);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_release_archive_matches_os_and_cpu() {
        assert_eq!(asset_name("v1.5.0", "windows", "x86_64").unwrap(), "cc-connect-v1.5.0-windows-amd64.zip");
        assert_eq!(asset_name("v1.5.0", "windows", "aarch64").unwrap(), "cc-connect-v1.5.0-windows-arm64.zip");
        assert_eq!(asset_name("v1.5.2", "macos", "aarch64").unwrap(), "cc-connect-v1.5.2-darwin-arm64.tar.gz");
        assert_eq!(asset_name("v1.5.2", "macos", "x86_64").unwrap(), "cc-connect-v1.5.2-darwin-amd64.tar.gz");
        assert!(asset_name("v1.5.0", "windows", "x86").is_err());
        assert!(asset_name("v1.5.0", "freebsd", "x86_64").is_err());
    }

    #[test]
    fn the_checksum_of_exactly_that_file() {
        let hash = "1d0fdeffa6118ab0a942a3c3918930685bd7d4caef5d7311b0d8f605fad95763";
        let sums = format!(
            "{}  cc-connect-v1.5.0-windows-amd64.exe\n{}  cc-connect-v1.5.0-windows-amd64.zip\nnot a line\n",
            "b".repeat(64),
            hash.to_uppercase()
        );
        assert_eq!(checksum_for(&sums, "cc-connect-v1.5.0-windows-amd64.zip").as_deref(), Some(hash));
        assert_eq!(checksum_for(&format!("{hash} *a.zip"), "a.zip").as_deref(), Some(hash));
        assert_eq!(checksum_for("abc  a.zip", "a.zip"), None);
        assert_eq!(checksum_for(&sums, "cc-connect-v1.5.0-windows-arm64.zip"), None);
    }

    #[test]
    fn the_zip_s_exe_lands_as_cc_connect_exe() {
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
        zip.start_file("README.md", zip::write::SimpleFileOptions::default()).unwrap();
        zip.start_file("cc-connect-v1.5.0-windows-amd64.exe", zip::write::SimpleFileOptions::default()).unwrap();
        zip.write_all(b"MZ program").unwrap();
        let bytes = zip.finish().unwrap().into_inner();
        let dir = std::env::temp_dir().join(format!("fuyu-cc-connect-unpack-{}", std::process::id()));
        let exe = dir.join("cc-connect.exe");
        unpack_zip(&bytes, &dir, &exe).unwrap();
        assert_eq!(fs::read(&exe).unwrap(), b"MZ program");
        assert!(!dir.join("cc-connect.exe.part").exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_tarball_s_program_lands_as_executable_cc_connect() {
        let mut builder = tar::Builder::new(flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast()));
        for (name, data) in [("README.md", &b"hello"[..]), ("cc-connect-v1.5.2-darwin-arm64", &b"#!/bin/sh\necho ok\n"[..])] {
            let mut header = tar::Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(0o644);
            header.set_cksum();
            builder.append_data(&mut header, name, data).unwrap();
        }
        let bytes = builder.into_inner().unwrap().finish().unwrap();
        let dir = std::env::temp_dir().join(format!("fuyu-cc-connect-unpack-tgz-{}", std::process::id()));
        let exe = dir.join("cc-connect");
        unpack_tar_gz(&bytes, &dir, &exe).unwrap();
        assert_eq!(fs::read(&exe).unwrap(), b"#!/bin/sh\necho ok\n");
        assert!(!dir.join("cc-connect.part").exists());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(fs::metadata(&exe).unwrap().permissions().mode() & 0o111, 0o111);
        }
        let _ = fs::remove_dir_all(&dir);
    }
}
