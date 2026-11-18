use super::*;

#[test]
fn parses_quota_summary_buckets_and_plan() {
    let raw = r#"{
        "response": {
            "groups": [
                {
                    "displayName": "Gemini Models",
                    "buckets": [
                        {"bucketId": "gemini-weekly", "window": "weekly", "remainingFraction": 0.82, "resetTime": "2026-11-24T21:34:49Z"},
                        {"bucketId": "gemini-5h", "window": "5h", "remainingFraction": 0.65, "resetTime": "2026-11-18T02:34:49Z"}
                    ]
                },
                {
                    "displayName": "Claude and GPT models",
                    "buckets": [
                        {"bucketId": "3p-weekly", "window": "weekly", "remainingFraction": 0.9, "resetTime": "2026-11-24T21:40:24Z"},
                        {"bucketId": "3p-5h", "window": "5h", "remainingFraction": 0.75, "resetTime": "2026-11-18T02:40:24Z"}
                    ]
                }
            ]
        }
    }"#;
    let parsed = parse_quota_summary(raw).expect("quota summary");
    assert_eq!(parsed.five_hour.as_ref().map(|w| w.used.round()), Some(35.0));
    assert_eq!(parsed.seven_day.as_ref().map(|w| w.used.round()), Some(18.0));
    assert_eq!(
        parsed.models.iter().map(|w| (w.name.as_str(), w.used.round())).collect::<Vec<_>>(),
        vec![("3p5h", 25.0), ("3p7d", 10.0)]
    );

    let status = r#"{"userStatus":{"planStatus":{"planInfo":{"planName":"Pro"}}}}"#;
    assert_eq!(parse_user_plan(status).as_deref(), Some("Pro"));
    assert!(parse_quota_summary(r#"{"unexpected":true}"#).is_none());
    assert!(parse_quota_summary("<html>404</html>").is_none());
}

#[test]
fn parses_cloud_models_and_user_status_fallbacks() {
    let cloud = r#"{
        "models": {
            "gemini-3.5-flash": {"displayName": "Gemini 3.5 Flash", "quotaInfo": {"remainingFraction": 0.8, "resetTime": "2026-11-18T02:34:49Z"}},
            "internal-test": {"displayName": "Gemini Internal", "isInternal": true, "quotaInfo": {"remainingFraction": 0.1}},
            "claude-sonnet": {"displayName": "Claude Sonnet 4.6", "quotaInfo": {"remainingFraction": 0.6, "resetTime": "2026-11-18T02:49:11Z"}}
        }
    }"#;
    let parsed = parse_cloud_models(cloud).expect("cloud models");
    assert_eq!(parsed.five_hour.as_ref().map(|w| w.used.round()), Some(20.0));
    assert_eq!(parsed.models.len(), 1);
    assert_eq!((parsed.models[0].name.as_str(), parsed.models[0].used.round()), ("3p5h", 40.0));

    let status = r#"{"userStatus":{"cascadeModelConfigData":{"clientModelConfigs":[
        {"label":"Gemini 4 Carbon (High)","quotaInfo":{"remainingFraction":0.9,"resetTime":"2026-11-18T02:34:49Z"}}
    ]}}}"#;
    let from_status = parse_user_status(status).expect("user status");
    assert_eq!(from_status.five_hour.as_ref().map(|w| w.used.round()), Some(10.0));
}

#[test]
fn extracts_language_server_flags_and_ports_without_leaking_tokens() {
    let args = vec![
        "/Applications/Antigravity.app/Contents/Resources/bin/language_server".into(),
        "--https_server_port".into(),
        "0".into(),
        "--extension_server_port=51234".into(),
        "--csrf_token".into(),
        "secret_csrf_123".into(),
    ];
    let server = parse_server_args(42, &args, &[62602, 62603]).expect("server");
    assert_eq!(server.pid, 42);
    assert_eq!(server.ports, vec![51234, 62602, 62603]);
    assert_eq!(server.csrf, "secret_csrf_123");

    let other_ls = vec!["/usr/bin/rust_language_server".into(), "--csrf_token=abc".into()];
    assert!(parse_server_args(7, &other_ls, &[9000]).is_none());

    assert_eq!(
        parse_lsof_ports("p69034\nf7\nn127.0.0.1:62602\nn127.0.0.1:62603\nn192.168.1.5:8080\n"),
        vec![62602, 62603]
    );
    let netstat = "\
  TCP    127.0.0.1:62602        0.0.0.0:0              ABHOREN         69034
  TCP    127.0.0.1:62603        0.0.0.0:0              LISTENING       69034
  TCP    127.0.0.1:62603        127.0.0.1:55112        ESTABLISHED     69034
  TCP    127.0.0.1:50000        0.0.0.0:0              LISTENING       11111
";
    assert_eq!(parse_netstat_ports(netstat, 69034), vec![62602, 62603]);
}

#[test]
fn validates_saved_oauth_tokens_and_expiry() {
    let now = parse_timestamp_ms("2026-11-17T20:00:00Z").expect("now");
    let jetski = r#"{"token":{"access_token":"ya29.valid","expiry":"2026-11-17T22:34:03Z"}}"#;
    assert_eq!(parse_token_json(jetski, now).expect("ok").as_deref(), Some("ya29.valid"));

    let expired = r#"{"token":{"access_token":"ya29.old","expiry":"2026-11-17T18:00:00Z"}}"#;
    assert_eq!(parse_token_json(expired, now).expect_err("expired").kind, UsageErrorKind::TokenExpired);

    let oauth_creds = format!(r#"{{"access_token":"ya29.ms","expiry_date":{}}}"#, now + 60_000);
    assert_eq!(parse_token_json(&oauth_creds, now).expect("ok").as_deref(), Some("ya29.ms"));
}
