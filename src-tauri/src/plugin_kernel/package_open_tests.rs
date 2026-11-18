use std::{
    fs::{self, File},
    path::PathBuf,
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD, Engine};

use super::{
    encode_base64, find_in_args, read_package_file, split_opened_urls, store_pending_path,
    take_pending_path, validate_package_file, MAX_PACKAGE_BYTES,
};

struct TempDir(PathBuf);

impl TempDir {
    fn new(prefix: &str) -> Self {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let seq = COUNTER.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("fuyu-pkg-open-{prefix}-{}-{stamp}-{seq}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }

    fn path(&self) -> &std::path::Path {
        &self.0
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn finds_existing_fuyu_file_case_insensitively_and_resolves_relative_cwd() {
    let temp = TempDir::new("args");
    let lower = temp.path().join("fuyu-weather-1.0.0.fuyu");
    let upper = temp.path().join("DEMO-PLUGIN-0.2.0.FUYU");
    let mixed = temp.path().join("sample.FuYu");
    let text = temp.path().join("notes.txt");
    let folder = temp.path().join("folder.fuyu");
    fs::write(&lower, b"PK\x03\x04demo").unwrap();
    fs::write(&upper, b"PK\x03\x04upper").unwrap();
    fs::write(&mixed, b"PK\x03\x04mixed").unwrap();
    fs::write(&text, b"not a plugin").unwrap();
    fs::create_dir_all(&folder).unwrap();

    assert_eq!(
        find_in_args(["--flag", "notes.txt", "fuyu-weather-1.0.0.fuyu"], Some(temp.path())),
        Some(lower),
    );
    assert_eq!(
        find_in_args(["DEMO-PLUGIN-0.2.0.FUYU"], Some(temp.path())),
        Some(upper),
    );
    assert_eq!(
        find_in_args([mixed.as_os_str()], None),
        Some(mixed),
    );
    assert_eq!(find_in_args(["missing.fuyu"], Some(temp.path())), None);
    assert_eq!(find_in_args(["folder.fuyu"], Some(temp.path())), None);
    assert_eq!(find_in_args(["fuyu://market/install/foo"], Some(temp.path())), None);
}

#[test]
fn enforces_twenty_megabyte_package_size_limit() {
    let temp = TempDir::new("limit");
    let exact = temp.path().join("exact-limit.fuyu");
    let over = temp.path().join("over-limit.fuyu");

    let exact_file = File::create(&exact).unwrap();
    exact_file.set_len(MAX_PACKAGE_BYTES).unwrap();
    drop(exact_file);

    let over_file = File::create(&over).unwrap();
    over_file.set_len(MAX_PACKAGE_BYTES + 1).unwrap();
    drop(over_file);

    assert_eq!(validate_package_file(&exact), Some(exact.clone()));
    assert_eq!(validate_package_file(&over), None);
    assert_eq!(find_in_args(["over-limit.fuyu"], Some(temp.path())), None);

    let err = read_package_file(&over).unwrap_err();
    assert!(err.contains("20 MB"), "unexpected error: {err}");
}

#[test]
fn encodes_package_bytes_to_standard_base64_and_preserves_file_name() {
    assert_eq!(encode_base64(b""), "");
    assert_eq!(encode_base64(b"f"), "Zg==");
    assert_eq!(encode_base64(b"fo"), "Zm8=");
    assert_eq!(encode_base64(b"foo"), "Zm9v");

    let temp = TempDir::new("read");
    let pkg_path = temp.path().join("someone-clock-1.2.3.fuyu");
    let raw: Vec<u8> = (0u8..=255u8).collect();
    fs::write(&pkg_path, &raw).unwrap();

    let pkg = read_package_file(&pkg_path).unwrap();
    assert_eq!(pkg.file_name, "someone-clock-1.2.3.fuyu");
    assert_eq!(STANDARD.decode(&pkg.base64).unwrap(), raw);
}

#[test]
fn splits_opened_file_urls_from_other_urls_and_takes_pending_slot_once() {
    let temp = TempDir::new("urls");
    let pkg_path = temp.path().join("space name.fuyu");
    let other_file = temp.path().join("archive.zip");
    fs::write(&pkg_path, b"PK\x03\x04pkg").unwrap();
    fs::write(&other_file, b"PK\x03\x04zip").unwrap();

    let pkg_url = tauri::Url::from_file_path(&pkg_path).unwrap();
    let zip_url = tauri::Url::from_file_path(&other_file).unwrap();
    let deep_link = tauri::Url::parse("fuyu://plugin/demo/open").unwrap();

    let (found, rest) = split_opened_urls(&[zip_url.clone(), pkg_url, deep_link.clone()]);
    assert_eq!(found, Some(pkg_path.clone()));
    assert_eq!(rest, vec![zip_url, deep_link]);

    store_pending_path(pkg_path.clone());
    assert_eq!(take_pending_path(), Some(pkg_path));
    assert_eq!(take_pending_path(), None);
}
