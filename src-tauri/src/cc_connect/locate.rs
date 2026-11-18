use crate::user_error::UserError;
use std::{
    env,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
};
#[cfg(unix)]
use std::{
    ffi::OsString,
    io::Read,
    process::{Command, Stdio},
    sync::OnceLock,
    thread,
    time::{Duration, Instant},
};

#[cfg(windows)]
pub(super) const EXE_NAME: &str = "cc-connect.exe";
#[cfg(not(windows))]
pub(super) const EXE_NAME: &str = "cc-connect";
pub(super) const FOLDER: &str = "cc-connect";
#[cfg(windows)]
const PATH_NAMES: [&str; 2] = [EXE_NAME, "cc-connect.cmd"];
#[cfg(not(windows))]
const PATH_NAMES: [&str; 1] = [EXE_NAME];

#[cfg(unix)]
const SHELL_TIMEOUT: Duration = Duration::from_secs(2);
#[cfg(any(unix, test))]
const PATH_MARKER: &str = "__FUYU_CC_PATH__";

pub(super) fn find(setting: Option<&str>, app_dir: Option<&Path>) -> Result<Option<(PathBuf, &'static str)>, UserError> {
    if let Some(path) = setting.map(str::trim).filter(|path| !path.is_empty()) {
        let home = crate::system::windows_home_dir().ok();
        let path = resolve_setting_path(path, home.as_deref());
        return if path.is_file() {
            Ok(Some((path, "setting")))
        } else {
            Err(UserError::new("ccConnect.notAt", format!("cc-connect is not at {}", path.display())).arg("path", path.display().to_string()))
        };
    }
    if let Some(path) = crate::platform::process::running_executable(&[EXE_NAME]) {
        return Ok(Some((PathBuf::from(path), "running")));
    }
    if let Some(path) = env::var_os("PATH").and_then(|paths| on_path(&paths, Path::is_file)) {
        return Ok(Some((path, "path")));
    }
    if let Some(path) = app_dir.and_then(|dir| in_folder(&dir.join(FOLDER))) {
        return Ok(Some((path, "downloaded")));
    }
    Ok(installed_exe().map(|path| (path, "installed")))
}

fn resolve_setting_path(raw: &str, home: Option<&Path>) -> PathBuf {
    let trimmed = raw.trim().trim_matches('"');
    if !cfg!(windows) {
        if trimmed == "~" {
            if let Some(home) = home {
                return home.to_path_buf();
            }
        } else if let Some(rest) = trimmed.strip_prefix("~/") {
            if let Some(home) = home {
                return home.join(rest);
            }
        }
    }
    PathBuf::from(trimmed)
}

fn on_path(paths: &OsStr, is_file: impl Fn(&Path) -> bool) -> Option<PathBuf> {
    env::split_paths(paths)
        .flat_map(|dir| PATH_NAMES.map(|name| dir.join(name)))
        .find(|path| is_file(path))
}

#[cfg(windows)]
fn installed_exe() -> Option<PathBuf> {
    install_roots().iter().find_map(|root| in_folder(&root.join(FOLDER)))
}

#[cfg(not(windows))]
fn installed_exe() -> Option<PathBuf> {
    let home = crate::system::windows_home_dir().ok();
    unix_install_dirs(home.as_deref(), login_shell_path())
        .into_iter()
        .map(|dir| dir.join(EXE_NAME))
        .find(|exe| exe.is_file())
}

#[cfg(any(windows, test))]
fn install_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = ["C:", "D:"]
        .iter()
        .flat_map(|drive| ["Program Files", "Program Files (x86)"].map(|dir| PathBuf::from(format!(r"{drive}\{dir}"))))
        .collect();
    roots.extend(env::var_os("LOCALAPPDATA").map(|local| PathBuf::from(local).join("Programs")));
    roots
}

