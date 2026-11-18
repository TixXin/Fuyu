use super::{
    specs::{find_index, find_spec, match_source, MatchRule, SOURCES},
    state::{
        parse_badge_unread, BadgeReading, ImNotificationKind, ImSourceStatus, SourceState,
        FLASH_TOAST_WINDOW_MS,
    },
};
use crate::{
    messages_plugin,
    toast_notifications::{ToastApp, ToastItem, ToastMatcher, ToastPoll},
};

fn rule_to_toast_matcher(rule: &MatchRule) -> ToastMatcher {
    match rule {
        MatchRule::AumidExact(v) => ToastMatcher::AumidExact((*v).into()),
        MatchRule::AumidPrefix(v) => ToastMatcher::AumidPrefix((*v).into()),
        MatchRule::AumidContains(v) => ToastMatcher::AumidContains((*v).into()),
        MatchRule::DisplayNameExact(v) => ToastMatcher::DisplayNameExact((*v).into()),
    }
}

fn toast_item(id: u32, created_at: i64, aumid: &str, display_name: &str, texts: &[&str]) -> ToastItem {
    ToastItem {
        id,
        ticks: (created_at + 11_644_473_600_000) * 10_000,
        created_at,
        app: ToastApp {
            aumid: aumid.into(),
            display_name: display_name.into(),
        },
        texts: texts.iter().map(|line| (*line).to_string()).collect(),
    }
}

#[test]
fn seven_sources_align_with_messages_plugin_and_bundle_specs() {
    let ids: Vec<&str> = SOURCES.iter().map(|spec| spec.id).collect();
    assert_eq!(
        ids,
        vec![
            messages_plugin::TELEGRAM,
            messages_plugin::DISCORD,
            messages_plugin::WHATSAPP,
            messages_plugin::TIM,
            messages_plugin::FEISHU,
            messages_plugin::DINGTALK,
            messages_plugin::WECOM,
        ]
    );
    for (idx, spec) in SOURCES.iter().enumerate() {
        assert_eq!(find_index(spec.id), Some(idx));
        assert_eq!(find_spec(spec.id).map(|found| found.id), Some(spec.id));
        assert!(!spec.executables.is_empty());
        assert!(!spec.macos_bundle_ids.is_empty());
    }
    assert_eq!(find_index("unknown"), None);

    let wecom = find_spec("wecom").unwrap();
    assert_eq!(wecom.executables, &["WXWork.exe"]);
    assert!(!wecom.matches_executable("Weixin.exe"));
    assert!(!wecom.matches_executable("WeChat.exe"));

    let tim = find_spec("tim").unwrap();
    assert!(tim.protocols.is_empty());
    assert_eq!(tim.macos_bundle_ids, &["com.tencent.tim"]);
}

#[test]
fn multi_channel_aumids_and_display_names_match_expected_sources_only() {
    let cases = [
        ("Telegram.TelegramDesktop", "", Some("telegram")),
        ("Telegram.TelegramDesktop.Store", "", Some("telegram")),
        (
            "Telegram.TelegramDesktop.9f8e7d6c5b4a39281726354455667788",
            "",
            Some("telegram"),
        ),
        (
            "TelegramMessengerLLP.TelegramDesktop_t4vj0pshhgkwm!Telegram.TelegramDesktop.Store",
            "",
            Some("telegram"),
        ),
        ("Custom.Shortcut", "Telegram Desktop", Some("telegram")),
        ("com.squirrel.Discord.Discord", "Discord", Some("discord")),
        ("com.squirrel.DiscordPTB.DiscordPTB", "", Some("discord")),
        ("com.squirrel.DiscordCanary.DiscordCanary", "", Some("discord")),
        ("DiscordInc.Discord_abc123!App", "", Some("discord")),
        (
            "5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App",
            "WhatsApp",
            Some("whatsapp"),
        ),
        ("SomeAumid", "WhatsApp Desktop", Some("whatsapp")),
        ("Tencent.TIM", "TIM", Some("tim")),
        ("TIM", "", Some("tim")),
        ("com.squirrel.Feishu.Feishu", "飞书", Some("feishu")),
        ("ByteDance.Lark", "", Some("feishu")),
        (r"C:\Users\demo\AppData\Local\Lark\Lark.exe", "", Some("feishu")),
        ("Unknown.App", "飞书", Some("feishu")),
        ("com.alibaba.DingTalk", "钉钉", Some("dingtalk")),
        ("Unknown.App", "DingTalk", Some("dingtalk")),
        ("Tencent.WXWork", "", Some("wecom")),
        ("com.tencent.WeChatWork", "", Some("wecom")),
        ("Unknown.App", "企业微信", Some("wecom")),
        ("Unknown.App", "WeCom", Some("wecom")),
        ("Tencent.WeChat", "微信", None),
        ("Weixin", "WeChat", None),
        ("QQ", "QQ", None),
        ("Microsoft.Windows.Runtime", "System Time", None),
        ("com.example.clark", "Clark", None),
    ];

    for (aumid, display_name, expected) in cases {
        assert_eq!(
            match_source(aumid, display_name),
            expected,
            "unexpected match for ({aumid}, {display_name})"
        );
        let app = ToastApp {
            aumid: aumid.into(),
            display_name: display_name.into(),
        };
        for spec in &SOURCES {
            let via_spec = spec.matches_toast(aumid, display_name);
            let via_toast = spec
                .toast_rules
                .iter()
                .map(rule_to_toast_matcher)
                .any(|matcher| matcher.matches(&app));
            assert_eq!(via_spec, via_toast, "matcher parity for {}", spec.id);
        }
    }
}

