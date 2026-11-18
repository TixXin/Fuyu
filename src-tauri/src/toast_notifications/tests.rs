use std::{
    collections::HashSet,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
};

use super::{
    cache::{AppInfoCache, ToastApp},
    router::{
        matches_any, ticks_to_unix_ms, Dispatcher, PollBatch, Subscription, ToastItem,
        ToastMatcher, ToastPoll,
    },
};

fn app(aumid: &str, display_name: &str) -> ToastApp {
    ToastApp {
        aumid: aumid.into(),
        display_name: display_name.into(),
    }
}

fn item(id: u32, aumid: &str, display_name: &str, text: &str) -> ToastItem {
    let ticks = 132_000_000_000_000_000 + id as i64 * 10_000;
    ToastItem {
        id,
        ticks,
        created_at: ticks_to_unix_ms(ticks),
        app: app(aumid, display_name),
        texts: vec![text.into()],
    }
}

#[test]
fn app_info_cache_hits_existing_ids_and_evicts_dismissed_notifications() {
    let mut cache = AppInfoCache::default();
    let calls = AtomicUsize::new(0);

    let first = cache.resolve(101, || {
        calls.fetch_add(1, Ordering::SeqCst);
        Some(app("QQ", "腾讯QQ"))
    });
    assert_eq!(first, Some(app("QQ", "腾讯QQ")));
    assert_eq!(calls.load(Ordering::SeqCst), 1);

    let second = cache.resolve(101, || {
        calls.fetch_add(1, Ordering::SeqCst);
        Some(app("Other", "Other"))
    });
    assert_eq!(second, Some(app("QQ", "腾讯QQ")));
    assert_eq!(calls.load(Ordering::SeqCst), 1);

    let failed = cache.resolve(102, || {
        calls.fetch_add(1, Ordering::SeqCst);
        None
    });
    assert_eq!(failed, None);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    let _ = cache.resolve(102, || {
        calls.fetch_add(1, Ordering::SeqCst);
        Some(app("ShouldNotRun", ""))
    });
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert_eq!(cache.active_len(), 2);

    cache.retain_active(&HashSet::from([101]));
    assert_eq!(cache.active_len(), 1);

    let _ = cache.resolve(102, || {
        calls.fetch_add(1, Ordering::SeqCst);
        Some(app("com.squirrel.Discord.Discord", "Discord"))
    });
    assert_eq!(calls.load(Ordering::SeqCst), 3);
    assert_eq!(
        cache.recent_apps(),
        vec![
            app("com.squirrel.Discord.Discord", "Discord"),
            app("QQ", "腾讯QQ"),
        ]
    );

    cache.clear_active();
    assert_eq!(cache.active_len(), 0);
    assert_eq!(cache.recent_apps().len(), 2);
}

#[test]
fn recent_apps_deduplicates_case_insensitively_and_preserves_display_name() {
    let mut cache = AppInfoCache::default();
    let _ = cache.resolve(1, || Some(app("Telegram.TelegramDesktop", "Telegram")));
    let _ = cache.resolve(2, || Some(app("QQ", "QQ")));
    let _ = cache.resolve(3, || Some(app("telegram.telegramdesktop", "")));

    assert_eq!(
        cache.recent_apps(),
        vec![
            app("telegram.telegramdesktop", "Telegram"),
            app("QQ", "QQ"),
        ]
    );
}

#[test]
fn matchers_cover_exact_portable_prefix_store_prefix_and_display_name() {
    let tg_rules = [
        ToastMatcher::AumidExact("Telegram.TelegramDesktop".into()),
        ToastMatcher::AumidPrefix("Telegram.TelegramDesktop.".into()),
        ToastMatcher::AumidPrefix("TelegramMessengerLLP.TelegramDesktop".into()),
    ];
    assert!(matches_any(
        &tg_rules,
        &app("Telegram.TelegramDesktop", "Telegram")
    ));
    assert!(matches_any(
        &tg_rules,
        &app(
            "Telegram.TelegramDesktop.87a948f82594a71583f25870040c8c33",
            "Telegram"
        )
    ));
    assert!(matches_any(
        &tg_rules,
        &app("TelegramMessengerLLP.TelegramDesktop_t4vj0pshhgkwm!Telegram.TelegramDesktop.Store", "Telegram")
    ));
    assert!(!matches_any(&tg_rules, &app("QQ", "QQ")));

    let feishu_rules = [
        ToastMatcher::AumidContains("Feishu".into()),
        ToastMatcher::DisplayNameExact("飞书".into()),
    ];
    assert!(matches_any(
        &feishu_rules,
        &app("com.squirrel.Feishu.Feishu", "Feishu")
    ));
    assert!(matches_any(&feishu_rules, &app("CustomAppId", "飞书")));
}

