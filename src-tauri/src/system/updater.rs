use crate::user_error::UserError;
use tauri::{AppHandle, Url};

pub(crate) fn get_updater_proxy() -> Option<String> {
    super::proxy::effective_proxy_url()
}

pub(crate) fn proxy_url() -> Result<Option<Url>, UserError> {
    super::proxy::proxy_url()
}

pub(crate) fn reqwest_proxy() -> Result<Option<reqwest::Proxy>, UserError> {
    super::proxy::reqwest_proxy()
}

#[cfg(test)]
fn proxy_url_from(proxy: Option<String>) -> Result<Option<Url>, UserError> {
    proxy
        .map(|proxy| Url::parse(&proxy).map_err(invalid_proxy))
        .transpose()
}

#[cfg(test)]
fn reqwest_proxy_from(proxy: Option<String>) -> Result<Option<reqwest::Proxy>, UserError> {
    proxy
        .map(|proxy| reqwest::Proxy::all(&proxy).map_err(|error| invalid_proxy(error.without_url())))
        .transpose()
}

#[cfg(test)]
fn invalid_proxy(error: impl std::fmt::Display) -> UserError {
    UserError::new("net.proxy", "The proxy address is not valid.").detail(error)
}

#[tauri::command]
pub fn updater_configured(app: AppHandle) -> bool {
    if crate::dev_lane::lane().is_some() || super::msix::is_packaged() {
        return false;
    }
    app.config()
        .plugins
        .0
        .get("updater")
        .and_then(|config| config.get("pubkey"))
        .and_then(|value| value.as_str())
        .is_some_and(|key| !key.trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::{proxy_url_from, reqwest_proxy_from};
    use crate::user_error::UserError;
    use serde_json::{json, Value};

    const BROKEN_PROXY: &str = "http://fuyu-user:fuyu-secret-pass@[proxy.example";

    fn assert_hides_the_proxy(error: UserError) {
        assert_eq!(error.code(), "net.proxy");
        let shown = format!("{} {error}", serde_json::to_string(&error).expect("UserError serializes"));
        for part in ["fuyu-secret-pass", "fuyu-user", "proxy.example"] {
            assert!(!shown.contains(part), "{shown}");
        }
    }

    #[test]
    fn a_broken_proxy_is_reported_without_its_address() {
        assert_hides_the_proxy(proxy_url_from(Some(BROKEN_PROXY.into())).expect_err("broken proxy"));
        assert_hides_the_proxy(reqwest_proxy_from(Some(BROKEN_PROXY.into())).expect_err("broken proxy"));
    }

    #[test]
    fn a_working_proxy_is_used_and_no_proxy_means_direct() {
        let proxy = "http://fuyu-user:fuyu-secret-pass@127.0.0.1:7890".to_string();
        let url = proxy_url_from(Some(proxy.clone())).expect("valid proxy").expect("proxy is set");
        assert_eq!(url.password(), Some("fuyu-secret-pass"));
        assert!(reqwest_proxy_from(Some(proxy)).expect("valid proxy").is_some());
        assert!(proxy_url_from(None).expect("no proxy").is_none());
        assert!(reqwest_proxy_from(None).expect("no proxy").is_none());
    }

    fn shipped_updater_config() -> Value {
        let config: Value = serde_json::from_str(include_str!("../../tauri.conf.json"))
            .expect("tauri.conf.json must be valid JSON");
        config
            .pointer("/plugins/updater")
            .cloned()
            .expect("tauri.conf.json must define plugins.updater")
    }

    #[test]
    fn shipped_updater_config_carries_a_minisign_public_key() {
        let parsed: tauri_plugin_updater::Config = serde_json::from_value(shipped_updater_config())
            .expect("plugins.updater must deserialize or the app aborts at startup");

        assert!(parsed.pubkey.starts_with("dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6"));
        assert!(!parsed.endpoints.is_empty());
    }

    #[test]
    fn release_overlay_replaces_the_pubkey_placeholder() {
        let mut update_config = shipped_updater_config();
        update_config["pubkey"] = json!("RWQtest-only-release-public-key");

        let parsed: tauri_plugin_updater::Config = serde_json::from_value(update_config)
            .expect("a release config carrying a real pubkey must deserialize");

        assert_eq!(parsed.pubkey, "RWQtest-only-release-public-key");
        assert!(!parsed.endpoints.is_empty());
    }
}