#[test]
fn flash_then_toast_within_two_seconds_replaces_empty_flash_reminder() {
    let spec = find_spec("telegram").unwrap();
    let mut state = SourceState::new(spec);
    assert!(state.set_enabled(true).changed);

    let baseline = state.apply_toast_poll(
        ToastPoll::Listening(vec![toast_item(
            1,
            5_000,
            "Telegram.TelegramDesktop",
            "Telegram",
            &["Old", "Ignored"],
        )]),
        9_000,
    );
    assert!(baseline.changed);
    assert!(state.snapshot.items.is_empty());
    assert_eq!(state.snapshot.status, ImSourceStatus::Listening);

    let flash = state.apply_flash(10_000);
    assert!(flash.changed);
    assert_eq!(flash.newest_id.as_deref(), Some("telegram:flash:10000"));
    assert_eq!(flash.replaced_id, None);
    assert_eq!(state.snapshot.items.len(), 1);
    assert_eq!(state.snapshot.items[0].kind, ImNotificationKind::Flash);
    assert_eq!(state.snapshot.items[0].body, "");

    let merged = state.apply_toast_poll(
        ToastPoll::Listening(vec![
            toast_item(1, 5_000, "Telegram.TelegramDesktop", "Telegram", &["Old", "Ignored"]),
            toast_item(
                2,
                10_300,
                "Telegram.TelegramDesktop.abcdef0123456789abcdef0123456789",
                "Telegram",
                &["Alice", "Lunch at 12?"],
            ),
        ]),
        10_000 + FLASH_TOAST_WINDOW_MS - 200,
    );
    assert!(merged.changed);
    assert_eq!(merged.replaced_id.as_deref(), Some("telegram:flash:10000"));
    assert!(merged.newest_id.as_deref().unwrap().starts_with("telegram:toast:2:"));
    assert_eq!(state.snapshot.items.len(), 1);
    assert_eq!(state.snapshot.items[0].kind, ImNotificationKind::Toast);
    assert_eq!(state.snapshot.items[0].title, "Alice");
    assert_eq!(state.snapshot.items[0].body, "Lunch at 12?");
}

#[test]
fn toast_then_flash_within_two_seconds_suppresses_duplicate_flash() {
    let spec = find_spec("whatsapp").unwrap();
    let mut state = SourceState::new(spec);
    state.set_enabled(true);
    state.apply_toast_poll(ToastPoll::Listening(vec![]), 1_000);

    let arrived = state.apply_toast_poll(
        ToastPoll::Listening(vec![toast_item(
            10,
            10_000,
            "5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App",
            "WhatsApp",
            &["Bob", "Ping"],
        )]),
        10_100,
    );
    assert!(arrived.changed);
    assert_eq!(
        state.last_packaged_aumid.as_deref(),
        Some("5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App")
    );

    let suppressed = state.apply_flash(11_900);
    assert!(!suppressed.changed);
    assert_eq!(state.snapshot.items.len(), 1);
    assert_eq!(state.snapshot.items[0].kind, ImNotificationKind::Toast);

    let later_flash = state.apply_flash(15_000);
    assert!(later_flash.changed);
    assert_eq!(state.snapshot.items.len(), 2);
    assert_eq!(state.snapshot.items[0].kind, ImNotificationKind::Flash);
}

