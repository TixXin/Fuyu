use serde_json::{json, Value};

use super::{
    keychain,
    migrate::{
        list_all_device_files, migrate_remote_to_encrypted_with, migrate_remote_to_plain,
        read_remote_meta, reset_remote_store_with, rewrap_remote_passphrase_with, KdfStrength,
    },
    open_bytes, seal_bytes, unwrap_with_secret, wrap_data_key, wrap_data_key_with_params, DataKey,
    ARGON2_ITERATIONS, ARGON2_MEMORY_KIB, ARGON2_PARALLELISM,
};
use crate::sync::{
    backend::Backend,
    backend_folder::FolderBackend,
    base,
    codec::{self, Cipher},
    config::{SyncBackendKind, SyncCategory, SyncConfig},
    layout::SCHEMA_VERSION,
    round::{Options, Outcome, RoundResult},
    status::{EncryptionState, SyncPhase, SyncStatus},
    test_devices::{record, temp, todo, Device},
    webdav::{
        tests::{EtagFlavor, MockDavServer},
        WebdavBackend,
    },
};

fn fast_kdf() -> KdfStrength {
    KdfStrength {
        memory_kib: 8_192,
        iterations: 1,
        parallelism: 1,
    }
}

#[test]
fn argon2id_64mib_three_rounds_wraps_and_unwraps_data_key() {
    let key = DataKey::generate().expect("generate key");
    let meta = wrap_data_key(&key, "correct horse battery staple").expect("wrap 64 MiB");
    assert_eq!(meta.version, 1);
    assert_eq!(meta.kdf.algorithm, "argon2id");
    assert_eq!(meta.kdf.memory_kib, ARGON2_MEMORY_KIB);
    assert_eq!(meta.kdf.iterations, ARGON2_ITERATIONS);
    assert_eq!(meta.kdf.parallelism, ARGON2_PARALLELISM);
    assert_eq!(meta.key_check, key.key_check());

    let unwrapped = unwrap_with_secret(&meta, "correct horse battery staple").expect("unwrap");
    assert_eq!(unwrapped, key);
}

#[test]
fn wrong_or_short_passphrase_returns_typed_user_errors() {
    let key = DataKey::generate().expect("generate key");
    let short_err = wrap_data_key_with_params(&key, "12345", 8_192, 1, 1).expect_err("too short");
    assert_eq!(short_err.code(), "sync.passphraseTooShort");

    let meta = wrap_data_key_with_params(&key, "alpha-bravo-99", 8_192, 1, 1).expect("wrap");
    let wrong = unwrap_with_secret(&meta, "wrong-passphrase").expect_err("wrong pass");
    assert_eq!(wrong.code(), "sync.badPassphrase");

    let empty = unwrap_with_secret(&meta, "   ").expect_err("empty pass");
    assert_eq!(empty.code(), "sync.badPassphrase");
}

#[test]
fn recovery_key_roundtrips_tolerates_formatting_and_rejects_typos() {
    let key = DataKey::generate().expect("generate key");
    let formatted = key.to_recovery_key();
    assert!(formatted.starts_with("FUYU-"), "{formatted}");
    assert_eq!(formatted.split('-').count(), 9, "{formatted}");

    let parsed = DataKey::from_recovery_key(&formatted).expect("parse exact");
    assert_eq!(parsed, key);

    let sloppy = formatted.to_ascii_lowercase().replace('-', " ");
    let parsed_sloppy = DataKey::from_recovery_key(&sloppy).expect("parse lowercase spaces");
    assert_eq!(parsed_sloppy, key);

    let mut mutated: Vec<char> = formatted.chars().collect();
    let idx = mutated
        .iter()
        .rposition(|ch| *ch != '-')
        .expect("char index");
    mutated[idx] = if mutated[idx] == 'A' { 'B' } else { 'A' };
    let corrupted: String = mutated.into_iter().collect();
    assert!(DataKey::from_recovery_key(&corrupted).is_none());

    let meta = wrap_data_key_with_params(&key, "original-pass-123", 8_192, 1, 1).expect("wrap");
    let via_recovery = unwrap_with_secret(&meta, &formatted).expect("unlock via recovery key");
    assert_eq!(via_recovery, key);

    let other_key = DataKey::generate().expect("other key");
    let mismatch = unwrap_with_secret(&meta, &other_key.to_recovery_key()).expect_err("other rk");
    assert_eq!(mismatch.code(), "sync.badPassphrase");
}

