use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Write},
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};

use plugin_base::{
    installed_node, prepare_node,
    runtime::{choose, NodeSource},
    ArchiveKind, DownloadError, FailureCause, FoundNode, NodeArchive, NodeDownload, NodeVersion, Progress,
};
use sha2::{Digest, Sha256};

#[derive(Clone)]
enum Reply {
    Body(Vec<u8>),
    Status(u16),
    Truncated(Vec<u8>),
}

#[derive(Clone)]
struct Server {
    base: String,
    routes: Arc<Mutex<HashMap<String, Reply>>>,
    hits: Arc<Mutex<Vec<String>>>,
}

impl Server {
    fn start() -> Self {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let server = Self { base, routes: Arc::default(), hits: Arc::default() };
        let shared = server.clone();
        thread::spawn(move || {
            for stream in listener.incoming() {
                let Ok(mut stream) = stream else { continue };
                let mut reader = BufReader::new(stream.try_clone().unwrap());
                let mut first = String::new();
                if reader.read_line(&mut first).is_err() {
                    continue;
                }
                let mut line = String::new();
                while reader.read_line(&mut line).is_ok_and(|read| read > 2) {
                    line.clear();
                }
                let path = first.split_whitespace().nth(1).unwrap_or("/").to_string();
                shared.hits.lock().unwrap().push(path.clone());
                let reply = shared.routes.lock().unwrap().get(&path).cloned().unwrap_or(Reply::Status(404));
                let _ = match reply {
                    Reply::Body(body) => stream.write_all(&[format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len()).into_bytes(), body].concat()),
                    Reply::Status(code) => stream.write_all(format!("HTTP/1.1 {code} Nope\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").as_bytes()),
                    Reply::Truncated(body) => stream.write_all(&[format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len()).into_bytes(), body[..body.len() / 2].to_vec()].concat()),
                };
            }
        });
        server
    }

    fn serve(&self, path: &str, reply: Reply) {
        self.routes.lock().unwrap().insert(path.into(), reply);
    }

    fn hits(&self) -> usize {
        self.hits.lock().unwrap().len()
    }
}

struct Temp(PathBuf);

