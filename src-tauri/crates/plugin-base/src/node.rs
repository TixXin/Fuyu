use std::{
    collections::HashSet,
    ffi::OsString,
    fmt,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct NodeVersion(pub u32, pub u32, pub u32);

pub const MINIMUM_NODE: NodeVersion = NodeVersion(22, 15, 0);

impl NodeVersion {
    pub fn parse(text: &str) -> Option<Self> {
        let mut parts = text.trim().trim_start_matches('v').split('.');
        let mut next = || parts.next()?.split(|c: char| !c.is_ascii_digit()).next()?.parse().ok();
        Some(Self(next()?, next()?, next()?))
    }
}

impl fmt::Display for NodeVersion {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}.{}.{}", self.0, self.1, self.2)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FoundNode {
    pub path: PathBuf,
    pub version: NodeVersion,
}

#[derive(Debug, Clone, Default)]
pub struct NodeSearch {
    pub explicit: Option<PathBuf>,
    pub path_var: Option<OsString>,
    pub home: Option<PathBuf>,
    pub program_files: Option<PathBuf>,
    pub local_app_data: Option<PathBuf>,
    pub app_data: Option<PathBuf>,
    pub nvm_symlink: Option<PathBuf>,
    pub extra: Vec<PathBuf>,
}

impl NodeSearch {
    pub fn from_env() -> Self {
        let var = |name: &str| std::env::var_os(name).filter(|value| !value.is_empty());
        Self {
            explicit: var("FUYU_NODE").map(PathBuf::from),
            path_var: var("PATH"),
            home: var("HOME").or_else(|| var("USERPROFILE")).map(PathBuf::from),
            program_files: var("ProgramFiles").map(PathBuf::from),
            local_app_data: var("LOCALAPPDATA").map(PathBuf::from),
            app_data: var("APPDATA").map(PathBuf::from),
            nvm_symlink: var("NVM_SYMLINK").map(PathBuf::from),
            extra: Vec::new(),
        }
    }

    pub fn candidates(&self, windows: bool) -> Vec<PathBuf> {
        let exe = if windows { "node.exe" } else { "node" };
        let mut list = Vec::new();
        list.extend(self.explicit.clone());
        list.extend(self.extra.iter().cloned());
        if let Some(path) = &self.path_var {
            list.extend(std::env::split_paths(path).filter(|dir| !dir.as_os_str().is_empty()).map(|dir| dir.join(exe)));
        }
        if windows {
            list.extend(self.program_files.as_ref().map(|dir| dir.join("nodejs").join(exe)));
            list.extend(self.local_app_data.as_ref().map(|dir| dir.join("Programs").join("nodejs").join(exe)));
            list.extend(self.nvm_symlink.as_ref().map(|dir| dir.join(exe)));
            list.extend(self.local_app_data.as_ref().map(|dir| dir.join("Volta").join("bin").join(exe)));
            list.extend(self.app_data.as_ref().map(|dir| dir.join("fnm").join("aliases").join("default").join(exe)));
        } else {
            list.extend(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"].iter().map(|dir| Path::new(dir).join(exe)));
            if let Some(home) = &self.home {
                list.push(home.join(".volta/bin").join(exe));
                list.extend(newest_nvm(&home.join(".nvm/versions/node")).map(|dir| dir.join("bin").join(exe)));
                list.push(home.join(".local/share/fnm/aliases/default/bin").join(exe));
                list.push(home.join("Library/Application Support/fnm/aliases/default/bin").join(exe));
                list.push(home.join(".local/bin").join(exe));
            }
        }
        let mut seen = HashSet::new();
        list.retain(|path| seen.insert(path.clone()));
        list
    }
}

fn newest_nvm(dir: &Path) -> Option<PathBuf> {
    std::fs::read_dir(dir)
        .ok()?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| Some((NodeVersion::parse(&entry.file_name().to_string_lossy())?, entry.path())))
        .max_by_key(|(version, _)| *version)
        .map(|(_, path)| path)
}

const PROBE_TIMEOUT: Duration = Duration::from_secs(45);

pub fn probe(path: &Path) -> Result<NodeVersion, String> {
    if !path.is_file() {
        return Err("not there".into());
    }
    let mut command = Command::new(path);
    command.arg("--version").stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null());
    hide_window(&mut command);
    let mut child = command.spawn().map_err(|error| format!("could not run it: {error}"))?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => break,
            Ok(Some(status)) => return Err(format!("`--version` exited with {status}")),
            Ok(None) if started.elapsed() > PROBE_TIMEOUT => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("`--version` did not answer in {} s", PROBE_TIMEOUT.as_secs()));
            }
            Ok(None) => thread::sleep(Duration::from_millis(20)),
            Err(error) => return Err(error.to_string()),
        }
    }
    let mut text = String::new();
    if let Some(mut stdout) = child.stdout.take() {
        let _ = std::io::Read::read_to_string(&mut stdout, &mut text);
    }
    NodeVersion::parse(&text).ok_or_else(|| format!("`--version` printed {:?}", text.trim()))
}

