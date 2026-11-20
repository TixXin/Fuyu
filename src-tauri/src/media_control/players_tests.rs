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
    assert_eq!(friendly_app_label("tongzhong.exe"), "铜钟");
    assert_eq!(friendly_app_label("HiByMusic.exe"), "HiBy Music");
    assert_eq!(friendly_app_label("foobar2000.exe"), "foobar2000");
    assert_eq!(friendly_app_label("MusicBee.exe"), "MusicBee");
    assert_eq!(friendly_app_label("AIMP.exe"), "AIMP");
    assert_eq!(friendly_app_label("Plexamp.exe"), "Plexamp");
    assert_eq!(friendly_app_label("Roon.exe"), "Roon");
    assert_eq!(friendly_app_label("Cider.exe"), "Cider");
    assert_eq!(friendly_app_label("Spotube.exe"), "Spotube");
    assert_eq!(friendly_app_label("Swinsian"), "Swinsian");
    assert_eq!(friendly_app_label("com.coppertino.VOX"), "VOX");
    assert_eq!(friendly_app_label("org.cogx.cog"), "Cog");
    assert_eq!(friendly_app_label("com.colliderli.iina"), "IINA");
}

#[test]
fn names_the_mainstream_platforms_from_their_windows_and_mac_identifiers() {
    let cases = [
        ("cloudmusic.exe", "NetEase Music"),
        ("com.netease.163music", "NetEase Music"),
        ("QQMusic.exe", "QQ Music"),
        ("com.tencent.QQMusicMac", "QQ Music"),
        ("KuGou.exe", "KuGou"),
        ("com.kugou.mac.Music", "KuGou"),
        ("kwmusic.exe", "Kuwo"),
        ("SodaMusic.exe", "汽水音乐"),
        ("com.soda.music", "汽水音乐"),
        ("汽水音乐", "汽水音乐"),
        ("MiguMusic.exe", "咪咕音乐"),
        ("Spotify.exe", "Spotify"),
        ("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify", "Spotify"),
        ("com.spotify.client", "Spotify"),
        ("AppleInc.AppleMusicWin_nzyj5cx40ttqa!App", "Apple Music"),
        ("com.apple.Music", "Apple Music"),
        ("iTunes.exe", "iTunes"),
        ("AppleInc.iTunes_nzyj5cx40ttqa!iTunes", "iTunes"),
        ("YouTube Music.exe", "YouTube Music"),
        ("com.github.th-ch.youtube-music", "YouTube Music"),
        ("YouTube Music Desktop App.exe", "YouTube Music"),
        ("app.ytmd", "YouTube Music"),
        ("Amazon Music.exe", "Amazon Music"),
        ("com.amazon.music", "Amazon Music"),
        ("TIDAL.exe", "TIDAL"),
        ("com.tidal.desktop", "TIDAL"),
        ("Deezer.exe", "Deezer"),
        ("com.deezer.deezer-desktop", "Deezer"),
        ("Qobuz.exe", "Qobuz"),
        ("com.qobuz.QobuzDesktop", "Qobuz"),
    ];
    for (id, name) in cases {
        assert_eq!(friendly_app_label_with_custom(id, &[]), name, "{id}");
    }
}

#[test]
fn names_local_players_and_third_party_clients_from_their_identifiers() {
    let cases = [
        ("foobar2000.exe", "foobar2000"),
        ("com.foobar2000.mac", "foobar2000"),
        ("MusicBee.exe", "MusicBee"),
        ("AIMP.exe", "AIMP"),
        ("vlc.exe", "VLC"),
        ("org.videolan.vlc", "VLC"),
        ("com.colliderli.iina", "IINA"),
        ("PotPlayerMini64.exe", "PotPlayer"),
        ("wmplayer.exe", "Windows Media Player"),
        ("com.swinsian.Swinsian", "Swinsian"),
        ("lx-music-desktop.exe", "LX Music"),
        ("cn.toside.music.desktop", "LX Music"),
        ("YesPlayMusic.exe", "YesPlayMusic"),
        ("com.electron.yesplaymusic", "YesPlayMusic"),
        ("com.listen1.listen1", "Listen 1"),
        ("tv.plex.plexamp", "Plexamp"),
        ("com.roon.Roon", "Roon"),
        ("com.audirvana.Audirvana", "Audirvana"),
        ("com.coppertino.Vox", "VOX"),
        ("org.clementine-player.clementine", "Clementine"),
        ("com.deadbeef.deadbeef", "DeaDBeeF"),
        ("Feishin.exe", "Feishin"),
        ("Cider.exe", "Cider"),
        ("MusicFree.exe", "MusicFree"),
    ];
    for (id, name) in cases {
        assert_eq!(friendly_app_label_with_custom(id, &[]), name, "{id}");
    }
}

#[test]
fn a_web_player_keeps_its_first_word_as_the_id() {
    for player in KNOWN_PLAYERS.iter().filter(|player| player.label == "YouTube Music" || player.label == "汽水音乐" || player.label == "Amazon Music") {
        assert!(!player.needles[0].contains(['.', ' ']), "{}", player.label);
    }
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
        parse_window_track(
            "01. The Beatles - Yesterday [foobar2000 v2.1.5]",
            "foobar2000"
        ),
        Some(("Yesterday".to_string(), Some("The Beatles".to_string())))
    );
    assert_eq!(
        parse_window_track("2. 周杰伦 - 晴天 - AIMP", "AIMP"),
        Some(("晴天".to_string(), Some("周杰伦".to_string())))
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

#[test]
fn strips_album_from_apple_music_artist() {
    let apple = Some("AppleInc.AppleMusicWin_nzyj5cx40ttqa!App");
    let song = || Some("渡".to_string());
    assert_eq!(
        normalize_metadata_track(song(), Some("薛之谦 — 渡 The Crossing".to_string()), apple),
        (song(), Some("薛之谦".to_string()))
    );
    assert_eq!(
        normalize_metadata_track(song(), Some("Taylor Swift – 1989 (Taylor's Version)".to_string()), apple),
        (song(), Some("Taylor Swift".to_string()))
    );
    assert_eq!(
        normalize_metadata_track(song(), Some("AC - DC".to_string()), apple),
        (song(), Some("AC - DC".to_string()))
    );
    assert_eq!(
        normalize_metadata_track(song(), Some("Jay—Z".to_string()), apple),
        (song(), Some("Jay—Z".to_string()))
    );
    assert_eq!(
        normalize_metadata_track(song(), Some(" — 渡".to_string()), apple),
        (song(), Some(" — 渡".to_string()))
    );
    assert_eq!(
        normalize_metadata_track(song(), Some("薛之谦 — 渡 The Crossing".to_string()), Some("cloudmusic.exe")),
        (song(), Some("薛之谦 — 渡 The Crossing".to_string()))
    );
}
