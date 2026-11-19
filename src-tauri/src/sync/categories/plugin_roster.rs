use serde_json::{Map, Value};

pub(crate) const KEY: &str = "fuyu-market-plugins";
const MAX_CONFIG_BYTES: usize = 16 * 1024;
const TOO_LARGE: &str = "tooLarge";

pub(crate) fn syncable(item: &Value) -> Value {
    let Some(raw) = item.as_object() else {
        return item.clone();
    };
    let manual = raw.get("source").and_then(Value::as_str) == Some("manual");
    let mut next = Map::new();
    if let Some(id) = raw.get("id") {
        next.insert("id".into(), id.clone());
    }
    next.insert("source".into(), Value::String(if manual { "manual" } else { "market" }.into()));
    next.insert("enabled".into(), Value::Bool(raw.get("enabled").and_then(Value::as_bool) != Some(false)));
    if manual {
        return Value::Object(next);
    }
    let mut too_large = raw.get("configOmitted").and_then(Value::as_str) == Some(TOO_LARGE);
    if let Some(config) = raw.get("config").filter(|config| config.is_object()) {
        let mut config = config.clone();
        super::settings::scrub(&mut config);
        if config.to_string().len() > MAX_CONFIG_BYTES {
            too_large = true;
        } else if config.as_object().is_some_and(|fields| !fields.is_empty()) {
            too_large = false;
            next.insert("config".into(), config);
        }
    }
    if too_large {
        next.insert("configOmitted".into(), Value::String(TOO_LARGE.into()));
    }
    Value::Object(next)
}

#[cfg(test)]
mod tests {
    use serde_json::{json, Map, Value};

    use super::{syncable, KEY, MAX_CONFIG_BYTES};
    use crate::sync::{
        categories::settings::{apply, to_doc, Local, Part},
        settings_meta::{whitelist, Mode, Rule, SettingsMeta, Whitelist},
    };

    fn roster_only() -> Whitelist {
        Whitelist::parse(&json!({ "keys": { KEY: "byId" } }).to_string()).expect("whitelist")
    }

    fn local(roster: Value) -> Local {
        let mut keys = Map::new();
        keys.insert(KEY.into(), Value::String(roster.to_string()));
        Local { keys, meta: SettingsMeta::default() }
    }

    fn roster(local: &Local) -> Value {
        serde_json::from_str(local.keys[KEY].as_str().expect("roster")).expect("json")
    }

    #[test]
    fn the_roster_syncs_item_by_item() {
        assert!(matches!(whitelist().keys.get(KEY), Some(Rule::Whole(Mode::ById))));
    }

    #[test]
    fn secrets_and_unknown_fields_never_leave_the_device() {
        let item = json!({
            "id": "@fuyu/weather",
            "source": "market",
            "enabled": false,
            "version": "1.2.0",
            "config": { "city": "Hangzhou", "apiKey": "k", "nested": { "access_token": "t", "units": "celsius" } }
        });
        assert_eq!(
            syncable(&item),
            json!({ "id": "@fuyu/weather", "source": "market", "enabled": false, "config": { "city": "Hangzhou", "nested": { "units": "celsius" } } })
        );
    }

    #[test]
    fn a_plugin_installed_from_a_file_carries_only_its_name() {
        let item = json!({ "id": "@me/gadget", "source": "manual", "enabled": true, "config": { "city": "x" } });
        assert_eq!(syncable(&item), json!({ "id": "@me/gadget", "source": "manual", "enabled": true }));
    }

    #[test]
    fn settings_over_the_limit_stay_behind_and_say_so() {
        let item = json!({ "id": "@fuyu/weather", "enabled": true, "config": { "blob": "a".repeat(MAX_CONFIG_BYTES) } });
        assert_eq!(syncable(&item), json!({ "id": "@fuyu/weather", "source": "market", "enabled": true, "configOmitted": "tooLarge" }));
    }

    #[test]
    fn the_roster_reaches_a_device_that_has_none_and_is_scrubbed_on_the_way() {
        let list = roster_only();
        let here = local(json!([
            { "id": "@fuyu/weather", "source": "market", "enabled": true, "config": { "city": "Hangzhou", "password": "p" } },
            { "id": "@me/gadget", "source": "manual", "enabled": false }
        ]));
        let doc = to_doc(&list, &here, Part::Settings, "a", &[]);
        assert_eq!(doc.entries["item:fuyu-market-plugins:@fuyu/weather"].value["config"], json!({ "city": "Hangzhou" }));

        let mut doc = doc;
        let hostile = doc.entries.get_mut("item:fuyu-market-plugins:@fuyu/weather").expect("item");
        hostile.value["config"]["token"] = json!("t");
        let there = apply(&list, &local(json!([])), &doc, Part::Settings, &[]);
        assert_eq!(
            roster(&there),
            json!([
                { "id": "@fuyu/weather", "source": "market", "enabled": true, "config": { "city": "Hangzhou" } },
                { "id": "@me/gadget", "source": "manual", "enabled": false }
            ])
        );
    }
}
