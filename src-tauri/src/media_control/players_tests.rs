use super::*;

#[test]
fn recognizes_domestic_and_international_music_players() {
    assert_eq!(friendly_app_label("xtMusic.exe"), "飞牛音乐");
    assert_eq!(friendly_app_label("fnmusic.exe"), "飞牛音乐");
    assert_eq!(friendly_app_label("FeiNiuMusic.exe"), "飞牛音乐");
    assert_eq!(friendly_app_label("streammusic.exe"), "音流");
    assert_eq!(friendly_app_label("Feishin.exe"), "Feishin");
    assert_eq!(friendly_app_label("lx-music-desktop.exe"), "LX Music");
    assert_eq!(friendly_app_label("YesPlayMusic.exe"), "YesPlayMusic");
    assert_eq!(friendly_app_label("SodaMusic.exe"), "汽水音乐");
    assert_eq!(friendly_app_label("MusicFree.exe"), "MusicFree");
    assert_eq!(friendly_app_label("Listen1.exe"), "Listen 1");
    assert_eq!(friendly_app_label("foobar2000.exe"), "foobar2000");
    assert_eq!(friendly_app_label("MusicBee.exe"), "MusicBee");
    assert_eq!(friendly_app_label("AIMP.exe"), "AIMP");
    assert_eq!(friendly_app_label("Plexamp.exe"), "Plexamp");
    assert_eq!(friendly_app_label("Roon.exe"), "Roon");
    assert_eq!(friendly_app_label("Cider.exe"), "Cider");
    assert_eq!(friendly_app_label("Spotube.exe"), "Spotube");
}

#[test]
fn matches_standalone_web_and_custom_music_players() {
    let custom = vec![CustomMediaPlayer {
        id: "mybox.exe".to_string(),
        label: "MyBox Music".to_string(),
    }];

    assert_eq!(
        match_music_player(r"C:\Apps\xtMusic.exe", "xtMusic", &custom),
        Some(("xtMusic.exe".to_string(), "飞牛音乐".to_string()))
    );
    assert_eq!(
        match_music_player("foobar2000.exe", "foobar2000", &custom),
        Some(("foobar2000.exe".to_string(), "foobar2000".to_string()))
    );
    assert_eq!(
        match_music_player(
            "msedge.exe",
            "晴天 - 周杰伦 - 飞牛音乐 - Personal - Microsoft Edge",
            &custom
        ),
        Some(("xtmusic.exe".to_string(), "飞牛音乐".to_string()))
    );
    assert_eq!(
        match_music_player("msedge.exe", "GitHub - Microsoft Edge", &custom),
        None
    );
    assert_eq!(
        match_music_player(r"D:\Player\MyBox.exe", "Song - Artist", &custom),
        Some(("MyBox.exe".to_string(), "MyBox Music".to_string()))
    );
}

#[test]
fn parses_song_and_artist_from_player_window_titles() {
    assert_eq!(
        parse_window_track("晴天 - 周杰伦 - 飞牛音乐", "飞牛音乐"),
        Some(("晴天".to_string(), Some("周杰伦".to_string())))
    );
    assert_eq!(
        parse_window_track(
            "晴天 - 周杰伦 - 飞牛音乐 - Personal - Microsoft Edge",
            "飞牛音乐"
        ),
        Some(("晴天".to_string(), Some("周杰伦".to_string())))
    );
    assert_eq!(
        parse_window_track("▶ 夜曲 - 周杰伦 - xtMusic", "飞牛音乐"),
        Some(("夜曲".to_string(), Some("周杰伦".to_string())))
    );
    assert_eq!(
        parse_window_track("飞牛音乐 - 七里香 - 周杰伦", "飞牛音乐"),
        Some(("七里香".to_string(), Some("周杰伦".to_string())))
    );
    assert_eq!(
        parse_window_track("Yesterday - The Beatles [foobar2000 v2.1.5]", "foobar2000"),
        Some(("Yesterday".to_string(), Some("The Beatles".to_string())))
    );
    assert_eq!(parse_window_track("飞牛音乐", "飞牛音乐"), None);
    assert_eq!(parse_window_track("xtMusic", "飞牛音乐"), None);
    assert_eq!(parse_window_track("foobar2000 v2.1.5", "foobar2000"), None);
}

#[test]
fn splits_combined_metadata_titles_when_artist_is_missing() {
    assert_eq!(
        normalize_metadata_track(
            Some("稻香 - 周杰伦 - 飞牛音乐".to_string()),
            None,
            Some("xtMusic.exe")
        ),
        (Some("稻香".to_string()), Some("周杰伦".to_string()))
    );
    assert_eq!(
        normalize_metadata_track(
            Some("稻香 - 飞牛音乐".to_string()),
            Some("周杰伦".to_string()),
            Some("xtMusic.exe")
        ),
        (Some("稻香".to_string()), Some("周杰伦".to_string()))
    );
}
