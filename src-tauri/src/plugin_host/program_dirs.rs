use std::{
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::OnceLock,
    thread,
    time::{Duration, Instant},
};

const SHELL_TIMEOUT: Duration = Duration::from_secs(3);
const MARKER: &str = "__FUYU_PATH__";
const USUAL: [&str; 3] = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"];

pub(super) fn find(name: &str) -> Option<PathBuf> {
    candidates().map(|dir| dir.join(name)).find(|candidate| candidate.is_file())
}

fn candidates() -> impl Iterator<Item = PathBuf> {
    let own = std::env::var_os("PATH").map(|path| std::env::split_paths(&path).collect::<Vec<_>>()).unwrap_or_default();
    let usual = USUAL.into_iter().map(PathBuf::from);
    let shell = std::iter::once_with(login_shell_path).flat_map(|dirs| dirs.iter().cloned());
    let managers = std::iter::once_with(|| std::env::var_os("HOME").map(|home| manager_dirs(Path::new(&home))).unwrap_or_default()).flatten();
    own.into_iter().chain(usual).chain(shell).chain(managers)
}

fn login_shell_path() -> &'static [PathBuf] {
    static PATH: OnceLock<Vec<PathBuf>> = OnceLock::new();
    PATH.get_or_init(|| {
        let shell = std::env::var("SHELL").ok().filter(|shell| shell.starts_with('/')).unwrap_or_else(|| "/bin/zsh".into());
        read_shell_path(&shell).map(|path| std::env::split_paths(&path).collect()).unwrap_or_default()
    })
}

fn read_shell_path(shell: &str) -> Option<String> {
    let mut child = Command::new(shell)
        .args(["-ilc", &format!("printf '{MARKER}%s{MARKER}' \"$PATH\"")])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if started.elapsed() < SHELL_TIMEOUT => thread::sleep(Duration::from_millis(20)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
    let mut output = String::new();
    child.stdout.take()?.read_to_string(&mut output).ok()?;
    between_markers(&output)
}

fn between_markers(output: &str) -> Option<String> {
    let start = output.find(MARKER)? + MARKER.len();
    let length = output[start..].find(MARKER)?;
    Some(output[start..start + length].to_string()).filter(|path| !path.is_empty())
}

fn manager_dirs(home: &Path) -> Vec<PathBuf> {
    let mut dirs = vec![
        home.join(".volta/bin"),
        home.join(".local/share/fnm/aliases/default/bin"),
        home.join("Library/Application Support/fnm/aliases/default/bin"),
        home.join(".fnm/aliases/default/bin"),
        home.join(".local/share/mise/shims"),
        home.join(".asdf/shims"),
        home.join(".nodenv/shims"),
    ];
    dirs.extend(nvm_dirs(&home.join(".nvm/versions/node")));
    dirs
}

fn nvm_dirs(versions: &Path) -> Vec<PathBuf> {
    let mut found: Vec<(Vec<u64>, PathBuf)> = std::fs::read_dir(versions)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            let version = name.strip_prefix('v')?.split('.').map(|part| part.parse().ok()).collect::<Option<Vec<u64>>>()?;
            Some((version, entry.path().join("bin")))
        })
        .collect();
    found.sort_by(|a, b| b.0.cmp(&a.0));
    found.into_iter().map(|(_, dir)| dir).collect()
}

#[cfg(test)]
mod tests {
    use super::{between_markers, nvm_dirs};

    #[test]
    fn the_path_is_read_between_the_markers_whatever_the_shell_prints_around_it() {
        assert_eq!(between_markers("welcome!\n__FUYU_PATH__/a:/b__FUYU_PATH__bye").as_deref(), Some("/a:/b"));
        assert_eq!(between_markers("__FUYU_PATH____FUYU_PATH__"), None);
        assert_eq!(between_markers("no markers"), None);
    }

    #[test]
    fn the_newest_nvm_version_is_tried_first() {
        let root = std::env::temp_dir().join(format!("fuyu-nvm-{}", std::process::id()));
        for version in ["v18.20.1", "v22.3.0", "v9.11.2", "system"] {
            std::fs::create_dir_all(root.join(version).join("bin")).unwrap();
        }
        let dirs = nvm_dirs(&root);
        let _ = std::fs::remove_dir_all(&root);
        assert_eq!(dirs, [root.join("v22.3.0/bin"), root.join("v18.20.1/bin"), root.join("v9.11.2/bin")]);
    }
}
