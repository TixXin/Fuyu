use std::io::Read;

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;

use super::{
    install,
    script::{find_exe, sh_quote, INSTALL_DIR},
};
use crate::user_error::UserError;

const MAX_PROGRAM: u64 = 300 << 20;
const END: &str = "FUYU_PACKAGE_END";
const LINES_PER_PIECE: usize = 1000;

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteInstall {
    exe: String,
    installed: bool,
    version: Option<String>,
}

pub(super) struct Probe {
    exe: Option<String>,
    os: String,
    arch: String,
}

pub(super) fn probe_script(path: Option<&str>) -> String {
    let mut script = find_exe(path);
    script.push_str("printf 'X %s\\n' \"$exe\"\nprintf 'U %s %s\\n' \"$(uname -s)\" \"$(uname -m)\"\n");
    script
}

pub(super) fn parse_probe(output: &str) -> Probe {
    let mut probe = Probe { exe: None, os: String::new(), arch: String::new() };
    for line in output.lines() {
        if let Some(path) = line.strip_prefix("X ") {
            probe.exe = Some(path.trim().to_string()).filter(|path| path.starts_with('/'));
        } else if let Some((os, arch)) = line.strip_prefix("U ").and_then(|rest| rest.trim().split_once(' ')) {
            (probe.os, probe.arch) = (os.trim().to_string(), arch.trim().to_string());
        }
    }
    probe
}

impl Probe {
    pub(super) fn already(&self) -> Option<RemoteInstall> {
        self.exe.clone().map(|exe| RemoteInstall { exe, installed: false, version: None })
    }
}

pub(super) fn asset_name(tag: &str, probe: &Probe) -> Result<String, UserError> {
    let os = match probe.os.as_str() {
        "Linux" => "linux",
        "Darwin" => "darwin",
        other => return Err(UserError::new("ccConnect.remoteSystem", format!("cc-connect has no build for {other}.")).arg("system", other)),
    };
    let arch = match probe.arch.as_str() {
        "x86_64" | "amd64" => "amd64",
        "aarch64" | "arm64" => "arm64",
        other => return Err(UserError::new("ccConnect.remoteSystem", format!("cc-connect has no build for {other}.")).arg("system", other)),
    };
    Ok(format!("cc-connect-{tag}-{os}-{arch}.tar.gz"))
}

pub(super) fn program_in(package: &[u8]) -> Result<String, UserError> {
    let unreadable = |error: std::io::Error| UserError::new("ccConnect.zip", "Could not read the cc-connect package.").detail(error);
    let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(package));
    let mut program = None;
    for entry in archive.entries().map_err(unreadable)? {
        let mut entry = entry.map_err(unreadable)?;
        if !entry.header().entry_type().is_file() {
            continue;
        }
        let name = entry.path().map_err(unreadable)?.to_string_lossy().into_owned();
        let plain = name.starts_with("cc-connect") && name.bytes().all(|byte| byte.is_ascii_alphanumeric() || b".-_".contains(&byte));
        if !plain || program.is_some() {
            return Err(UserError::new("ccConnect.zipEmpty", "The cc-connect package does not hold exactly one program.").detail(name));
        }
        if entry.size() > MAX_PROGRAM {
            return Err(UserError::new("ccConnect.zipLarge", "The cc-connect program is unusually large; gave up."));
        }
        std::io::copy(&mut entry.by_ref().take(MAX_PROGRAM), &mut std::io::sink()).map_err(unreadable)?;
        program = Some(name);
    }
    program.ok_or_else(|| UserError::new("ccConnect.zipEmpty", "The cc-connect package does not hold exactly one program."))
}

