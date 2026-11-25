use std::fs;

use super::{
    font_id, has_valid_font_signature, import_font_in, is_valid_id, list_fonts_in, plan_import,
    read_font_bytes_in, remove_font_in, CustomFontImport,
};

fn temp_dir(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-custom-fonts-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    dir
}

fn valid_ttf() -> Vec<u8> {
    let mut bytes = b"\x00\x01\x00\x00".to_vec();
    bytes.extend_from_slice(&[0u8; 32]);
    bytes
}

fn valid_woff2() -> Vec<u8> {
    let mut bytes = b"wOF2".to_vec();
    bytes.extend_from_slice(&[1u8; 32]);
    bytes
}

#[test]
fn ids_are_ascii_slugs_with_timestamp() {
    assert_eq!(font_id("LXGW WenKai 霞鹜文楷", 255), "lxgw-wenkai-ff");
    assert_eq!(font_id("霞鹜文楷", 16), "font-10");
    assert!(is_valid_id(&font_id("My Font", 1)));
    assert!(!is_valid_id("") && !is_valid_id("../a") && !is_valid_id("-a") && !is_valid_id("a-") && !is_valid_id("A"));
}

#[test]
fn signatures_match_known_font_formats() {
    assert!(has_valid_font_signature("ttf", &valid_ttf()));
    assert!(has_valid_font_signature("otf", b"OTTO1234"));
    assert!(has_valid_font_signature("woff", b"wOFF1234"));
    assert!(has_valid_font_signature("woff2", &valid_woff2()));
    assert!(!has_valid_font_signature("woff2", b"wOFF1234"));
    assert!(!has_valid_font_signature("ttf", b"PNG\x89data"));
    assert!(!has_valid_font_signature("ttf", b"ab"));
}

#[test]
fn plan_rejects_bad_format_empty_and_invalid_magic() {
    let err = plan_import(
        CustomFontImport { name: None, file_name: "evil.exe".into(), bytes: valid_ttf() },
        "evil-1".into(),
    )
    .unwrap_err();
    assert_eq!(err.code(), "customFont.format");

    let err = plan_import(
        CustomFontImport { name: None, file_name: "empty.ttf".into(), bytes: Vec::new() },
        "empty-1".into(),
    )
    .unwrap_err();
    assert_eq!(err.code(), "customFont.sizeOrEmpty");

    let err = plan_import(
        CustomFontImport { name: None, file_name: "fake.woff2".into(), bytes: b"not-a-font".to_vec() },
        "fake-1".into(),
    )
    .unwrap_err();
    assert_eq!(err.code(), "customFont.invalidData");
}

#[test]
fn import_list_read_and_remove_roundtrip() {
    let dir = temp_dir("roundtrip");
    let imported = import_font_in(
        &dir,
        CustomFontImport {
            name: None,
            file_name: "霞鹜文楷-Regular.woff2".into(),
            bytes: valid_woff2(),
        },
        0x100,
    )
    .expect("import");
    assert_eq!(imported.name, "霞鹜文楷-Regular");
    assert_eq!(imported.format, "woff2");
    assert_eq!(imported.file, format!("{}.woff2", imported.id));

    let listed = list_fonts_in(&dir);
    assert_eq!(listed, vec![imported.clone()]);

    let bytes = read_font_bytes_in(&dir, &imported.id).expect("read");
    assert_eq!(bytes, valid_woff2());

    remove_font_in(&dir, &imported.id).expect("remove");
    assert!(list_fonts_in(&dir).is_empty());
    assert_eq!(read_font_bytes_in(&dir, &imported.id).unwrap_err().code(), "customFont.notFound");
    assert_eq!(read_font_bytes_in(&dir, "../evil").unwrap_err().code(), "customFont.badId");

    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn tampered_manifest_pointing_outside_folder_is_ignored() {
    let dir = temp_dir("tampered");
    fs::create_dir_all(&dir).unwrap();
    fs::write(
        dir.join("evil-1.json"),
        r#"{"id":"evil-1","name":"Evil","file":"../settings.json","format":"ttf","size":10}"#,
    )
    .unwrap();
    assert!(list_fonts_in(&dir).is_empty());
    assert_eq!(read_font_bytes_in(&dir, "evil-1").unwrap_err().code(), "customFont.notFound");
    let _ = fs::remove_dir_all(&dir);
}