#[test]
fn dispatcher_routes_polls_and_foreground_transitions_only_to_enabled_sources() {
    let mut dispatcher = Dispatcher::default();
    let qq_polls = Arc::new(Mutex::new(Vec::new()));
    let tg_polls = Arc::new(Mutex::new(Vec::new()));
    let qq_front = Arc::new(AtomicUsize::new(0));
    let tg_front = Arc::new(AtomicUsize::new(0));

    let qq_sink = qq_polls.clone();
    let qq_fg = qq_front.clone();
    dispatcher.subscribe(Subscription {
        source: "qq",
        matchers: vec![ToastMatcher::AumidExact("QQ".into())],
        executables: vec!["QQ.exe".into()],
        on_poll: Arc::new(move |poll| qq_sink.lock().unwrap().push(poll)),
        on_foreground: Arc::new(move |_| {
            qq_fg.fetch_add(1, Ordering::SeqCst);
        }),
    });

    let tg_sink = tg_polls.clone();
    let tg_fg = tg_front.clone();
    dispatcher.subscribe(Subscription {
        source: "telegram",
        matchers: vec![ToastMatcher::AumidPrefix("Telegram.TelegramDesktop".into())],
        executables: vec!["Telegram.exe".into()],
        on_poll: Arc::new(move |poll| tg_sink.lock().unwrap().push(poll)),
        on_foreground: Arc::new(move |_| {
            tg_fg.fetch_add(1, Ordering::SeqCst);
        }),
    });

    assert!(!dispatcher.any_enabled());
    assert!(!dispatcher.is_enabled("qq"));
    assert_eq!(dispatcher.set_enabled("qq", true), (true, true));
    assert!(dispatcher.is_enabled("qq"));
    assert_eq!(dispatcher.set_enabled("qq", true), (true, false));
    assert_eq!(dispatcher.set_enabled("telegram", true), (true, true));
    assert_eq!(dispatcher.active_matchers().len(), 2);

    let batch = Ok(PollBatch::Allowed(vec![
        item(1, "QQ", "QQ", "hello qq"),
        item(2, "Telegram.TelegramDesktop.abcd", "Telegram", "hello tg"),
        item(3, "Microsoft.Outlook", "Outlook", "ignored"),
    ]));
    for (cb, payload) in dispatcher.dispatch_poll(&batch) {
        cb(payload);
    }
    assert_eq!(
        qq_polls.lock().unwrap().as_slice(),
        &[ToastPoll::Listening(vec![item(1, "QQ", "QQ", "hello qq")])]
    );
    assert_eq!(
        tg_polls.lock().unwrap().as_slice(),
        &[ToastPoll::Listening(vec![item(
            2,
            "Telegram.TelegramDesktop.abcd",
            "Telegram",
            "hello tg"
        )])]
    );

    for (cb, payload) in dispatcher.dispatch_poll(&Ok(PollBatch::PermissionDenied)) {
        cb(payload);
    }
    for (cb, payload) in dispatcher.dispatch_poll(&Ok(PollBatch::PermissionRequired)) {
        cb(payload);
    }
    for (cb, payload) in dispatcher.dispatch_poll(&Err("com failed".into())) {
        cb(payload);
    }
    assert_eq!(
        &qq_polls.lock().unwrap()[1..],
        &[
            ToastPoll::PermissionDenied,
            ToastPoll::PermissionRequired,
            ToastPoll::Error("com failed".into()),
        ]
    );

    for cb in dispatcher.dispatch_foreground(Some("qq.exe")) {
        cb(1000);
    }
    for cb in dispatcher.dispatch_foreground(Some("QQ.exe")) {
        cb(2000);
    }
    assert_eq!(qq_front.load(Ordering::SeqCst), 1);
    assert_eq!(tg_front.load(Ordering::SeqCst), 0);

    for cb in dispatcher.dispatch_foreground(Some("telegram.exe")) {
        cb(3000);
    }
    assert_eq!(tg_front.load(Ordering::SeqCst), 1);

    assert_eq!(dispatcher.set_enabled("qq", false), (true, false));
    for cb in dispatcher.dispatch_foreground(Some("QQ.exe")) {
        cb(4000);
    }
    assert_eq!(qq_front.load(Ordering::SeqCst), 1);

    assert_eq!(dispatcher.set_enabled("telegram", false), (false, false));
    assert!(!dispatcher.any_enabled());
}
