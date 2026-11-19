use std::{fs, io::Read, path::PathBuf};

use serde_json::Value;

use super::plan::PlanProvider;

const MAX_SETTINGS_BYTES: u64 = 1024 * 1024;
const ZAI_QUOTA_URL: &str = "https://api.z.ai/api/monitor/usage/quota/limit";

#[derive(Debug, PartialEq, Eq)]
pub(super) struct ConfigKey {
    pub(super) key: String,
    pub(super) url: Option<&'static str>,
}

fn host_is(host: &str, domain: &str) -> bool {
    host == domain || host.ends_with(&format!(".{domain}"))
}

fn route(provider: PlanProvider, base_url: &str) -> Option<Option<&'static str>> {
    let url = reqwest::Url::parse(base_url).ok()?;
    if url.scheme() != "https" {
        return None;
    }
    let host = url.host_str()?.to_ascii_lowercase();
    match provider {
        PlanProvider::Glm if host_is(&host, "bigmodel.cn") => Some(None),
        PlanProvider::Glm if host_is(&host, "z.ai") => Some(Some(ZAI_QUOTA_URL)),
        PlanProvider::Kimi if host_is(&host, "kimi.com") || host_is(&host, "moonshot.cn") => Some(None),
        _ => None,
    }
}

fn pick(provider: PlanProvider, read: &dyn Fn(&str) -> Option<String>) -> Option<ConfigKey> {
    let url = route(provider, &read("ANTHROPIC_BASE_URL")?)?;
    let key = read("ANTHROPIC_AUTH_TOKEN").or_else(|| read("ANTHROPIC_API_KEY"))?;
    (!key.chars().any(char::is_whitespace) && key.len() <= 512).then_some(ConfigKey { key, url })
}

pub(super) fn find_in(provider: PlanProvider, settings: Option<&Value>, process_env: &dyn Fn(&str) -> Option<String>) -> Option<ConfigKey> {
    let clean = |value: Option<String>| value.map(|value| value.trim().to_string()).filter(|value| !value.is_empty());
    let from_settings = |key: &str| clean(settings.and_then(|settings| settings["env"][key].as_str()).map(str::to_string));
    let from_env = |key: &str| clean(process_env(key));
    pick(provider, &from_settings).or_else(|| pick(provider, &from_env))
}

fn claude_dir() -> Option<PathBuf> {
    let non_empty = |key: &str| std::env::var_os(key).filter(|value| !value.is_empty());
    non_empty("CLAUDE_CONFIG_DIR")
        .map(PathBuf::from)
        .filter(|dir| dir.is_absolute())
        .or_else(|| non_empty("USERPROFILE").or_else(|| non_empty("HOME")).map(|home| PathBuf::from(home).join(".claude")))
}

fn read_settings() -> Option<Value> {
    let mut text = String::new();
    fs::File::open(claude_dir()?.join("settings.json")).ok()?.take(MAX_SETTINGS_BYTES).read_to_string(&mut text).ok()?;
    serde_json::from_str(&text).ok()
}

pub(super) fn find(provider: PlanProvider) -> Option<ConfigKey> {
    find_in(provider, read_settings().as_ref(), &|key| std::env::var(key).ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn settings(base: &str, token: &str) -> Value {
        json!({ "env": { "ANTHROPIC_BASE_URL": base, "ANTHROPIC_AUTH_TOKEN": token } })
    }

    fn no_env(_: &str) -> Option<String> {
        None
    }

    #[test]
    fn bigmodel_zai_and_kimi_addresses_hand_their_token_to_the_matching_ring() {
        let bigmodel = settings("https://open.bigmodel.cn/api/anthropic", "id.secret");
        assert_eq!(find_in(PlanProvider::Glm, Some(&bigmodel), &no_env), Some(ConfigKey { key: "id.secret".into(), url: None }));
        assert_eq!(find_in(PlanProvider::Kimi, Some(&bigmodel), &no_env), None);

        let zai = settings("https://api.z.ai/api/anthropic", "zai-key");
        assert_eq!(find_in(PlanProvider::Glm, Some(&zai), &no_env), Some(ConfigKey { key: "zai-key".into(), url: Some(ZAI_QUOTA_URL) }));

        for base in ["https://api.kimi.com/coding/", "https://api.moonshot.cn/anthropic"] {
            let kimi = settings(base, "sk-kimi");
            assert_eq!(find_in(PlanProvider::Kimi, Some(&kimi), &no_env), Some(ConfigKey { key: "sk-kimi".into(), url: None }));
            assert_eq!(find_in(PlanProvider::Glm, Some(&kimi), &no_env), None);
        }
    }

    #[test]
    fn api_key_is_the_fallback_and_lookalike_hosts_are_ignored() {
        let api_key = json!({ "env": { "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic", "ANTHROPIC_API_KEY": " k " } });
        assert_eq!(find_in(PlanProvider::Glm, Some(&api_key), &no_env).map(|found| found.key), Some("k".into()));
        for base in ["https://bigmodel.cn.evil.com/", "http://open.bigmodel.cn/", "https://notkimi.com/", "not a url"] {
            let lookalike = settings(base, "t");
            assert_eq!(find_in(PlanProvider::Glm, Some(&lookalike), &no_env), None, "{base}");
            assert_eq!(find_in(PlanProvider::Kimi, Some(&lookalike), &no_env), None, "{base}");
        }
    }

    #[test]
    fn nothing_configured_finds_nothing_and_process_env_is_the_last_resort() {
        assert_eq!(find_in(PlanProvider::Glm, None, &no_env), None);
        assert_eq!(find_in(PlanProvider::Glm, Some(&json!({})), &no_env), None);
        assert_eq!(find_in(PlanProvider::Glm, Some(&settings("https://open.bigmodel.cn/api/anthropic", "")), &no_env), None);
        let env = |key: &str| match key {
            "ANTHROPIC_BASE_URL" => Some("https://api.kimi.com/coding/".to_string()),
            "ANTHROPIC_AUTH_TOKEN" => Some("sk-env".to_string()),
            _ => None,
        };
        assert_eq!(find_in(PlanProvider::Kimi, Some(&json!({ "env": {} })), &env).map(|found| found.key), Some("sk-env".into()));
        let anthropic = settings("https://api.anthropic.com", "sk-ant");
        assert_eq!(find_in(PlanProvider::Kimi, Some(&anthropic), &env).map(|found| found.key), Some("sk-env".into()));
    }
}
