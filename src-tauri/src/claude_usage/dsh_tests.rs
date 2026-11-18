use super::*;
use crate::claude_usage::dsh_credentials::{config_uses_default_endpoints, parse_credentials_yaml};

#[test]
fn parses_api_and_account_wallets_with_exact_decimals() {
    let api = r#"{"is_available":true,"balance_infos":[{"currency":"CNY","total_balance":"63.88","granted_balance":"0.00","topped_up_balance":"63.88"}]}"#;
    let parsed = parse_api_balance(api, 1234).expect("api balance");
    assert_eq!(parsed.source.as_deref(), Some("dshApi"));
    assert_eq!(parsed.available, Some(true));
    assert_eq!(
        parsed.wallets,
        vec![DshWallet {
            currency: "CNY".into(),
            total: "63.88".into(),
            topped_up: "63.88".into(),
            granted: "0.00".into(),
        }]
    );

    let account = r#"{
        "code": 0,
        "data": {
            "biz_code": 0,
            "biz_data": {
                "normal_wallets": [{"currency": "CNY", "balance": "10.10"}],
                "bonus_wallets": [{"currency": "CNY", "balance": "0.20"}]
            }
        }
    }"#;
    let acct = parse_account_summary(account, 5678).expect("account summary");
    assert_eq!(acct.source.as_deref(), Some("dshAccount"));
    assert_eq!(acct.wallets[0].total, "10.30");
    assert_eq!(acct.available, Some(true));

    let revoked = r#"{"code":40003,"data":{"biz_code":40003}}"#;
    assert_eq!(parse_account_summary(revoked, 1).expect_err("revoked").kind, UsageErrorKind::LoginRequired);
}

#[test]
fn parses_credentials_yaml_and_rejects_custom_gateways() {
    let yaml = "\u{feff}version: 1\nrecords:\n  - ignored-list-item\n  deepseek-account-platform/default:\n    kind: grant\n    payload:\n      version: 1\n      token: tok_abc123\n      issuer: https://platform.deepseek.com\nrefs:\n  DEEPSEEK_API_KEY: \"sk-test-999\"\n";
    assert!(matches!(parse_credentials_yaml(yaml, "deepseek-official"), Some(DshCredential::ApiKey(k)) if k == "sk-test-999"));
    assert!(matches!(parse_credentials_yaml(yaml, "deepseek-account"), Some(DshCredential::AccountToken(t)) if t == "tok_abc123"));
    assert!(parse_credentials_yaml(yaml, "custom-openai").is_none());

    assert!(config_uses_default_endpoints("baseURL: https://api.deepseek.com/\napiKeyEnv: DEEPSEEK_API_KEY\n"));
    assert!(!config_uses_default_endpoints("baseURL: https://my-proxy.example.com\n"));
    assert!(!config_uses_default_endpoints("apiKeyEnv: OTHER_KEY\n"));
    assert!(!config_uses_default_endpoints("platformOrigin: https://evil.example.com\n"));
}

#[test]
fn locates_newest_store_and_distinguishes_missing_and_custom_routes() {
    let temp = std::env::temp_dir().join(format!("fuyu-dsh-usage-{}", std::process::id()));
    let _ = fs::remove_dir_all(&temp);
    assert_eq!(locate_credential(&[temp.join("none")]).err().map(|e| e.kind), Some(UsageErrorKind::NoSessions));

    let root = temp.join(".dsh");
    let sessions = root.join("storages").join("session_projcache").join("sessions");
    fs::create_dir_all(&sessions).unwrap();
    let cp = serde_json::json!({
        "version": 7,
        "record": {
            "rows": {
                "sessionListMetadata": { "ver": 1, "val": { "blank": false } },
                "modelSelection": { "ver": 3, "val": { "lastUsed": { "provider": "openrouter" } } }
            }
        }
    });
    fs::write(sessions.join("s1.json"), cp.to_string()).unwrap();
    assert_eq!(
        locate_credential(std::slice::from_ref(&root)).err().map(|e| e.kind),
        Some(UsageErrorKind::CustomEndpoint)
    );

    let official_cp = serde_json::json!({
        "version": 7,
        "record": {
            "rows": {
                "sessionListMetadata": { "ver": 1, "val": { "blank": false } },
                "modelSelection": { "ver": 3, "val": { "lastUsed": { "provider": "deepseek-official" } } }
            }
        }
    });
    fs::write(sessions.join("s1.json"), official_cp.to_string()).unwrap();
    assert_eq!(
        locate_credential(std::slice::from_ref(&root)).err().map(|e| e.kind),
        Some(UsageErrorKind::NoCredentials)
    );

    fs::write(root.join(".credentials.yaml"), "version: 1\nrefs:\n  DEEPSEEK_API_KEY: sk-unit-1\n").unwrap();
    assert!(locate_credential(std::slice::from_ref(&root)).is_ok());

    fs::write(root.join("cordis.patch.yml"), "baseURL: https://custom.gateway.local\n").unwrap();
    assert_eq!(
        locate_credential(std::slice::from_ref(&root)).err().map(|e| e.kind),
        Some(UsageErrorKind::CustomEndpoint)
    );
    let _ = fs::remove_dir_all(&temp);
}
