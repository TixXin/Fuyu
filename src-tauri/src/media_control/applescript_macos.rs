use std::{process::Command, sync::Mutex, time::Duration, time::Instant};

const READ_EVERY: Duration = Duration::from_millis(900);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Player {
    Music,
    Spotify,
}

impl Player {
    fn app(self) -> &'static str {
        match self {
            Self::Music => "Music",
            Self::Spotify => "Spotify",
        }
    }

    pub(super) fn bundle_id(self) -> &'static str {
        match self {
            Self::Music => "com.apple.Music",
            Self::Spotify => "com.spotify.client",
        }
    }

    fn duration_seconds(self, raw: f64) -> f64 {
        match self {
            Self::Music => raw,
            Self::Spotify => raw / 1000.0,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub(super) struct Track {
    pub(super) player: Player,
    pub(super) playing: bool,
    pub(super) title: String,
    pub(super) artist: String,
    pub(super) album: String,
    pub(super) duration_ms: i64,
    pub(super) position_ms: i64,
}

static LAST: Mutex<Option<(Instant, Option<Track>)>> = Mutex::new(None);

fn osascript(script: &str) -> Option<String> {
    let output = Command::new("/usr/bin/osascript").arg("-e").arg(script).output().ok()?;
    output.status.success().then(|| String::from_utf8_lossy(&output.stdout).trim_end_matches('\n').to_string())
}

fn read_script(player: Player) -> String {
    let app = player.app();
    format!(
        "if application \"{app}\" is running then\n\
         tell application \"{app}\"\n\
         if player state is stopped then return \"\"\n\
         set t to current track\n\
         return (player state as text) & tab & (name of t) & tab & (artist of t) & tab & (album of t) & tab & (duration of t) & tab & (player position)\n\
         end tell\n\
         end if\n\
         return \"\""
    )
}

pub(super) fn parse(player: Player, line: &str) -> Option<Track> {
    let parts: Vec<&str> = line.split('\t').collect();
    let [state, title, artist, album, duration, position] = parts.as_slice() else {
        return None;
    };
    let number = |text: &str| text.trim().replace(',', ".").parse::<f64>().ok().filter(|value| value.is_finite() && *value >= 0.0);
    Some(Track {
        player,
        playing: state.trim() == "playing",
        title: title.to_string(),
        artist: artist.to_string(),
        album: album.to_string(),
        duration_ms: number(duration).map(|raw| (player.duration_seconds(raw) * 1000.0) as i64).unwrap_or(0),
        position_ms: number(position).map(|seconds| (seconds * 1000.0) as i64).unwrap_or(0),
    })
    .filter(|track| !track.title.is_empty())
}

fn read_now() -> Option<Track> {
    let tracks: Vec<Track> = [Player::Music, Player::Spotify]
        .into_iter()
        .filter_map(|player| osascript(&read_script(player)).and_then(|line| parse(player, &line)))
        .collect();
    tracks.iter().find(|track| track.playing).or(tracks.first()).cloned()
}

pub(super) fn current() -> Option<Track> {
    let mut last = LAST.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if let Some((_, track)) = last.as_ref().filter(|(at, _)| at.elapsed() < READ_EVERY) {
        return track.clone();
    }
    let track = read_now();
    *last = Some((Instant::now(), track.clone()));
    track
}

fn forget() {
    *LAST.lock().unwrap_or_else(std::sync::PoisonError::into_inner) = None;
}

pub(super) fn command(verb: &str) -> Result<(), String> {
    let player = current().map(|track| track.player).ok_or_else(|| "No media is currently playing.".to_string())?;
    forget();
    osascript(&format!("tell application \"{}\" to {verb}", player.app())).map(|_| ()).ok_or_else(|| format!("{} did not accept the command.", player.app()))
}

pub(super) fn seek(position_ms: i64) -> Result<(), String> {
    command(&format!("set player position to {:.3}", position_ms.max(0) as f64 / 1000.0))
}

#[cfg(test)]
mod tests {
    use super::{parse, Player};

    #[test]
    fn a_players_answer_becomes_a_track() {
        let track = parse(Player::Spotify, "playing\tSong\tSinger\tRecord\t215000\t12,5").expect("a track");
        assert!(track.playing);
        assert_eq!((track.duration_ms, track.position_ms), (215_000, 12_500));
        let music = parse(Player::Music, "paused\tSong\tSinger\tRecord\t215.2\t3").expect("a track");
        assert_eq!(music.duration_ms, 215_200);
        assert!(parse(Player::Music, "").is_none());
        assert!(parse(Player::Music, "paused\t\tSinger\tRecord\t1\t1").is_none());
    }
}