#[test]
fn xchacha20_poly1305_binds_aad_to_remote_path_and_schema_version() {
    let key = DataKey::generate().expect("generate key");
    let path_todos = "fuyu-sync/devices/a1b2c3d4e5f60718/todos.json";
    let path_links = "fuyu-sync/devices/a1b2c3d4e5f60718/links.json";
    let payload = json!({
        "schemaVersion": SCHEMA_VERSION,
        "category": "todos",
        "secretTitle": "Top secret launch checklist"
    });

    let sealed = codec::encode(path_todos, SCHEMA_VERSION, &payload, &Cipher::Encrypted(key.clone()))
        .expect("seal");
    let raw_str = String::from_utf8(sealed.clone()).expect("utf8 envelope");
    assert!(raw_str.contains("\"fuyuEncrypted\":1"), "{raw_str}");
    assert!(!raw_str.contains("Top secret launch checklist"), "{raw_str}");
    assert_eq!(codec::peek_schema_version(&sealed), Some(u64::from(SCHEMA_VERSION)));

    let opened = codec::decode(path_todos, &sealed, &Cipher::Encrypted(key.clone())).expect("open");
    assert_eq!(opened, payload);

    assert!(codec::decode(path_links, &sealed, &Cipher::Encrypted(key.clone())).is_err());
    assert!(codec::decode(path_todos, &sealed, &Cipher::Plain).is_err());

    let wrong_key = DataKey::generate().expect("wrong key");
    assert!(open_bytes(&wrong_key, path_todos, &sealed).is_err());

    let mut tampered: Value = serde_json::from_slice(&sealed).expect("envelope json");
    tampered["schemaVersion"] = json!(SCHEMA_VERSION + 1);
    let tampered_bytes = serde_json::to_vec(&tampered).expect("tampered vec");
    assert_eq!(
        codec::peek_schema_version(&tampered_bytes),
        Some(u64::from(SCHEMA_VERSION + 1))
    );
    assert!(open_bytes(&key, path_todos, &tampered_bytes).is_err());

    let future_sealed = seal_bytes(&key, path_todos, 99, b"{\"schemaVersion\":99}").expect("future");
    assert_eq!(codec::peek_schema_version(&future_sealed), Some(99));
}

#[test]
fn changing_passphrase_rewraps_meta_without_rewriting_device_files() {
    let root = temp("crypto-rewrap");
    let folder = root.join("cloud");
    std::fs::create_dir_all(&folder).expect("cloud");
    let backend = FolderBackend::new(folder.clone());

    let mut dev = Device::new("a1b2c3d4e5f60718", &root);
    let s1 = dev.stamp();
    dev.todos.data["todos"] = json!([todo("t1", "Keep exact ciphertext", &s1)]);
    assert!(matches!(dev.sync_backend(&backend, Options::default()), RoundResult::Done { .. }));

    let (enc1, key) =
        migrate_remote_to_encrypted_with(&backend, 1_800_000_000_000, "first-passphrase", fast_kdf())
            .expect("enable encryption");
    let todos_path = "fuyu-sync/devices/a1b2c3d4e5f60718/todos.json";
    let before_bytes = backend.read(todos_path).expect("read").expect("exists");

    let enc2 = rewrap_remote_passphrase_with(&backend, &key, "second-passphrase", fast_kdf())
        .expect("change passphrase");
    assert_eq!(enc1.key_check, enc2.key_check);
    assert_ne!(enc1.wrapped_key.ciphertext, enc2.wrapped_key.ciphertext);

    let after_bytes = backend.read(todos_path).expect("read").expect("exists");
    assert_eq!(before_bytes, after_bytes);

    let remote_meta = read_remote_meta(&backend).expect("meta").expect("present");
    let remote_enc = remote_meta.encryption.expect("encrypted");
    assert!(unwrap_with_secret(&remote_enc, "first-passphrase").is_err());
    assert_eq!(
        unwrap_with_secret(&remote_enc, "second-passphrase").expect("new pass"),
        key
    );
    assert_eq!(
        unwrap_with_secret(&remote_enc, &key.to_recovery_key()).expect("recovery still works"),
        key
    );
}