#[cfg(windows)]
pub(crate) fn hide_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x0800_0000);
}

#[cfg(not(windows))]
pub(crate) fn hide_window(_command: &mut Command) {}

pub fn find_node(search: &NodeSearch, minimum: NodeVersion) -> Result<FoundNode, Vec<(PathBuf, String)>> {
    find_with(&search.candidates(cfg!(windows)), minimum, probe)
}

pub fn find_with(candidates: &[PathBuf], minimum: NodeVersion, probe: impl Fn(&Path) -> Result<NodeVersion, String>) -> Result<FoundNode, Vec<(PathBuf, String)>> {
    let mut tried = Vec::new();
    let mut seen = HashSet::new();
    for path in candidates {
        let real = std::fs::canonicalize(path).unwrap_or_else(|_| path.clone());
        if !seen.insert(real) {
            continue;
        }
        match probe(path) {
            Ok(version) if version >= minimum => return Ok(FoundNode { path: path.clone(), version }),
            Ok(version) => tried.push((path.clone(), format!("Node {version} is older than {minimum}"))),
            Err(reason) if reason == "not there" => {}
            Err(reason) => tried.push((path.clone(), reason)),
        }
    }
    Err(tried)
}

pub fn describe_failure(tried: &[(PathBuf, String)], minimum: NodeVersion) -> String {
    if tried.is_empty() {
        return format!("no Node {minimum} or newer was found");
    }
    let lines: Vec<String> = tried.iter().map(|(path, reason)| format!("{}: {reason}", path.display())).collect();
    format!("no usable Node {minimum} or newer: {}", lines.join("; "))
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use super::{find_with, NodeSearch, NodeVersion};

    #[test]
    fn versions_parse_from_what_node_prints() {
        assert_eq!(NodeVersion::parse("v22.15.0\n"), Some(NodeVersion(22, 15, 0)));
        assert_eq!(NodeVersion::parse("26.13.1"), Some(NodeVersion(26, 13, 1)));
        assert_eq!(NodeVersion::parse("v24.0.0-nightly2026"), Some(NodeVersion(24, 0, 0)));
        assert_eq!(NodeVersion::parse("node"), None);
        assert!(NodeVersion(22, 14, 9) < NodeVersion(22, 15, 0));
    }

    #[test]
    fn an_explicit_node_comes_first_then_path_then_the_usual_places() {
        let search = NodeSearch {
            explicit: Some(PathBuf::from("/custom/node")),
            path_var: Some(std::env::join_paths(["/a", "/b"]).unwrap()),
            home: Some(PathBuf::from("/home/me")),
            ..NodeSearch::default()
        };
        let list = search.candidates(false);
        assert_eq!(&list[..3], &[PathBuf::from("/custom/node"), PathBuf::from("/a/node"), PathBuf::from("/b/node")]);
        assert!(list.contains(&PathBuf::from("/opt/homebrew/bin/node")));
        assert!(list.contains(&PathBuf::from("/home/me/.volta/bin/node")));
    }

    #[test]
    fn windows_looks_in_program_files_and_the_version_managers() {
        let search = NodeSearch {
            program_files: Some(PathBuf::from("C:/Program Files")),
            local_app_data: Some(PathBuf::from("C:/Users/me/AppData/Local")),
            app_data: Some(PathBuf::from("C:/Users/me/AppData/Roaming")),
            nvm_symlink: Some(PathBuf::from("C:/nvm4w/nodejs")),
            ..NodeSearch::default()
        };
        let list = search.candidates(true);
        assert_eq!(list[0], Path::new("C:/Program Files").join("nodejs").join("node.exe"));
        assert!(list.contains(&Path::new("C:/nvm4w/nodejs").join("node.exe")));
        assert!(list.iter().all(|path| path.ends_with("node.exe")));
    }

    #[test]
    fn the_first_new_enough_node_wins_and_the_others_are_explained() {
        let candidates: Vec<PathBuf> = ["/old/node", "/broken/node", "/missing/node", "/good/node", "/later/node"].iter().map(PathBuf::from).collect();
        let found = find_with(&candidates, NodeVersion(22, 15, 0), |path| match path.to_str() {
            Some("/old/node") => Ok(NodeVersion(20, 1, 0)),
            Some("/broken/node") => Err("could not run it".into()),
            Some("/missing/node") => Err("not there".into()),
            _ => Ok(NodeVersion(26, 0, 0)),
        });
        assert_eq!(found.unwrap().path, PathBuf::from("/good/node"));
        let failed = find_with(&candidates[..3], NodeVersion(22, 15, 0), |path| match path.to_str() {
            Some("/old/node") => Ok(NodeVersion(20, 1, 0)),
            Some("/broken/node") => Err("could not run it".into()),
            _ => Err("not there".into()),
        });
        let tried = failed.unwrap_err();
        assert_eq!(tried.len(), 2, "a missing file is not worth reporting");
        assert!(tried[0].1.contains("older than 22.15.0"));
    }
}
