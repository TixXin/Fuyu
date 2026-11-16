use base64::{engine::general_purpose::STANDARD, Engine};

use crate::cc_connect::{
    config_file::FILE_NAME,
    remote_project::{self, Seen},
    script::{decode, find_exe, proxy_env, sh_quote, NOT_FOUND, NO_HISTORY},
};
use crate::user_error::UserError;

const LOG_BYTES: u32 = 16 * 1024;
const MAX_QR_BYTES: u32 = 1024 * 1024;
const PNG_START: &[u8] = b"\x89PNG\r\n\x1a\n";
const PNG_END: &[u8] = b"IEND\xAE\x42\x60\x82";

fn places(stamp: &str) -> String {
    let stamp = sh_quote(stamp);
    format!(
        r#"{NO_HISTORY}c="$HOME/.cc-connect/{FILE_NAME}"
b="$c.bak-fuyu-"{stamp}
d="$HOME/.cc-connect/fuyu-feishu-"{stamp}
put_back() {{
  if [ -f "$b" ]; then cp -p "$b" "$c"; else rm -f "$c"; fi
}}
"#
    )
}

fn log_line() -> String {
    format!("[ -f \"$d/out.log\" ] && printf 'O %s\\n' \"$(tail -c {LOG_BYTES} \"$d/out.log\" | base64 | tr -d '\\n')\"\n")
}

pub(super) fn run_script(path: Option<&str>, proxy: Option<&str>, seen: &Seen, name: &str, block: &str, stamp: &str) -> String {
    let mut script = find_exe(path);
    script.push_str(&proxy_env(proxy));
    script.push_str(&format!("[ -n \"$exe\" ] || {{ echo {NOT_FOUND}; exit 0; }}\n"));
    script.push_str(&places(stamp));
    script.push_str(&format!(
        r#"mkdir -p "$d" || {{ echo 'FAILED mkdir'; exit 0; }}
w=$(
{write})
printf '%s\n' "$w"
printf '%s\n' "$w" | grep -qx OK || {{ rm -rf "$d"; exit 0; }}
: > "$d/written"
"$exe" feishu new --config "$c" --project {name} --qr-image "$d/qr.png" --set-allow-from-empty >"$d/out.log" 2>&1 </dev/null &
echo $! > "$d/pid"
wait $!
code=$?
printf 'E %s\n' "$code"
{log}if [ "$code" = 0 ] && grep -q '✅' "$d/out.log"; then echo DONE; else put_back; echo UNDONE; fi
rm -rf "$d"
"#,
        write = remote_project::write_script(seen, name, block, stamp),
        name = sh_quote(name),
        log = log_line(),
    ));
    script
}

pub(super) fn peek_script(stamp: &str, want_qr: bool) -> String {
    let mut script = places(stamp);
    script.push_str("[ -d \"$d\" ] || exit 0\n");
    if want_qr {
        script.push_str(&format!(
            "[ -f \"$d/qr.png\" ] && [ \"$(wc -c < \"$d/qr.png\")\" -le {MAX_QR_BYTES} ] && printf 'Q %s\\n' \"$(base64 < \"$d/qr.png\" | tr -d '\\n')\"\n"
        ));
    }
    script.push_str(&log_line());
    script.push_str("exit 0\n");
    script
}

pub(super) fn cleanup_script(stamp: &str) -> String {
    let mut script = places(stamp);
    script.push_str(
        r#"[ -d "$d" ] || exit 0
p=$(cat "$d/pid" 2>/dev/null)
case $p in ''|*[!0-9]*) ;; *) kill "$p" 2>/dev/null ;; esac
i=0
while [ -d "$d" ] && [ $i -lt 5 ]; do sleep 1; i=$((i + 1)); done
[ -d "$d" ] || exit 0
if [ -f "$d/written" ] && ! grep -q '✅' "$d/out.log" 2>/dev/null; then put_back; fi
rm -rf "$d"
echo CLEANED
"#,
    );
    script
}

#[derive(Debug, Default, PartialEq)]
pub(super) struct Peek {
    pub(super) qr: Option<String>,
    pub(super) output: Option<Vec<String>>,
}

pub(super) fn parse_peek(output: &str) -> Peek {
    let mut peek = Peek::default();
    for line in output.lines() {
        if let Some(text) = line.strip_prefix("Q ") {
            peek.qr = STANDARD.decode(text.trim()).ok().filter(|png| png.starts_with(PNG_START) && png.ends_with(PNG_END)).map(|png| format!("data:image/png;base64,{}", STANDARD.encode(png)));
        } else if let Some(text) = line.strip_prefix("O ") {
            peek.output = Some(log_lines(text));
        }
    }
    peek
}

fn log_lines(base64: &str) -> Vec<String> {
    decode(base64).map(|text| text.lines().filter_map(worth_keeping).collect()).unwrap_or_default()
}

fn worth_keeping(line: &str) -> Option<String> {
    let line = line.trim();
    let drawn = line.chars().any(|ch| matches!(ch, '█' | '▀' | '▄'));
    (!line.is_empty() && !drawn).then(|| line.to_string())
}

#[derive(Debug, PartialEq)]
pub(super) enum Finished {
    Done(Vec<String>),
    Failed(UserError, Vec<String>),
}

pub(super) fn parse_run(host: &str, output: &str) -> Finished {
    if output.lines().any(|line| line == NOT_FOUND) {
        let error = UserError::new("ccConnect.remoteNotFound", format!("cc-connect was not found on {host}.")).arg("host", host);
        return Finished::Failed(error, Vec::new());
    }
    if let Err(error) = remote_project::parse_write(host, output) {
        return Finished::Failed(error, Vec::new());
    }
    let mut lines = Vec::new();
    for line in output.lines() {
        if let Some(text) = line.strip_prefix("O ") {
            lines = log_lines(text);
        } else if line == "DONE" {
            return Finished::Done(lines);
        } else if line == "UNDONE" {
            break;
        }
    }
    Finished::Failed(failure(&lines), lines)
}

pub(super) fn failure(output: &[String]) -> UserError {
    let line = output.iter().rev().find(|line| line.starts_with("Error")).or(output.last());
    UserError::new("ccConnect.feishuUnfinished", "The Feishu QR setup did not finish.").detail(line.map_or("", String::as_str))
}

pub(super) fn after(output: &[String], prefix: &str) -> Option<String> {
    output.iter().rev().find_map(|line| line.strip_prefix(prefix)).map(|rest| rest.trim().to_string())
}