fn exercise_full_migration_and_sync(name: &str, backend_a: &dyn Backend, backend_b: &dyn Backend) {
    let root = temp(name);
    let mut a = Device::new("a1b2c3d4e5f60718", &root);
    let mut b = Device::new("b2c3d4e5f6071829", &root);
    a.favorites.enabled = true;
    b.favorites.enabled = true;

    let s1 = a.stamp();
    a.todos.data["todos"] = json!([todo("t-plain", "Private roadmap item", &s1)]);
    a.todos.data["dailyNote"] = json!("Confidential daily journal");
    a.todos.data["dailyNoteUpdatedAt"] = json!(s1.to_string());
    a.snippets.items = vec![record("snip-1", "text", "ssh root@10.0.0.8", &s1)];

    assert!(matches!(a.sync_backend(backend_a, Options::default()), RoundResult::Done { .. }));
    assert!(matches!(b.sync_backend(backend_b, Options::default()), RoundResult::Done { .. }));
    assert_eq!(b.todo_ids(), vec!["t-plain"]);

    let (enc_meta, key) = migrate_remote_to_encrypted_with(
        backend_a,
        1_800_000_010_000,
        "vault-passphrase-2026",
        fast_kdf(),
    )
    .expect("migrate to encrypted");

    for path in list_all_device_files(backend_a).expect("list encrypted files") {
        let raw = backend_a.read(&path).expect("read").expect("bytes");
        let text = String::from_utf8_lossy(&raw);
        assert!(text.contains("\"fuyuEncrypted\":1"), "{path}: {text}");
        assert!(!text.contains("Private roadmap item"), "{path}: {text}");
        assert!(!text.contains("Confidential daily journal"), "{path}: {text}");
        assert!(!text.contains("10.0.0.8"), "{path}: {text}");
    }

    let locked_round = b.sync_backend(backend_b, Options::default());
    assert_eq!(
        locked_round,
        RoundResult::EncryptionLocked {
            key_id: enc_meta.key_id()
        }
    );

    let cfg = SyncConfig {
        version: 1,
        backend: Some(SyncBackendKind::Folder),
        folder: Some("/tmp/sync".into()),
        webdav: None,
        categories: vec![SyncCategory::Todos],
        optional_groups: Vec::new(),
    };
    let mut status = SyncStatus::new(&cfg, Some(b.id.clone()), false, false);
    status.finish(locked_round, None, &b.id, 1_800_000_011_000);
    assert_eq!(status.phase, SyncPhase::Locked);
    assert_eq!(status.encryption.state, EncryptionState::Locked);
    assert_eq!(status.encryption.key_id.as_deref(), Some(enc_meta.key_id().as_str()));

    b.key = Some(DataKey::generate().expect("wrong local key"));
    assert_eq!(
        b.sync_backend(backend_b, Options::default()),
        RoundResult::EncryptionLocked {
            key_id: enc_meta.key_id()
        }
    );

    let unlocked_b = unwrap_with_secret(&enc_meta, "vault-passphrase-2026").expect("unlock B");
    a.key = Some(key.clone());
    b.key = Some(unlocked_b);

    b.clock.wall = a.clock.wall + 2_000;
    let s2 = b.stamp();
    b.todos.data["todos"] = json!([
        todo("t-plain", "Private roadmap item", &s1),
        todo("t-enc", "Added while E2EE active", &s2)
    ]);
    assert!(matches!(b.sync_backend(backend_b, Options::default()), RoundResult::Done { .. }));
    let done_a = a.sync_backend(backend_a, Options::default());
    assert!(matches!(done_a, RoundResult::Done { .. }));
    assert_eq!(a.todo_ids(), vec!["t-enc", "t-plain"]);

    status.configure(&cfg, false, true);
    status.finish(done_a, None, &a.id, 1_800_000_015_000);
    assert_eq!(status.phase, SyncPhase::Idle);
    assert_eq!(status.encryption.state, EncryptionState::Unlocked);

    let future_bytes = seal_bytes(
        &key,
        "fuyu-sync/devices/b2c3d4e5f6071829/snippets.json",
        SCHEMA_VERSION + 1,
        br#"{"schemaVersion":2,"category":"snippets","deviceId":"b2c3d4e5f6071829","entries":{}}"#,
    )
    .expect("seal newer");
    backend_b
        .write("fuyu-sync/devices/b2c3d4e5f6071829/snippets.json", &future_bytes)
        .expect("write newer");
    let newer_res = a.sync_backend(backend_a, Options::default());
    let RoundResult::Done { categories, .. } = newer_res else {
        panic!("expected Done with category NewerVersion")
    };
    assert!(categories.contains(&(SyncCategory::Snippets, Outcome::NewerVersion)));
    assert!(matches!(b.sync_backend(backend_b, Options::default()), RoundResult::Done { .. }));

    migrate_remote_to_plain(backend_a, &key).expect("disable encryption back to plain");
    a.key = None;
    b.key = None;

    for path in list_all_device_files(backend_a).expect("list plain files") {
        let raw = backend_a.read(&path).expect("read").expect("bytes");
        let text = String::from_utf8_lossy(&raw);
        assert!(!text.contains("\"fuyuEncrypted\""), "{path}: {text}");
    }

    a.clock.wall = b.clock.wall + 2_000;
    let s3 = a.stamp();
    a.todos.data["todos"] = json!([
        todo("t-plain", "Private roadmap item", &s1),
        todo("t-enc", "Added while E2EE active", &s2),
        todo("t-after-off", "Added after turning E2EE off", &s3)
    ]);
    assert!(matches!(a.sync_backend(backend_a, Options::default()), RoundResult::Done { .. }));
    assert!(matches!(b.sync_backend(backend_b, Options::default()), RoundResult::Done { .. }));
    assert_eq!(b.todo_ids(), vec!["t-after-off", "t-enc", "t-plain"]);
    assert_eq!(b.todos.data["dailyNote"], "Confidential daily journal");
    assert_eq!(b.snippets.items.len(), 1);

    let reset_created = reset_remote_store_with(
        backend_a,
        1_800_000_030_000,
        Some("fresh-reset-passphrase"),
        fast_kdf(),
    )
    .expect("reset remote")
    .expect("encrypted reset");
    assert!(list_all_device_files(backend_a).expect("empty after reset").is_empty());

    base::forget(&a.state);
    a.key = Some(reset_created.1.clone());
    assert!(matches!(
        a.sync_backend(
            backend_a,
            Options {
                allow_deletions: false,
                allow_reset: true
            }
        ),
        RoundResult::Done { .. }
    ));

    let mut c = Device::new("c3d4e5f60718293a", &root);
    c.key = Some(
        unwrap_with_secret(&reset_created.0, "fresh-reset-passphrase").expect("unlock C after reset"),
    );
    assert!(matches!(c.sync_backend(backend_b, Options::default()), RoundResult::Done { .. }));
    assert_eq!(c.todo_ids(), vec!["t-after-off", "t-enc", "t-plain"]);
}

