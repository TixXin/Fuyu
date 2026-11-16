use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
};

use super::found::FoundLyrics;
use super::matching::{clean_title, fold, same_artist};
use super::ttml;

const MAX_FILE_BYTES: u64 = 512 * 1024;

pub(super) fn stem_score(stem: &str, title: &str, artist: &str) -> u8 {
    let title = clean_title(title);
    if title.is_empty() {
        return 0;
    }
    let stem = fold(stem);
    let named = |part: &str| clean_title(part) == title;
    if let Some((left, right)) = stem.split_once(" - ") {
        if (named(right) && !artist.is_empty() && same_artist(left, artist))
            || (named(left) && !artist.is_empty() && same_artist(right, artist))
        {
            return 2;
        }
    }
    u8::from(named(&stem))
}

fn read(path: &Path, ttml: bool) -> Option<FoundLyrics> {
    let bytes = fs::read(path).ok()?;
    let text = String::from_utf8_lossy(&bytes).trim_start_matches('\u{feff}').to_string();
    if ttml {
        return ttml::to_lyrics(&text);
    }
    Some(FoundLyrics { lrc: text, translation: None })
}

pub(super) fn find(folder: &Path, title: &str, artist: &str) -> Option<FoundLyrics> {
    let mut found: Vec<(u8, String, bool, PathBuf)> = Vec::new();
    for entry in fs::read_dir(folder).ok()?.flatten() {
        let path = entry.path();
        let extension = path.extension().map(|extension| extension.to_ascii_lowercase());
        let ttml = extension.as_deref().is_some_and(|extension| extension == "ttml");
        let lrc = extension.as_deref().is_some_and(|extension| extension == "lrc");
        let small = entry.metadata().is_ok_and(|meta| meta.is_file() && meta.len() <= MAX_FILE_BYTES);
        if !(lrc || ttml) || !small {
            continue;
        }
        let Some(stem) = path.file_stem().map(|stem| stem.to_string_lossy().to_string()) else {
            continue;
        };
        let score = stem_score(&stem, title, artist);
        if score > 0 {
            found.push((score, stem, ttml, path));
        }
    }
    let best = found.iter().map(|(score, ..)| *score).max()?;
    let stems: HashSet<&str> = found.iter().filter(|(score, ..)| *score == best).map(|(_, stem, ..)| stem.as_str()).collect();
    if best == 1 && stems.len() > 1 {
        return None;
    }
    let mut candidates: Vec<&(u8, String, bool, PathBuf)> = found.iter().filter(|(score, ..)| *score == best).collect();
    candidates.sort_by(|left, right| left.1.cmp(&right.1).then(right.2.cmp(&left.2)));
    let stem = candidates.first()?.1.clone();
    candidates.iter().filter(|(_, other, ..)| *other == stem).find_map(|(_, _, ttml, path)| read(path, *ttml))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_are_scored_by_title_and_artist() {
        assert_eq!(stem_score("周杰伦 - 晴天", "晴天", "周杰伦"), 2);
        assert_eq!(stem_score("晴天 - 周杰伦", "晴天 (Live)", "周杰伦"), 2);
        assert_eq!(stem_score("晴天", "晴天", "周杰伦"), 1);
        assert_eq!(stem_score("别人 - 晴天", "晴天", "周杰伦"), 0);
        assert_eq!(stem_score("七里香", "晴天", "周杰伦"), 0);
    }

    #[test]
    fn the_folder_gives_the_named_file_and_never_guesses_between_two() {
        let folder = std::env::temp_dir().join(format!("fuyu-lyrics-{}", std::process::id()));
        fs::create_dir_all(folder.join("sub")).unwrap();
        fs::write(folder.join("周杰伦 - 晴天.lrc"), "\u{feff}[00:01.00]故事的小黄花").unwrap();
        fs::write(folder.join("七里香.lrc"), "[00:01.00]窗外的麻雀").unwrap();
        fs::write(folder.join("sub").join("稻香.lrc"), "[00:01.00]对这个世界").unwrap();
        let lrc = |title: &str| find(&folder, title, "周杰伦").map(|found| found.lrc);
        assert_eq!(lrc("晴天").as_deref(), Some("[00:01.00]故事的小黄花"));
        assert_eq!(lrc("七里香").as_deref(), Some("[00:01.00]窗外的麻雀"));
        assert_eq!(lrc("稻香"), None);
        fs::write(folder.join("周杰伦 - 晴天.TTML"), r#"<tt><body><div><p begin="00:02.000" end="00:03.000" itunes:key="L1"><span begin="00:02.000" end="00:03.000">故事的小黄花</span><span ttm:role="x-translation">flowers</span></p></div></body></tt>"#).unwrap();
        let word_timed = find(&folder, "晴天", "周杰伦").unwrap();
        assert_eq!(word_timed.lrc, "[00:02.00]<00:02.00>故事的小黄花<00:03.00>\n[00:03.00]\n");
        assert_eq!(word_timed.translation.as_deref(), Some("[00:02.00]flowers\n"));
        fs::write(folder.join("周杰伦 - 晴天.TTML"), "<tt>broken").unwrap();
        assert_eq!(lrc("晴天").as_deref(), Some("[00:01.00]故事的小黄花"));
        fs::write(folder.join("稻香.ttml"), "<tt>").unwrap();
        assert_eq!(lrc("稻香"), None);
        fs::write(folder.join("七里香 - 别人.lrc"), "x").unwrap();
        fs::write(folder.join("七里香 (Live).lrc"), "y").unwrap();
        assert_eq!(lrc("七里香"), None);
        assert_eq!(find(&folder.join("missing"), "晴天", "周杰伦"), None);
        fs::remove_dir_all(&folder).unwrap();
    }
}
