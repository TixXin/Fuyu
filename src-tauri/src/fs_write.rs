//! Replacing a file in the app data folder whole: write beside it, then rename over it, so a crash
//! never leaves half a file. A file another program has open for a moment (a scanner, an island
//! that is still exiting) refuses the write or the rename with "Access is denied"; those are tried
//! again a few times before giving up.

use std::{fs, io, path::Path, thread, time::Duration};

/// Waits before each further try; about a third of a second in all.
const RETRY_WAITS: [Duration; 3] = [Duration::from_millis(50), Duration::from_millis(100), Duration::from_millis(150)];

/// Writes `content` to `path`, replacing what was there.
pub(crate) fn replace_file(path: &Path, content: &[u8]) -> io::Result<()> {
    let mut temporary = path.as_os_str().to_owned();
    temporary.push(".tmp");
    let temporary = Path::new(&temporary);
    retrying(|| fs::write(temporary, content))?;
    retrying(|| fs::rename(temporary, path)).inspect_err(|_| {
        let _ = fs::remove_file(temporary);
    })
}

fn retrying(mut step: impl FnMut() -> io::Result<()>) -> io::Result<()> {
    let mut waits = RETRY_WAITS.iter();
    loop {
        match step() {
            Err(error) if held_by_another_program(&error) => match waits.next() {
                Some(wait) => thread::sleep(*wait),
                None => return Err(error),
            },
            result => return result,
        }
    }
}

/// "Access is denied" (5) or a sharing violation (32): another program has the file open.
fn held_by_another_program(error: &io::Error) -> bool {
    const ERROR_SHARING_VIOLATION: i32 = 32;
    error.kind() == io::ErrorKind::PermissionDenied || error.raw_os_error() == Some(ERROR_SHARING_VIOLATION)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::windows::fs::OpenOptionsExt;

    #[test]
    fn replaces_the_file_and_leaves_no_temporary_behind() {
        let dir = std::env::temp_dir().join(format!("focusd-fs-write-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("history.json");
        fs::write(&path, b"old").unwrap();
        replace_file(&path, b"new").unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"new");
        assert!(!dir.join("history.json.tmp").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn waits_out_a_program_that_holds_the_file_for_a_moment() {
        let dir = std::env::temp_dir().join(format!("focusd-fs-write-held-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("history.json");
        fs::write(&path, b"old").unwrap();
        // Open with no sharing, as a scanner might: a rename over it is refused until it closes.
        let held = fs::OpenOptions::new().read(true).share_mode(0).open(&path).unwrap();
        let release = thread::spawn(move || {
            thread::sleep(Duration::from_millis(80));
            drop(held);
        });
        replace_file(&path, b"new").unwrap();
        release.join().unwrap();
        assert_eq!(fs::read(&path).unwrap(), b"new");
        fs::remove_dir_all(&dir).unwrap();
    }
}
