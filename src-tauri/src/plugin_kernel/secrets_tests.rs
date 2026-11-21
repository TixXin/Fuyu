use super::*;
use std::{cell::RefCell, collections::BTreeMap};

#[derive(Default)]
struct MemoryVault {
    entries: RefCell<BTreeMap<(String, String), String>>,
    refuse_delete: Option<&'static str>,
}

impl Vault for MemoryVault {
    fn get(&self, service: &str, name: &str) -> Result<Option<String>, String> {
        Ok(self.entries.borrow().get(&(service.to_string(), name.to_string())).cloned())
    }

    fn set(&self, service: &str, name: &str, value: &str) -> Result<(), String> {
        self.entries.borrow_mut().insert((service.to_string(), name.to_string()), value.to_string());
        Ok(())
    }

    fn delete(&self, service: &str, name: &str) -> Result<(), String> {
        if self.refuse_delete == Some(name) {
            return Err("locked".to_string());
        }
        self.entries.borrow_mut().remove(&(service.to_string(), name.to_string()));
        Ok(())
    }
}

struct Home(PathBuf);

impl Home {
    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for Home {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn home() -> Home {
    use std::sync::atomic::{AtomicUsize, Ordering};
    static NEXT: AtomicUsize = AtomicUsize::new(0);
    let dir = std::env::temp_dir().join(format!("fuyu-plugin-secrets-{}-{}", std::process::id(), NEXT.fetch_add(1, Ordering::SeqCst)));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("temp dir");
    Home(dir)
}

fn names(list: &PluginSecretNames) -> Vec<&str> {
    list.names.iter().map(String::as_str).collect()
}

fn index(dir: &Path) -> Value {
    serde_json::from_str(&fs::read_to_string(dir.join(INDEX_FILE)).expect("index")).expect("json")
}

const PLUGIN: &str = "@fuyu/image-host";

#[test]
fn a_plugin_keeps_secrets_under_its_own_service_and_the_index_holds_only_names() {
    let dir = home();
    let vault = MemoryVault::default();
    fs::write(dir.path().join(INDEX_FILE), r#"{ "focusd.old-v2-plugin": ["token"] }"#).expect("old index");
    assert_eq!(names(&set_in(dir.path(), &vault, PLUGIN, "secret-key", "s3cr3t").expect("set")), ["secret-key"]);
    assert_eq!(names(&set_in(dir.path(), &vault, PLUGIN, "access-key", "AKIA").expect("set")), ["access-key", "secret-key"]);
    assert_eq!(names(&set_in(dir.path(), &vault, PLUGIN, "access-key", "AKIB").expect("overwrite")), ["access-key", "secret-key"]);
    assert_eq!(service_of(PLUGIN), "com.tixxin.fuyu.plugin.@fuyu/image-host");
    assert_eq!(vault.entries.borrow().get(&(service_of(PLUGIN), "access-key".to_string())).map(String::as_str), Some("AKIB"));
    assert_eq!(get_in(&vault, PLUGIN, "secret-key").expect("get").value.as_deref(), Some("s3cr3t"));
    assert_eq!(get_in(&vault, PLUGIN, "missing").expect("get").value, None);
    let saved = index(dir.path());
    assert_eq!(saved[PLUGIN], serde_json::json!(["access-key", "secret-key"]));
    assert_eq!(saved["focusd.old-v2-plugin"], serde_json::json!(["token"]));
    assert!(!fs::read_to_string(dir.path().join(INDEX_FILE)).expect("index").contains("s3cr3t"));
    assert_eq!(names(&remove_in(dir.path(), &vault, PLUGIN, "access-key").expect("remove")), ["secret-key"]);
    assert_eq!(get_in(&vault, PLUGIN, "access-key").expect("get").value, None);
    assert_eq!(names(&list_in(dir.path(), PLUGIN).expect("list")), ["secret-key"]);
}

#[test]
fn plugins_cannot_see_each_others_secrets() {
    let dir = home();
    let vault = MemoryVault::default();
    set_in(dir.path(), &vault, PLUGIN, "token", "mine").expect("set");
    assert!(list_in(dir.path(), "@someone/other").expect("list").names.is_empty());
    assert_eq!(get_in(&vault, "@someone/other", "token").expect("get").value, None);
}

#[test]
fn clearing_a_plugin_deletes_its_entries_and_keeps_what_the_store_refused() {
    let dir = home();
    let vault = MemoryVault { refuse_delete: Some("b"), ..MemoryVault::default() };
    for name in ["a", "b", "c"] {
        set_in(dir.path(), &vault, PLUGIN, name, "x").expect("set");
    }
    set_in(dir.path(), &vault, "@someone/other", "a", "y").expect("set");
    let error = clear_in(dir.path(), &vault, PLUGIN).expect_err("b is refused");
    assert_eq!(error.code, "failed");
    assert!(!error.message.contains('x'));
    assert_eq!(names(&list_in(dir.path(), PLUGIN).expect("list")), ["b"]);
    let vault = MemoryVault { entries: vault.entries, refuse_delete: None };
    assert!(clear_in(dir.path(), &vault, PLUGIN).expect("clear").names.is_empty());
    assert!(index(dir.path()).get(PLUGIN).is_none());
    assert_eq!(get_in(&vault, "@someone/other", "a").expect("get").value.as_deref(), Some("y"));
    assert!(clear_in(dir.path(), &vault, "@nobody/none").expect("nothing to clear").names.is_empty());
}

#[test]
fn bad_plugins_names_and_values_are_refused() {
    let dir = home();
    let vault = MemoryVault::default();
    for plugin in ["", "../x", "/abs", "a b", "@x/..", &"p".repeat(215)] {
        assert_eq!(set_in(dir.path(), &vault, plugin, "n", "v").expect_err(plugin).code, "bad-params");
    }
    for name in ["", "-lead", "has space", "a/b", &"n".repeat(65)] {
        assert_eq!(set_in(dir.path(), &vault, PLUGIN, name, "v").expect_err(name).code, "bad-params");
    }
    assert_eq!(set_in(dir.path(), &vault, PLUGIN, "n", "").expect_err("empty").code, "bad-params");
    assert_eq!(set_in(dir.path(), &vault, PLUGIN, "n", &"v".repeat(8193)).expect_err("long").code, "bad-params");
    for index in 0..32 {
        set_in(dir.path(), &vault, PLUGIN, &format!("k{index}"), "v").expect("within the limit");
    }
    assert_eq!(set_in(dir.path(), &vault, PLUGIN, "one-more", "v").expect_err("too many").code, "too-many");
    assert!(set_in(dir.path(), &vault, PLUGIN, "k0", "again").is_ok());
    assert!(!vault.entries.borrow().contains_key(&(service_of(PLUGIN), "one-more".to_string())));
}

#[test]
fn a_damaged_index_reads_as_empty_and_is_rewritten() {
    let dir = home();
    let vault = MemoryVault::default();
    fs::write(dir.path().join(INDEX_FILE), "not json").expect("damaged");
    assert!(list_in(dir.path(), PLUGIN).expect("list").names.is_empty());
    set_in(dir.path(), &vault, PLUGIN, "n", "v").expect("set");
    assert_eq!(index(dir.path())[PLUGIN], serde_json::json!(["n"]));
}

#[test]
#[ignore = "writes to the real system credential store; run by hand with --ignored"]
fn the_system_store_keeps_replaces_and_forgets_a_secret() {
    let dir = home();
    let plugin = "@fuyu-test/secrets-check";
    let _ = clear_in(dir.path(), &SystemVault, plugin);
    set_in(dir.path(), &SystemVault, plugin, "probe", "value-1").expect("set");
    assert_eq!(get_in(&SystemVault, plugin, "probe").expect("get").value.as_deref(), Some("value-1"));
    #[cfg(target_os = "macos")]
    {
        let found = std::process::Command::new("security").args(["find-generic-password", "-s", &service_of(plugin), "-a", "probe"]).output().expect("security");
        assert!(found.status.success(), "the entry is in the login keychain");
    }
    set_in(dir.path(), &SystemVault, plugin, "probe", "value-2").expect("replace");
    assert_eq!(get_in(&SystemVault, plugin, "probe").expect("get").value.as_deref(), Some("value-2"));
    assert!(clear_in(dir.path(), &SystemVault, plugin).expect("clear").names.is_empty());
    assert_eq!(get_in(&SystemVault, plugin, "probe").expect("get").value, None);
}