#[test]
fn repeated_flashes_debounce_and_permission_required_preserves_flash_items() {
    let spec = find_spec("tim").unwrap();
    let mut state = SourceState::new(spec);
    state.set_enabled(true);

    let first = state.apply_flash(2_000);
    assert!(first.changed);
    assert_eq!(state.snapshot.items.len(), 1);

    assert!(!state.apply_flash(2_500).changed);
    assert!(!state.apply_flash(8_000).changed);
    assert_eq!(state.snapshot.items.len(), 1);

    let perm = state.apply_toast_poll(ToastPoll::PermissionRequired, 9_000);
    assert!(perm.changed);
    assert_eq!(state.snapshot.status, ImSourceStatus::PermissionRequired);
    assert_eq!(state.snapshot.items.len(), 1);

    assert!(state.clear());
    assert!(state.snapshot.items.is_empty());
    let after_clear = state.apply_flash(12_000);
    assert!(after_clear.changed);
    assert_eq!(state.snapshot.items.len(), 1);
}

#[test]
fn auto_clear_filters_items_by_foreground_timestamp() {
    let spec = find_spec("feishu").unwrap();
    let mut state = SourceState::new(spec);
    state.set_enabled(true);
    state.apply_toast_poll(ToastPoll::Listening(vec![]), 1_000);
    state.apply_toast_poll(
        ToastPoll::Listening(vec![
            toast_item(1, 2_000, "ByteDance.Feishu", "飞书", &["Team", "First"]),
            toast_item(2, 4_000, "ByteDance.Feishu", "飞书", &["Team", "Second"]),
        ]),
        4_100,
    );
    assert_eq!(state.snapshot.items.len(), 2);

    assert!(!state.apply_foreground(5_000).changed);
    assert_eq!(state.snapshot.items.len(), 2);

    state.auto_clear = true;
    let partial = state.apply_foreground(3_000);
    assert!(partial.changed);
    assert_eq!(state.snapshot.items.len(), 1);
    assert_eq!(state.snapshot.items[0].body, "Second");

    let all = state.apply_foreground(4_000);
    assert!(all.changed);
    assert!(state.snapshot.items.is_empty());
}

#[test]
fn macos_badge_transitions_track_rising_unread_and_auto_clear() {
    assert_eq!(parse_badge_unread("12"), 12);
    assert_eq!(parse_badge_unread("99+"), 99);
    assert_eq!(parse_badge_unread("•"), 1);

    let spec = find_spec("discord").unwrap();
    let mut state = SourceState::new(spec);
    state.set_enabled(true);
    state.auto_clear = true;

    let first = state.apply_badge(BadgeReading::Label(Some("2".into())), 1_000);
    assert!(first.changed);
    assert_eq!(first.newest_id.as_deref(), Some("discord:badge:1000"));
    assert_eq!(state.snapshot.items[0].kind, ImNotificationKind::Badge);
    assert_eq!(state.snapshot.items[0].unread, Some(2));

    assert!(!state.apply_badge(BadgeReading::Label(Some("2".into())), 1_500).changed);
    assert!(!state.apply_badge(BadgeReading::Label(Some("1".into())), 2_000).changed);

    let second = state.apply_badge(BadgeReading::Label(Some("4".into())), 3_000);
    assert!(second.changed);
    assert_eq!(state.snapshot.items.len(), 2);

    assert!(!state.apply_badge(BadgeReading::NotInDock, 3_500).changed);
    assert_eq!(state.snapshot.items.len(), 2);

    let cleared = state.apply_badge(BadgeReading::Label(None), 2_500);
    assert!(cleared.changed);
    assert_eq!(state.snapshot.items.len(), 1);
    assert_eq!(state.snapshot.items[0].created_at, 3_000);

    let denied = state.apply_badge(BadgeReading::NotAllowed, 4_000);
    assert!(denied.changed);
    assert_eq!(state.snapshot.status, ImSourceStatus::PermissionRequired);
}
