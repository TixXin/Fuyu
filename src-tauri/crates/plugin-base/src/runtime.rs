use std::{
    path::{Path, PathBuf},
    time::Duration,
};

use crate::{
    download::{prepare_node, ArchiveKind, DownloadError, NodeArchive, NodeDownload, Progress},
    node::{describe_failure, find_node, FoundNode, NodeSearch, NodeVersion},
};

pub const NODE_RELEASE: NodeVersion = NodeVersion(26, 13, 1);

pub const NODE_SOURCES: [&str; 3] = ["https://nodejs.org/dist", "https://cdn.npmmirror.com/binaries/node", "https://mirrors.cloud.tencent.com/nodejs-release"];

const NODE_ARCHIVES: [(&str, &str, &str); 4] = [
    ("macos", "aarch64", "af6202f5370a3a5209e85dc543758dfd9f44c8726626a236730cd603a67a8559"),
    ("macos", "x86_64", "2693310b2820f9350d29524f21344e1c623875bab773457d55b2aceb9670716f"),
    ("windows", "x86_64", "e2edda75bfb089654705cf65a13b58933bfd5f57148e8ebda916f58a2474f1f7"),
    ("windows", "aarch64", "181ebe431b90787113a9e4fc80d38ce86d37888a353a0386de44d2872e48cb97"),
];

pub fn node_archive(os: &str, arch: &str) -> Option<NodeArchive> {
    let (_, _, sha256) = NODE_ARCHIVES.iter().find(|(o, a, _)| *o == os && *a == arch)?;
    let cpu = if arch == "aarch64" { "arm64" } else { "x64" };
    let version = NODE_RELEASE;
    Some(if os == "windows" {
        NodeArchive { file: format!("node-v{version}-win-{cpu}.zip"), sha256: (*sha256).into(), kind: ArchiveKind::Zip, exe: "node.exe".into() }
    } else {
        NodeArchive { file: format!("node-v{version}-darwin-{cpu}.tar.xz"), sha256: (*sha256).into(), kind: ArchiveKind::TarXz, exe: "bin/node".into() }
    })
}

pub fn official_download(proxy: Option<String>) -> Result<NodeDownload, DownloadError> {
    let (os, arch) = (std::env::consts::OS, std::env::consts::ARCH);
    let archive = node_archive(os, arch).ok_or_else(|| DownloadError::Unsupported { os: os.into(), arch: arch.into() })?;
    Ok(NodeDownload {
        version: NODE_RELEASE,
        archive,
        sources: NODE_SOURCES.iter().map(|source| (*source).into()).collect(),
        proxy,
        max_bytes: 200 << 20,
        connect_timeout: Duration::from_secs(15),
        read_timeout: Duration::from_secs(30),
    })
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NodeSource {
    System,
    Downloaded,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChosenNode {
    pub path: PathBuf,
    pub version: NodeVersion,
    pub source: NodeSource,
}

pub fn node_for_host(search: &NodeSearch, minimum: NodeVersion, data_dir: &Path, download: Result<NodeDownload, DownloadError>, progress: &mut dyn FnMut(Progress)) -> Result<ChosenNode, String> {
    choose(find_node(search, minimum), minimum, data_dir, download, progress)
}

pub fn choose(
    found: Result<FoundNode, Vec<(PathBuf, String)>>,
    minimum: NodeVersion,
    data_dir: &Path,
    download: Result<NodeDownload, DownloadError>,
    progress: &mut dyn FnMut(Progress),
) -> Result<ChosenNode, String> {
    let tried = match found {
        Ok(found) => return Ok(ChosenNode { path: found.path, version: found.version, source: NodeSource::System }),
        Err(tried) => tried,
    };
    let fail = |error: DownloadError| format!("{}; {error}", describe_failure(&tried, minimum));
    let download = download.map_err(fail)?;
    if download.version < minimum {
        return Err(fail(DownloadError::Unpack(format!("the bundled Node {} is older than {minimum}", download.version))));
    }
    let path = prepare_node(data_dir, &download, progress).map_err(fail)?;
    Ok(ChosenNode { path, version: download.version, source: NodeSource::Downloaded })
}

#[cfg(test)]
mod tests {
    use super::{node_archive, NODE_RELEASE};
    use crate::{download::ArchiveKind, node::MINIMUM_NODE};

    #[test]
    fn the_pinned_node_is_new_enough_and_every_platform_has_an_archive() {
        assert!(NODE_RELEASE >= MINIMUM_NODE);
        let mac = node_archive("macos", "aarch64").unwrap();
        assert_eq!(mac.file, "node-v26.13.1-darwin-arm64.tar.xz");
        assert_eq!(mac.folder(), "node-v26.13.1-darwin-arm64");
        assert_eq!((mac.kind, mac.exe.as_str()), (ArchiveKind::TarXz, "bin/node"));
        assert_eq!(node_archive("macos", "x86_64").unwrap().file, "node-v26.13.1-darwin-x64.tar.xz");
        let win = node_archive("windows", "x86_64").unwrap();
        assert_eq!((win.file.as_str(), win.folder(), win.exe.as_str()), ("node-v26.13.1-win-x64.zip", "node-v26.13.1-win-x64", "node.exe"));
        assert_eq!(node_archive("windows", "aarch64").unwrap().file, "node-v26.13.1-win-arm64.zip");
        assert!(node_archive("linux", "x86_64").is_none());
        for archive in ["macos/aarch64", "macos/x86_64", "windows/x86_64", "windows/aarch64"] {
            let (os, arch) = archive.split_once('/').unwrap();
            let sha = node_archive(os, arch).unwrap().sha256;
            assert!(sha.len() == 64 && sha.bytes().all(|byte| byte.is_ascii_hexdigit()), "{archive}");
        }
    }
}