pub(super) fn upload_script(package: &install::Package, program: &str) -> String {
    let sum = sh_quote(&package.sha256);
    let mut script = format!(
        "d=\"{INSTALL_DIR}\"\nt=$(mktemp -d 2>/dev/null) || {{ echo 'FAILED mktemp'; exit 0; }}\ntrap 'rm -rf \"$t\"' EXIT\n"
    );
    let encoded = STANDARD.encode(&package.bytes);
    for piece in encoded.as_bytes().chunks(76 * LINES_PER_PIECE) {
        script.push_str(&format!("cat >> \"$t/p.b64\" <<'{END}'\n"));
        for line in piece.chunks(76) {
            script.push_str(&String::from_utf8_lossy(line));
            script.push('\n');
        }
        script.push_str(END);
        script.push('\n');
    }
    script.push_str(&format!(
        r#"base64 -d < "$t/p.b64" > "$t/p.tgz" || {{ echo 'FAILED base64'; exit 0; }}
if command -v sha256sum >/dev/null 2>&1; then s=$(sha256sum "$t/p.tgz" | cut -d' ' -f1)
elif command -v shasum >/dev/null 2>&1; then s=$(shasum -a 256 "$t/p.tgz" | cut -d' ' -f1)
else s={sum}; fi
[ "$s" = {sum} ] || {{ echo SUMBAD; exit 0; }}
mkdir -p "$d" || {{ echo 'FAILED mkdir'; exit 0; }}
tar -xzOf "$t/p.tgz" {program} > "$d/cc-connect.part" || {{ rm -f "$d/cc-connect.part"; echo 'FAILED tar'; exit 0; }}
chmod 755 "$d/cc-connect.part" && mv -f "$d/cc-connect.part" "$d/cc-connect" || {{ rm -f "$d/cc-connect.part"; echo 'FAILED move'; exit 0; }}
printf 'V %s\n' "$("$d/cc-connect" --version 2>/dev/null | head -n 1)"
printf 'OK %s\n' "$d/cc-connect"
"#,
        program = sh_quote(program),
    ));
    script
}

pub(super) fn parse_upload(host: &str, output: &str) -> Result<RemoteInstall, UserError> {
    let mut version = None;
    for line in output.lines() {
        if let Some(text) = line.strip_prefix("V ") {
            version = Some(text.trim().to_string()).filter(|text| !text.is_empty());
        } else if let Some(exe) = line.strip_prefix("OK ") {
            return Ok(RemoteInstall { exe: exe.trim().to_string(), installed: true, version });
        } else if line == "SUMBAD" {
            return Err(UserError::new("ccConnect.checksum", "The downloaded cc-connect does not match the release's checksum; it was thrown away."));
        } else if let Some(step) = line.strip_prefix("FAILED ") {
            return Err(install_failed(host).detail(step.trim()));
        }
    }
    Err(install_failed(host).detail(output.lines().last().unwrap_or_default().trim()))
}

fn install_failed(host: &str) -> UserError {
    UserError::new("ccConnect.remoteInstall", format!("cc-connect could not be installed on {host}.")).arg("host", host)
}

#[cfg(test)]
mod tests {
    use super::{asset_name, parse_probe, parse_upload, program_in, upload_script, END};
    use crate::cc_connect::install::Package;