#[cfg(any(unix, test))]
fn unix_install_dirs(home: Option<&Path>, shell_dirs: &[PathBuf]) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let mut push = |dir: PathBuf| {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    };
    if let Some(home) = home {
        push(home.join(".local").join("bin"));
    }
    for usual in ["/opt/homebrew/bin", "/usr/local/bin"] {
        push(PathBuf::from(usual));
    }
    if let Some(home) = home {
        push(home.join(".npm-global").join("bin"));
        push(home.join(".bun").join("bin"));
    }
    for dir in shell_dirs {
        push(dir.clone());
    }
    dirs
}

#[cfg(unix)]
pub(super) fn child_path() -> OsString {
    let own = env::var_os("PATH");
    let home = crate::system::windows_home_dir().ok();
    compose_child_path(own.as_deref(), home.as_deref(), login_shell_path())
}

#[cfg(unix)]
fn compose_child_path(own: Option<&OsStr>, home: Option<&Path>, shell_dirs: &[PathBuf]) -> OsString {
    let mut dirs: Vec<PathBuf> = own.map(|paths| env::split_paths(paths).collect()).unwrap_or_default();
    for dir in unix_install_dirs(home, shell_dirs) {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    env::join_paths(&dirs).unwrap_or_else(|_| own.map(OsStr::to_os_string).unwrap_or_default())
}

#[cfg(unix)]
fn login_shell_path() -> &'static [PathBuf] {
    static PATH: OnceLock<Vec<PathBuf>> = OnceLock::new();
    PATH.get_or_init(|| {
        let shell = env::var("SHELL").ok().filter(|shell| shell.starts_with('/')).unwrap_or_else(|| "/bin/zsh".into());
        read_shell_path(&shell).map(|path| env::split_paths(&path).collect()).unwrap_or_default()
    })
}

#[cfg(unix)]
fn read_shell_path(shell: &str) -> Option<String> {
    use std::os::unix::process::CommandExt;
    let mut command = Command::new(shell);
    command
        .args(["-ilc", &format!("printf '{PATH_MARKER}%s{PATH_MARKER}' \"$PATH\"")])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .process_group(0);
    let mut child = command.spawn().ok()?;
    let job = crate::platform::job::Job::new().ok()?;
    let _ = job.assign(&child);
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) if started.elapsed() < SHELL_TIMEOUT => thread::sleep(Duration::from_millis(20)),
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                drop(job);
                return None;
            }
        }
    }
    let mut output = String::new();
    child.stdout.take()?.read_to_string(&mut output).ok()?;
    between_markers(&output)
}

#[cfg(any(unix, test))]
fn between_markers(output: &str) -> Option<String> {
    let start = output.find(PATH_MARKER)? + PATH_MARKER.len();
    let length = output[start..].find(PATH_MARKER)?;
    Some(output[start..start + length].to_string()).filter(|path| !path.is_empty())
}

fn in_folder(folder: &Path) -> Option<PathBuf> {
    let direct = folder.join(EXE_NAME);
    if direct.is_file() {
        return Some(direct);
    }
    fs::read_dir(folder)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path().join(EXE_NAME))
        .filter_map(|exe| {
            let meta = exe.metadata().ok().filter(fs::Metadata::is_file)?;
            Some((meta.modified().ok()?, exe))
        })
        .max_by_key(|(modified, _)| *modified)
        .map(|(_, exe)| exe)
}

#[cfg(test)]
mod tests {
    use super::{between_markers, in_folder, install_roots, on_path, resolve_setting_path, unix_install_dirs, EXE_NAME};
    use std::{
        ffi::OsString,
        fs,
        path::{Path, PathBuf},
        thread,
        time::Duration,
    };