#[test]
fn folder_backend_preserves_all_data_across_enable_sync_disable_and_reset() {
    let root = temp("crypto-folder-e2e");
    let folder = root.join("cloud");
    std::fs::create_dir_all(&folder).expect("cloud");
    let backend_a = FolderBackend::new(folder.clone());
    let backend_b = FolderBackend::new(folder);
    exercise_full_migration_and_sync("crypto-folder-devs", &backend_a, &backend_b);
}

#[test]
fn webdav_backend_preserves_all_data_across_enable_sync_disable_and_reset() {
    let server = MockDavServer::start("alice@example.com", "app-pass-xyz", EtagFlavor::NutstoreUnquoted);
    let url = server.url("/dav/我的坚果云/FuyuSync");
    let backend_a = WebdavBackend::new(&url, "alice@example.com", "app-pass-xyz").expect("dav a");
    let backend_b = WebdavBackend::new(&url, "alice@example.com", "app-pass-xyz").expect("dav b");
    exercise_full_migration_and_sync("crypto-webdav-devs", &backend_a, &backend_b);
}

#[test]
fn keychain_test_store_saves_reads_and_deletes_data_key() {
    let key = DataKey::generate().expect("key");
    keychain::set_test_key_override(Some(None));
    assert_eq!(keychain::read_data_key().expect("read empty"), None);
    assert!(!keychain::has_data_key());

    keychain::save_data_key(&key).expect("save");
    assert_eq!(keychain::read_data_key().expect("read saved"), Some(key));
    assert!(keychain::has_data_key());

    keychain::delete_data_key().expect("delete");
    assert_eq!(keychain::read_data_key().expect("read deleted"), None);
    keychain::set_test_key_override(None);
}