impl Temp {
    fn new(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("fuyu-node-download-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        Self(dir)
    }
}

impl Drop for Temp {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

const VERSION: NodeVersion = NodeVersion(1, 2, 3);

fn sha(bytes: &[u8]) -> String {
    Sha256::digest(bytes).iter().map(|byte| format!("{byte:02x}")).collect()
}

fn zip_of(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut zip = zip::ZipWriter::new(std::io::Cursor::new(Vec::new()));
    for (name, body) in entries {
        zip.start_file(*name, zip::write::SimpleFileOptions::default()).unwrap();
        zip.write_all(body).unwrap();
    }
    zip.finish().unwrap().into_inner()
}

fn windows_zip() -> Vec<u8> {
    zip_of(&[("node-v1.2.3-win-x64/README.md", b"readme"), ("node-v1.2.3-win-x64/node.exe", b"MZ fake node")])
}

fn download(server: &Server, sources: &[&str], file: &str, sha256: String, kind: ArchiveKind, exe: &str) -> NodeDownload {
    NodeDownload {
        version: VERSION,
        archive: NodeArchive { file: file.into(), sha256, kind, exe: exe.into() },
        sources: sources.iter().map(|source| format!("{}/{source}", server.base)).collect(),
        proxy: None,
        max_bytes: 10 << 20,
        connect_timeout: Duration::from_secs(5),
        read_timeout: Duration::from_secs(5),
    }
}

fn zip_download(server: &Server, sources: &[&str], body: &[u8]) -> NodeDownload {
    download(server, sources, "node-v1.2.3-win-x64.zip", sha(body), ArchiveKind::Zip, "node.exe")
}

fn leftovers(data: &Path) -> Vec<String> {
    let Ok(entries) = fs::read_dir(data.join("runtime")) else { return Vec::new() };
    let mut names: Vec<String> = entries.flatten().map(|entry| entry.file_name().to_string_lossy().into_owned()).collect();
    names.sort();
    names
}

fn quiet() -> impl FnMut(Progress) {
    |_| {}
}

#[test]
fn a_verified_zip_lands_in_its_version_folder_and_is_not_downloaded_again() {
    let server = Server::start();
    let temp = Temp::new("zip");
    let body = windows_zip();
    server.serve("/official/v1.2.3/node-v1.2.3-win-x64.zip", Reply::Body(body.clone()));
    let release = zip_download(&server, &["official", "mirror"], &body);
    let mut seen = Vec::new();
    let exe = prepare_node(&temp.0, &release, &mut |progress| seen.push((progress.url.to_string(), progress.downloaded, progress.total))).unwrap();
    assert_eq!(exe, temp.0.join("runtime").join("node-v1.2.3").join("node.exe"));
    assert_eq!(fs::read(&exe).unwrap(), b"MZ fake node");
    assert!(!temp.0.join("runtime/node-v1.2.3/README.md").exists(), "only the executable is unpacked, so a virus scanner has one file to look at");
    assert_eq!(leftovers(&temp.0), ["node-v1.2.3"]);
    let total = body.len() as u64;
    assert_eq!(seen.first().map(|entry| entry.1), Some(0));
    assert_eq!(seen.last().cloned(), Some((format!("{}/official/v1.2.3/node-v1.2.3-win-x64.zip", server.base), total, Some(total))));
    assert_eq!(installed_node(&temp.0, &release), Some(exe.clone()));
    let hits = server.hits();
    assert_eq!(prepare_node(&temp.0, &release, &mut quiet()).unwrap(), exe);
    assert_eq!(server.hits(), hits, "an installed and checked Node is used as it is");
}

#[test]
fn a_wrong_hash_is_refused_and_nothing_is_left_behind() {
    let server = Server::start();
    let temp = Temp::new("hash");
    let body = windows_zip();
    server.serve("/official/v1.2.3/node-v1.2.3-win-x64.zip", Reply::Body(body));
    let release = download(&server, &["official"], "node-v1.2.3-win-x64.zip", "0".repeat(64), ArchiveKind::Zip, "node.exe");
    let error = prepare_node(&temp.0, &release, &mut quiet()).unwrap_err();
    let DownloadError::Sources(attempts) = &error else { panic!("{error}") };
    assert_eq!(attempts.len(), 1);
    assert!(attempts[0].reason.contains("SHA-256 is") && attempts[0].reason.contains(&"0".repeat(64)), "{error}");
    assert!(error.to_string().contains("/official/v1.2.3/node-v1.2.3-win-x64.zip"), "{error}");
    assert!(leftovers(&temp.0).is_empty(), "{:?}", leftovers(&temp.0));
    assert_eq!(installed_node(&temp.0, &release), None);
}

#[test]
fn a_download_that_breaks_off_is_cleaned_up_and_the_next_try_works() {
    let server = Server::start();
    let temp = Temp::new("retry");
    let body = windows_zip();
    let path = "/official/v1.2.3/node-v1.2.3-win-x64.zip";
    server.serve(path, Reply::Truncated(body.clone()));
    let release = zip_download(&server, &["official"], &body);
    let error = prepare_node(&temp.0, &release, &mut quiet()).unwrap_err().to_string();
    assert!(error.contains(path), "{error}");
    assert!(leftovers(&temp.0).is_empty(), "{:?}", leftovers(&temp.0));
    server.serve(path, Reply::Body(body));
    let exe = prepare_node(&temp.0, &release, &mut quiet()).unwrap();
    assert_eq!(fs::read(exe).unwrap(), b"MZ fake node");
}

#[test]
fn the_mirror_is_tried_when_the_official_site_fails_and_every_failure_is_named() {
    let server = Server::start();
    let temp = Temp::new("mirror");
    let body = windows_zip();
    server.serve("/official/v1.2.3/node-v1.2.3-win-x64.zip", Reply::Status(503));
    let release = zip_download(&server, &["official", "mirror"], &body);
    let error = prepare_node(&temp.0, &release, &mut quiet()).unwrap_err().to_string();
    assert!(error.contains("/official/v1.2.3/node-v1.2.3-win-x64.zip: answered HTTP 503"), "{error}");
    assert!(error.contains("/mirror/v1.2.3/node-v1.2.3-win-x64.zip: answered HTTP 404"), "{error}");
    server.serve("/mirror/v1.2.3/node-v1.2.3-win-x64.zip", Reply::Body(body));
    let mut urls = Vec::new();
    prepare_node(&temp.0, &release, &mut |progress| urls.push(progress.url.to_string())).unwrap();
    assert!(urls.iter().all(|url| url.contains("/mirror/")), "{urls:?}");
}

#[test]
fn an_archive_without_the_expected_folder_is_refused() {
    let server = Server::start();
    let temp = Temp::new("layout");
    let body = zip_of(&[("node.exe", b"MZ in the wrong place")]);
    server.serve("/official/v1.2.3/node-v1.2.3-win-x64.zip", Reply::Body(body.clone()));
    let release = zip_download(&server, &["official"], &body);
    let error = prepare_node(&temp.0, &release, &mut quiet()).unwrap_err();
    assert!(matches!(&error, DownloadError::Unpack(reason) if reason.contains("node-v1.2.3-win-x64/node.exe")), "{error}");
    assert!(leftovers(&temp.0).is_empty(), "{:?}", leftovers(&temp.0));
}

#[test]
fn a_damaged_install_is_replaced_and_old_versions_and_stale_downloads_are_removed() {
    let server = Server::start();
    let temp = Temp::new("replace");
    let body = windows_zip();
    server.serve("/official/v1.2.3/node-v1.2.3-win-x64.zip", Reply::Body(body.clone()));
    let release = zip_download(&server, &["official"], &body);
    let runtime = temp.0.join("runtime");
    fs::create_dir_all(runtime.join("node-v1.2.3")).unwrap();
    fs::write(runtime.join("node-v1.2.3/node.exe"), b"half written").unwrap();
    fs::create_dir_all(runtime.join("node-v1.0.0")).unwrap();
    fs::create_dir_all(runtime.join(".download-1-2")).unwrap();
    fs::write(runtime.join(".download-1-2/archive"), b"partial").unwrap();
    assert_eq!(installed_node(&temp.0, &release), None, "no marker means not checked");
    let exe = prepare_node(&temp.0, &release, &mut quiet()).unwrap();
    assert_eq!(fs::read(exe).unwrap(), b"MZ fake node");
    assert_eq!(leftovers(&temp.0), ["node-v1.2.3"]);
}

#[cfg(target_os = "macos")]
#[test]
fn a_tar_xz_unpacks_with_bin_node_still_executable() {
    use std::os::unix::fs::PermissionsExt;
    let server = Server::start();
    let temp = Temp::new("tarxz");
    let tree = temp.0.join("src/node-v1.2.3-darwin-arm64/bin");
    fs::create_dir_all(&tree).unwrap();
    fs::write(tree.join("node"), b"#!/bin/sh\necho v1.2.3\n").unwrap();
    fs::set_permissions(tree.join("node"), fs::Permissions::from_mode(0o755)).unwrap();
    let archive = temp.0.join("node.tar.xz");
    let status = std::process::Command::new("/usr/bin/tar").arg("-cJf").arg(&archive).arg("-C").arg(temp.0.join("src")).arg("node-v1.2.3-darwin-arm64").status().unwrap();
    assert!(status.success());
    let body = fs::read(&archive).unwrap();
    server.serve("/official/v1.2.3/node-v1.2.3-darwin-arm64.tar.xz", Reply::Body(body.clone()));
    let data = temp.0.join("data");
    let release = download(&server, &["official"], "node-v1.2.3-darwin-arm64.tar.xz", sha(&body), ArchiveKind::TarXz, "bin/node");
    let exe = prepare_node(&data, &release, &mut quiet()).unwrap();
    assert_eq!(exe, data.join("runtime/node-v1.2.3/bin/node"));
    assert_eq!(fs::metadata(&exe).unwrap().permissions().mode() & 0o111, 0o111);
    let output = std::process::Command::new(&exe).output().unwrap();
    assert_eq!(String::from_utf8_lossy(&output.stdout).trim(), "v1.2.3");
}

#[test]
fn a_node_on_this_computer_wins_and_otherwise_the_download_is_used() {
    let server = Server::start();
    let temp = Temp::new("choose");
    let body = windows_zip();
    server.serve("/official/v1.2.3/node-v1.2.3-win-x64.zip", Reply::Body(body.clone()));
    let release = zip_download(&server, &["official"], &body);
    let minimum = NodeVersion(1, 0, 0);
    let system = FoundNode { path: PathBuf::from("/usr/local/bin/node"), version: NodeVersion(26, 0, 0) };
    let chosen = choose(Ok(system), minimum, &temp.0, Ok(release.clone()), &mut quiet()).unwrap();
    assert_eq!((chosen.source, chosen.path), (NodeSource::System, PathBuf::from("/usr/local/bin/node")));
    assert_eq!(server.hits(), 0);
    let tried = vec![(PathBuf::from("/old/node"), "Node 20.0.0 is older than 1.0.0".to_string())];
    let chosen = choose(Err(tried.clone()), minimum, &temp.0, Ok(release.clone()), &mut quiet()).unwrap();
    assert_eq!(chosen.source, NodeSource::Downloaded);
    assert_eq!(chosen.version, VERSION);
    assert_eq!(chosen.path, temp.0.join("runtime/node-v1.2.3/node.exe"));
    let error = choose(Err(tried.clone()), NodeVersion(2, 0, 0), &temp.0, Ok(release), &mut quiet()).unwrap_err();
    assert!(error.message.contains("/old/node") && error.message.contains("older than 2.0.0"), "{error}");
    let error = choose(Err(tried.clone()), minimum, &temp.0, Err(DownloadError::Unsupported { os: "plan9".into(), arch: "mips".into() }), &mut quiet()).unwrap_err();
    assert!(error.message.contains("/old/node") && error.message.contains("plan9"), "{error}");
    assert_eq!(error.cause, FailureCause::Other);
    let other = Temp::new("choose-disk");
    let offline = zip_download(&server, &["nowhere"], &body);
    let error = choose(Err(tried.clone()), minimum, &other.0, Ok(offline), &mut quiet()).unwrap_err();
    assert_eq!(error.cause, FailureCause::Network, "{error}");
    fs::remove_dir_all(other.0.join("runtime")).unwrap();
    fs::write(other.0.join("runtime"), b"a file where the runtime folder should be").unwrap();
    let error = choose(Err(tried), minimum, &other.0, Ok(zip_download(&server, &["official"], &body)), &mut quiet()).unwrap_err();
    assert_eq!(error.cause, FailureCause::Disk, "a folder Fuyu cannot write to is not reported as a network problem: {error}");
}

#[test]
#[ignore = "downloads Node from nodejs.org and both mirrors"]
fn every_real_source_serves_the_pinned_node_and_it_runs() {
    let official = plugin_base::official_download(None).unwrap();
    for source in &official.sources {
        let temp = Temp::new(&format!("real-{}", source.len()));
        let release = NodeDownload { sources: vec![source.clone()], ..official.clone() };
        let started = std::time::Instant::now();
        let exe = prepare_node(&temp.0, &release, &mut quiet()).unwrap_or_else(|error| panic!("{source}: {error}"));
        let output = std::process::Command::new(&exe).arg("--version").output().unwrap();
        let printed = String::from_utf8_lossy(&output.stdout).trim().to_string();
        eprintln!("{source}: {} s, {printed}", started.elapsed().as_secs());
        assert_eq!(printed, format!("v{}", plugin_base::NODE_RELEASE));
    }
}