    fn package(files: &[(&str, &[u8])]) -> Vec<u8> {
        let mut builder = tar::Builder::new(flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast()));
        for (name, data) in files {
            let mut header = tar::Header::new_gnu();
            header.set_size(data.len() as u64);
            header.set_mode(0o755);
            header.set_cksum();
            builder.append_data(&mut header, name, *data).unwrap();
        }
        builder.into_inner().unwrap().finish().unwrap()
    }

    #[test]
    fn the_package_matches_the_remote_system() {
        let probe = parse_probe("X \nU Linux x86_64\n");
        assert!(probe.already().is_none());
        assert_eq!(asset_name("v1.5.0", &probe).unwrap(), "cc-connect-v1.5.0-linux-amd64.tar.gz");
        assert_eq!(asset_name("v1.5.0", &parse_probe("U Darwin arm64\n")).unwrap(), "cc-connect-v1.5.0-darwin-arm64.tar.gz");
        assert_eq!(asset_name("v1.5.0", &parse_probe("U Linux aarch64\n")).unwrap(), "cc-connect-v1.5.0-linux-arm64.tar.gz");
        assert_eq!(asset_name("v1.5.0", &parse_probe("U FreeBSD amd64\n")).unwrap_err().code(), "ccConnect.remoteSystem");
        assert_eq!(asset_name("v1.5.0", &parse_probe("U Linux armv7l\n")).unwrap_err().code(), "ccConnect.remoteSystem");
        let have = parse_probe("X /home/me/.local/bin/cc-connect\nU Linux x86_64\n").already().unwrap();
        assert_eq!(serde_json::to_value(have).unwrap(), serde_json::json!({ "exe": "/home/me/.local/bin/cc-connect", "installed": false, "version": null }));
    }

    #[test]
    fn the_package_must_hold_exactly_one_plainly_named_program() {
        assert_eq!(program_in(&package(&[("cc-connect-v1.5.0-linux-amd64", b"ELF")])).unwrap(), "cc-connect-v1.5.0-linux-amd64");
        assert!(program_in(&package(&[("cc-connect-a", b"1"), ("cc-connect-b", b"2")])).is_err());
        assert!(program_in(&package(&[("cc-connect $(x)", b"1")])).is_err());
        assert!(program_in(&package(&[])).is_err());
        assert!(program_in(b"not a package").is_err());
    }

    #[test]
    fn the_upload_carries_the_package_as_base64_and_checks_it_again_there() {
        let bytes = package(&[("cc-connect-v1.5.0-linux-amd64", b"ELF")]);
        let pkg = Package { sha256: "ab".repeat(32), bytes: bytes.clone() };
        let script = upload_script(&pkg, "cc-connect-v1.5.0-linux-amd64");
        assert!(script.starts_with("d=\"$HOME/.local/bin\"\n"));
        let opener = format!("cat >> \"$t/p.b64\" <<'{END}'\n");
        let body: String = script.split(&opener).skip(1).flat_map(|piece| piece.split(&format!("\n{END}\n")).next().unwrap().lines()).collect();
        assert_eq!(base64::Engine::decode(&base64::engine::general_purpose::STANDARD, body).unwrap(), bytes);
        let big = Package { sha256: String::new(), bytes: vec![7; 57 * 2500] };
        assert_eq!(upload_script(&big, "x").matches(&opener).count(), 3, "a large package goes up in pieces; one big heredoc takes bash hours");
        assert!(script.lines().all(|line| line.len() <= 400));
        assert!(script.contains(&format!("[ \"$s\" = '{}' ] || {{ echo SUMBAD; exit 0; }}", "ab".repeat(32))));
        assert!(script.contains("tar -xzOf \"$t/p.tgz\" 'cc-connect-v1.5.0-linux-amd64' > \"$d/cc-connect.part\""));
    }

    #[test]
    fn the_upload_answer_says_where_it_went_or_why_not() {
        let done = parse_upload("pc", "V cc-connect v1.5.0\nOK /home/me/.local/bin/cc-connect\n").unwrap();
        assert_eq!(serde_json::to_value(done).unwrap(), serde_json::json!({ "exe": "/home/me/.local/bin/cc-connect", "installed": true, "version": "cc-connect v1.5.0" }));
        assert_eq!(parse_upload("pc", "SUMBAD\n").unwrap_err().code(), "ccConnect.checksum");
        assert_eq!(parse_upload("pc", "FAILED tar\n").unwrap_err().code(), "ccConnect.remoteInstall");
        assert_eq!(parse_upload("pc", "").unwrap_err().code(), "ccConnect.remoteInstall");
    }

    #[cfg(unix)]
    #[test]
    fn the_upload_installs_the_program_under_sh_and_refuses_a_wrong_checksum() {
        use sha2::{Digest, Sha256};
        use std::{fs, process::Command};
        let home = std::env::temp_dir().join(format!("fuyu-cc-remote-install-{}", std::process::id()));
        let _ = fs::remove_dir_all(&home);
        fs::create_dir_all(&home).unwrap();
        let run = |script: &str| {
            let output = Command::new("sh").arg("-s").env("HOME", &home).stdin(std::process::Stdio::piped()).stdout(std::process::Stdio::piped()).spawn().and_then(|mut child| {
                std::io::Write::write_all(child.stdin.as_mut().unwrap(), script.as_bytes())?;
                child.wait_with_output()
            });
            String::from_utf8_lossy(&output.unwrap().stdout).into_owned()
        };
        let bytes = package(&[("cc-connect-v1.5.0-linux-amd64", b"#!/bin/sh\necho 'cc-connect v1.5.0'\n")]);
        let wrong = Package { sha256: "0".repeat(64), bytes: bytes.clone() };
        assert_eq!(parse_upload("pc", &run(&upload_script(&wrong, "cc-connect-v1.5.0-linux-amd64"))).unwrap_err().code(), "ccConnect.checksum");
        let exe = home.join(".local/bin/cc-connect");
        assert!(!exe.exists());
        let sha256 = Sha256::digest(&bytes).iter().map(|byte| format!("{byte:02x}")).collect();
        let right = Package { sha256, bytes };
        let done = parse_upload("pc", &run(&upload_script(&right, "cc-connect-v1.5.0-linux-amd64"))).unwrap();
        assert_eq!(serde_json::to_value(done).unwrap()["version"], "cc-connect v1.5.0");
        assert!(exe.is_file() && !home.join(".local/bin/cc-connect.part").exists());
        let probe = parse_probe(&run(&super::probe_script(None)));
        assert_eq!(probe.already().map(|found| serde_json::to_value(found).unwrap()["exe"].clone()), Some(serde_json::json!(exe.to_str().unwrap())));
        let _ = fs::remove_dir_all(&home);
    }
}