    #[test]
    #[cfg(windows)]
    fn the_first_folder_on_path_wins_and_an_exe_before_a_shim() {
        let paths = OsString::from(r"C:\a;C:\npm;C:\b");
        let have = |path: &Path| [r"C:\npm\cc-connect.cmd", r"C:\b\cc-connect.exe"].iter().any(|have| Path::new(have) == path);
        assert_eq!(on_path(&paths, have).as_deref(), Some(Path::new(r"C:\npm\cc-connect.cmd")));
        let both = |path: &Path| path.starts_with(r"C:\npm");
        assert_eq!(on_path(&paths, both).as_deref(), Some(Path::new(r"C:\npm\cc-connect.exe")));
        assert_eq!(on_path(&paths, |_| false), None);
        assert_eq!(resolve_setting_path(r#""C:\tools\cc-connect.exe""#, None), PathBuf::from(r"C:\tools\cc-connect.exe"));
    }

    #[test]
    #[cfg(unix)]
    fn the_first_folder_on_unix_path_wins_and_tilde_expands_for_settings() {
        let paths = OsString::from("/a:/opt/homebrew/bin:/b");
        let have = |path: &Path| [Path::new("/opt/homebrew/bin/cc-connect"), Path::new("/b/cc-connect")].contains(&path);
        assert_eq!(on_path(&paths, have).as_deref(), Some(Path::new("/opt/homebrew/bin/cc-connect")));
        assert_eq!(on_path(&paths, |_| false), None);
        assert_eq!(resolve_setting_path("\"~/bin/cc-connect\"", Some(Path::new("/Users/me"))), PathBuf::from("/Users/me/bin/cc-connect"));
        let joined = super::compose_child_path(Some(OsString::from("/usr/bin:/opt/homebrew/bin").as_os_str()), Some(Path::new("/Users/me")), &[]);
        let split: Vec<PathBuf> = std::env::split_paths(&joined).collect();
        assert_eq!(&split[..4], [PathBuf::from("/usr/bin"), PathBuf::from("/opt/homebrew/bin"), PathBuf::from("/Users/me/.local/bin"), PathBuf::from("/usr/local/bin")]);
    }

    #[test]
    fn installers_folders_and_unix_bin_dirs_stay_ordered_without_duplicates() {
        let roots = install_roots();
        for root in [r"C:\Program Files", r"C:\Program Files (x86)", r"D:\Program Files", r"D:\Program Files (x86)"] {
            assert!(roots.iter().any(|have| have == Path::new(root)), "{root}");
        }
        let dirs = unix_install_dirs(Some(Path::new("/Users/me")), &[PathBuf::from("/opt/homebrew/bin"), PathBuf::from("/Users/me/.nvm/versions/node/v22.0.0/bin")]);
        assert_eq!(
            dirs,
            [
                PathBuf::from("/Users/me/.local/bin"),
                PathBuf::from("/opt/homebrew/bin"),
                PathBuf::from("/usr/local/bin"),
                PathBuf::from("/Users/me/.npm-global/bin"),
                PathBuf::from("/Users/me/.bun/bin"),
                PathBuf::from("/Users/me/.nvm/versions/node/v22.0.0/bin"),
            ]
        );
        assert_eq!(between_markers("motd\n__FUYU_CC_PATH__/a:/b__FUYU_CC_PATH__\n").as_deref(), Some("/a:/b"));
        assert_eq!(between_markers("__FUYU_CC_PATH____FUYU_CC_PATH__"), None);
    }

    #[test]
    fn the_exe_in_the_folder_else_the_newest_version_folder() {
        let folder = std::env::temp_dir().join(format!("fuyu-cc-connect-locate-{}", std::process::id()));
        let _ = fs::remove_dir_all(&folder);
        assert_eq!(in_folder(&folder), None);
        for version in ["v1.4.0", "v1.5.0"] {
            fs::create_dir_all(folder.join(version)).unwrap();
            fs::write(folder.join(version).join(EXE_NAME), b"").unwrap();
            thread::sleep(Duration::from_millis(20));
        }
        fs::create_dir_all(folder.join("logs")).unwrap();
        assert_eq!(in_folder(&folder), Some(folder.join("v1.5.0").join(EXE_NAME)));
        fs::write(folder.join(EXE_NAME), b"").unwrap();
        assert_eq!(in_folder(&folder), Some(folder.join(EXE_NAME)));
        let _ = fs::remove_dir_all(&folder);
    }
}
